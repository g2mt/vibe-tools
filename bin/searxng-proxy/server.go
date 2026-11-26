package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	maxQueryLength       = 4096
	maxRawQueryLength    = 8192
	maxUpstreamBodyBytes = 8 << 20
	maxConcurrentSearch  = 32
	maxRedirects         = 10
	upstreamTimeout      = 15 * time.Second
)

var htmlTagPattern = regexp.MustCompile(`(?s)<[^>]*>`)

type searchHandler struct {
	settings engineSettings
	client   *http.Client
	active   chan struct{}
}

type searchResponse struct {
	Results []searchResult `json:"results"`
}

type searchResult struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	Content   string `json:"content,omitempty"`
	Engine    string `json:"engine,omitempty"`
	Thumbnail string `json:"thumbnail,omitempty"`
}

func newSearchHandler(settings engineSettings, client *http.Client) http.Handler {
	return &searchHandler{
		settings: settings,
		client:   client,
		active:   make(chan struct{}, maxConcurrentSearch),
	}
}

func newUpstreamClient() *http.Client {
	return &http.Client{
		Timeout: upstreamTimeout,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return errors.New("upstream redirect limit exceeded")
			}
			return nil
		},
	}
}

func (handler *searchHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/search" {
		writeAPIError(writer, http.StatusNotFound, "not found")
		return
	}
	if request.Method != http.MethodGet {
		writer.Header().Set("Allow", http.MethodGet)
		writeAPIError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if len(request.URL.RawQuery) > maxRawQueryLength {
		writeAPIError(writer, http.StatusRequestURITooLong, "request query is too long")
		return
	}

	query := strings.TrimSpace(request.URL.Query().Get("q"))
	if len(query) > maxQueryLength {
		writeAPIError(writer, http.StatusRequestURITooLong, "search query is too long")
		return
	}
	if query == "" {
		writeJSON(writer, http.StatusOK, searchResponse{Results: []searchResult{}})
		return
	}

	select {
	case handler.active <- struct{}{}:
		defer func() { <-handler.active }()
	default:
		writeAPIError(writer, http.StatusServiceUnavailable, "search capacity reached")
		return
	}

	results, err := handler.search(request.Context(), request.URL.Query())
	if err != nil {
		log.Print("upstream search failed")
		writeAPIError(writer, http.StatusBadGateway, "upstream search failed")
		return
	}
	writeJSON(writer, http.StatusOK, searchResponse{Results: results})
}

func (handler *searchHandler) search(ctx context.Context, params url.Values) ([]searchResult, error) {
	var results []searchResult
	for _, settings := range handler.settings.configuredEngines() {
		engineHandler := *handler
		engineHandler.settings = settings
		engineResults, err := engineHandler.searchEngine(ctx, params)
		if err != nil {
			return nil, err
		}
		results = append(results, engineResults...)
	}
	return results, nil
}

func (handler *searchHandler) searchEngine(ctx context.Context, params url.Values) ([]searchResult, error) {
	values := handler.templateValues(params)
	formattedURL, err := renderTemplate(handler.settings.SearchURL, values)
	if err != nil {
		return nil, err
	}
	parsedURL, err := url.Parse(formattedURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" || parsedURL.User != nil {
		return nil, errors.New("configured search_url did not produce a valid HTTP URL")
	}

	var body io.Reader
	if handler.settings.RequestBody != "" {
		bodyTemplateValues := handler.templateValuesForBody(params)
		formattedBody, err := renderTemplate(handler.settings.RequestBody, bodyTemplateValues)
		if err != nil {
			return nil, err
		}
		body = strings.NewReader(formattedBody)
	}

	request, err := http.NewRequestWithContext(ctx, handler.settings.method(), parsedURL.String(), body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	for name, value := range handler.settings.Headers {
		if !isHopByHopHeader(name) && !strings.EqualFold(name, "Host") {
			request.Header.Set(name, value)
		}
	}
	for name, value := range handler.settings.Cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}

	response, err := handler.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if includesStatus(handler.settings.NoResultForHTTPStatus, response.StatusCode) {
		return []searchResult{}, nil
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("upstream returned HTTP %d", response.StatusCode)
	}

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if len(responseBody) > maxUpstreamBodyBytes {
		return nil, errors.New("upstream response exceeded size limit")
	}
	if len(responseBody) == 0 {
		return []searchResult{}, nil
	}

	var data any
	if err := json.Unmarshal(responseBody, &data); err != nil {
		return nil, errors.New("upstream returned invalid JSON")
	}
	return handler.mapResults(data), nil
}

func (handler *searchHandler) templateValues(params url.Values) map[string]string {
	query := params.Get("q")
	language := params.Get("language")
	if language == "" || language == "all" {
		language = handler.settings.languageAll()
	} else if len(language) > 2 {
		language = language[:2]
	}

	page := 1
	if parsed, err := strconv.Atoi(params.Get("pageno")); err == nil && parsed > 0 && parsed <= 1_000_000 {
		page = parsed
	}
	pageNumber := ""
	if handler.settings.Paging && (handler.settings.sendPageNumOnFirstPage() || page != 1) {
		pageNumber = strconv.Itoa((page-1)*handler.settings.pageSize() + handler.settings.firstPageNum())
	}

	timeRange := ""
	if value := params.Get("time_range"); value != "" {
		mappedValue := handler.settings.timeRangeValue(value)
		if mappedValue != "" {
			timeRange, _ = renderTemplate(handler.settings.timeRangeURL(), map[string]string{"time_range_val": mappedValue})
		}
	}

	safeSearch := ""
	if value, err := strconv.Atoi(params.Get("safesearch")); err == nil {
		safeSearch = handler.settings.safeSearchValue(value)
	}

	return map[string]string{
		"query":          url.QueryEscape(query),
		"lang":           language,
		"pageno":         pageNumber,
		"time_range":     timeRange,
		"safe_search":    safeSearch,
		"time_range_val": handler.settings.timeRangeValue(params.Get("time_range")),
	}
}

