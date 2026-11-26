package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestLoadConfigSelectsOnlyJSONEngine(t *testing.T) {
	input := `engines:
  - engine: xpath
    search_url: 47
  - name: local
    shortcut: local
    base_url: http://ignored.example
    weight: 0.6
    engine: json_engine
    search_url: 'https://search.example/search?q={query}&format=json'
    paging: false
    results_query: documents
    url_query: url
    title_query: title
    content_query: metadata/description
    thumbnail_query: false
`
	settings, err := loadConfig(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if settings.Name != "local" {
		t.Fatalf("expected selected engine name local, got %q", settings.Name)
	}
	if settings.SearchURL != "https://search.example/search?q={query}&format=json" {
		t.Fatalf("unexpected search URL: %q", settings.SearchURL)
	}
	if settings.ContentQuery != "metadata/description" {
		t.Fatalf("unexpected content query: %q", settings.ContentQuery)
	}
	if settings.ThumbnailQuery != "" {
		t.Fatalf("false thumbnail_query should disable thumbnails, got %q", settings.ThumbnailQuery)
	}
}

func TestLoadConfigRejectsMultipleJSONEngines(t *testing.T) {
	input := `engines:
  - engine: json_engine
    search_url: https://one.example/?q={query}
    url_query: url
    title_query: title
  - engine: json_engine
    search_url: https://two.example/?q={query}
    url_query: url
    title_query: title
`
	if _, err := loadConfig(strings.NewReader(input)); err == nil {
		t.Fatal("expected multiple json_engine entries to fail")
	}
}

func TestSearchHandlerBuildsUpstreamRequestAndMapsResults(t *testing.T) {
	var receivedQuery string
	var receivedPage string
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		receivedQuery = request.URL.Query().Get("q")
		receivedPage = request.URL.Query().Get("page")
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"documents":[{"title":"<b>Example</b>","url":"https://result.example/","metadata":{"description":"A result"},"preview":"/preview.jpg"}]}`))
	}))
	defer upstream.Close()

	pageSize := 1
	settings := engineSettings{
		Name:            "local",
		SearchURL:       upstream.URL + "/search?q={query}&page={pageno}",
		Paging:          true,
		PageSize:        &pageSize,
		ResultsQuery:    "documents",
		URLQuery:        "url",
		TitleQuery:      "title",
		ContentQuery:    "metadata/description",
		ThumbnailQuery:  "preview",
		ThumbnailPrefix: "https://images.example",
		TitleHTMLToText: true,
	}
	handler := newSearchHandler(settings, newUpstreamClient())
	request := httptest.NewRequest(http.MethodGet, "/search?q=privacy+search&format=json&pageno=2", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d: %s", response.Code, response.Body.String())
	}
	if receivedQuery != "privacy search" || receivedPage != "2" {
		t.Fatalf("unexpected upstream parameters q=%q page=%q", receivedQuery, receivedPage)
	}
	var result searchResponse
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Results) != 1 {
		t.Fatalf("expected one result, got %d", len(result.Results))
	}
	mapped := result.Results[0]
	if mapped.Title != "Example" || mapped.URL != "https://result.example/" {
		t.Fatalf("unexpected mapped result: %#v", mapped)
	}
	if mapped.Content != "A result" || mapped.Engine != "local" {
		t.Fatalf("unexpected content/source fields: %#v", mapped)
	}
	if mapped.Thumbnail != "https://images.example/preview.jpg" {
		t.Fatalf("thumbnail prefix was not applied: %q", mapped.Thumbnail)
	}
}

func TestTemplateValuesEncodeURLQueryAndMapFilters(t *testing.T) {
	settings := engineSettings{
		Paging:           true,
		TimeRangeSupport: true,
		TimeRangeMap:     map[string]scalarValue{"week": "168"},
		TimeRangeURL:     "&hours={time_range_val}",
		SafeSearch:       true,
		SafeSearchMap:    map[int]string{2: "&filter=strict"},
	}
	pageSize := 10
	settings.PageSize = &pageSize
	values := (&searchHandler{settings: settings}).templateValues(url.Values{
		"q":          {"two words"},
		"language":   {"en-US"},
		"pageno":     {"3"},
		"time_range": {"week"},
		"safesearch": {"2"},
	})
	if values["query"] != "two+words" || values["lang"] != "en" || values["pageno"] != "21" {
		t.Fatalf("unexpected query substitutions: %#v", values)
	}
	if values["time_range"] != "&hours=168" || values["safe_search"] != "&filter=strict" {
		t.Fatalf("unexpected filter substitutions: %#v", values)
	}
}

func TestRenderTemplateSupportsEscapedBraces(t *testing.T) {
	actual, err := renderTemplate(`{{"query":"{query}"}}`, map[string]string{"query": "term"})
	if err != nil {
		t.Fatal(err)
	}
	if actual != `{"query":"term"}` {
		t.Fatalf("unexpected formatted body: %q", actual)
	}
	if _, err := renderTemplate("{unknown}", map[string]string{}); err == nil {
		t.Fatal("expected unknown fields to fail")
	}
}

func TestSearchHandlerRejectsOtherPathsAndMethods(t *testing.T) {
	handler := newSearchHandler(engineSettings{}, newUpstreamClient())
	for _, test := range []struct {
		method string
		path   string
		want   int
	}{
		{method: http.MethodGet, path: "/", want: http.StatusNotFound},
		{method: http.MethodPost, path: "/search", want: http.StatusMethodNotAllowed},
	} {
		t.Run(fmt.Sprintf("%s %s", test.method, test.path), func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.want {
				t.Fatalf("expected HTTP %d, got %d", test.want, response.Code)
			}
		})
	}
}