func (handler *searchHandler) mapResults(data any) []searchResult {
	resultData := data
	if path := string(handler.settings.ResultsQuery); path != "" {
		matches := queryJSON(data, path)
		if len(matches) == 0 {
			return []searchResult{}
		}
		resultData = matches[0]
	}

	items := resultItems(resultData)
	results := make([]searchResult, 0, len(items))
	for _, item := range items {
		urlValue, hasURL := queryFirst(item, string(handler.settings.URLQuery))
		titleValue, hasTitle := queryFirst(item, string(handler.settings.TitleQuery))
		if !hasURL || !hasTitle {
			continue
		}
		resultURL := handler.settings.URLPrefix + stringify(urlValue)
		title := stringify(titleValue)
		if resultURL == "" || title == "" {
			continue
		}
		if handler.settings.TitleHTMLToText {
			title = htmlText(title)
		}
		result := searchResult{
			Title:  title,
			URL:    resultURL,
			Engine: handler.settings.engineName(),
		}
		if content, ok := queryFirst(item, string(handler.settings.ContentQuery)); ok {
			result.Content = stringify(content)
			if handler.settings.ContentHTMLToText {
				result.Content = htmlText(result.Content)
			}
		}
		if path := string(handler.settings.ThumbnailQuery); path != "" {
			if thumbnail, ok := queryFirst(item, path); ok {
				result.Thumbnail = handler.settings.ThumbnailPrefix + stringify(thumbnail)
			}
		}
		results = append(results, result)
	}
	return results
}

func (handler *searchHandler) templateValuesForBody(params url.Values) map[string]string {
	values := handler.templateValues(params)
	values["query"] = params.Get("q")
	return values
}

func resultItems(value any) []any {
	switch value := value.(type) {
	case []any:
		return value
	default:
		return []any{}
	}
}

func queryFirst(data any, path string) (any, bool) {
	if path == "" {
		return nil, false
	}
	matches := queryJSON(data, path)
	if len(matches) == 0 {
		return nil, false
	}
	return matches[0], true
}

func queryJSON(data any, path string) []any {
	segments := make([]string, 0)
	for _, segment := range strings.Split(path, "/") {
		if segment != "" {
			segments = append(segments, segment)
		}
	}
	if len(segments) == 0 {
		return nil
	}
	return walkJSON(data, segments)
}

func walkJSON(data any, segments []string) []any {
	if len(segments) == 0 {
		return nil
	}
	matches := make([]any, 0)
	walk := func(key string, value any) {
		if len(segments) == 1 {
			if key == segments[0] {
				matches = append(matches, value)
			} else if isJSONContainer(value) {
				matches = append(matches, walkJSON(value, segments)...)
			}
			return
		}
		if key == segments[0] {
			matches = append(matches, walkJSON(value, segments[1:])...)
		} else if isJSONContainer(value) {
			matches = append(matches, walkJSON(value, segments)...)
		}
	}

	switch value := data.(type) {
	case map[string]any:
		keys := make([]string, 0, len(value))
		for key := range value {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			walk(key, value[key])
		}
	case []any:
		for index, item := range value {
			walk(strconv.Itoa(index), item)
		}
	}
	return matches
}

func isJSONContainer(value any) bool {
	switch value.(type) {
	case map[string]any, []any:
		return true
	default:
		return false
	}
}

func stringify(value any) string {
	switch value := value.(type) {
	case string:
		return value
	case nil:
		return ""
	default:
		return fmt.Sprint(value)
	}
}

func htmlText(value string) string {
	return strings.TrimSpace(html.UnescapeString(htmlTagPattern.ReplaceAllString(value, "")))
}

func includesStatus(statuses []int, target int) bool {
	for _, status := range statuses {
		if status == target {
			return true
		}
	}
	return false
}

func isHopByHopHeader(name string) bool {
	switch strings.ToLower(name) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func renderTemplate(template string, values map[string]string) (string, error) {
	var output strings.Builder
	for index := 0; index < len(template); {
		switch template[index] {
		case '{':
			if index+1 < len(template) && template[index+1] == '{' {
				output.WriteByte('{')
				index += 2
				continue
			}
			end := strings.IndexByte(template[index+1:], '}')
			if end < 0 {
				return "", errors.New("unclosed template field")
			}
			end += index + 1
			key := template[index+1 : end]
			value, ok := values[key]
			if !ok {
				return "", fmt.Errorf("unknown template field %q", key)
			}
			output.WriteString(value)
			index = end + 1
		case '}':
			if index+1 < len(template) && template[index+1] == '}' {
				output.WriteByte('}')
				index += 2
				continue
			}
			return "", errors.New("unmatched closing brace in template")
		default:
			output.WriteByte(template[index])
			index++
		}
	}
	return output.String(), nil
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeAPIError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, struct {
		Error string `json:"error"`
	}{Error: message})
}
