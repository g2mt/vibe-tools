package main

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"gopkg.in/yaml.v3"
)

type queryPath string

func (path *queryPath) UnmarshalYAML(node *yaml.Node) error {
	if node.Tag == "!!null" || node.Tag == "!!bool" && node.Value == "false" {
		*path = ""
		return nil
	}
	if node.Kind != yaml.ScalarNode || node.Tag != "!!str" {
		return fmt.Errorf("JSON query path must be a string, false, or null")
	}
	*path = queryPath(node.Value)
	return nil
}

type scalarValue string

func (value *scalarValue) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind != yaml.ScalarNode {
		return fmt.Errorf("JSON engine mapping values must be scalars")
	}
	*value = scalarValue(node.Value)
	return nil
}

type engineSettings struct {
	Engines                []engineSettings       `yaml:"-"`
	Name                   string                 `yaml:"name"`
	Engine                 string                 `yaml:"engine"`
	SearchURL              string                 `yaml:"search_url"`
	LangAll                string                 `yaml:"lang_all"`
	SoftMaxRedirects       int                    `yaml:"soft_max_redirects"`
	Method                 string                 `yaml:"method"`
	RequestBody            string                 `yaml:"request_body"`
	Cookies                map[string]string      `yaml:"cookies"`
	Headers                map[string]string      `yaml:"headers"`
	Paging                 bool                   `yaml:"paging"`
	PageSize               *int                   `yaml:"page_size"`
	FirstPageNum           *int                   `yaml:"first_page_num"`
	SendPageNumOnFirstPage *bool                  `yaml:"send_page_num_on_first_page"`
	TimeRangeSupport       bool                   `yaml:"time_range_support"`
	TimeRangeURL           string                 `yaml:"time_range_url"`
	TimeRangeMap           map[string]scalarValue `yaml:"time_range_map"`
	SafeSearch             bool                   `yaml:"safesearch"`
	SafeSearchMap          map[int]string         `yaml:"safe_search_map"`
	TitleHTMLToText        bool                   `yaml:"title_html_to_text"`
	ContentHTMLToText      bool                   `yaml:"content_html_to_text"`
	NoResultForHTTPStatus  []int                  `yaml:"no_result_for_http_status"`
	ResultsQuery           queryPath              `yaml:"results_query"`
	URLQuery               queryPath              `yaml:"url_query"`
	URLPrefix              string                 `yaml:"url_prefix"`
	TitleQuery             queryPath              `yaml:"title_query"`
	ContentQuery           queryPath              `yaml:"content_query"`
	ThumbnailQuery         queryPath              `yaml:"thumbnail_query"`
	ThumbnailPrefix        string                 `yaml:"thumbnail_prefix"`
	SuggestionQuery        queryPath              `yaml:"suggestion_query"`
}

func loadConfig(reader io.Reader) (engineSettings, error) {
	var root struct {
		Engines []yaml.Node `yaml:"engines"`
	}
	if err := yaml.NewDecoder(reader).Decode(&root); err != nil {
		return engineSettings{}, fmt.Errorf("parse YAML config: %w", err)
	}

	var engines []engineSettings
	for index := range root.Engines {
		var header struct {
			Engine string `yaml:"engine"`
		}
		if err := root.Engines[index].Decode(&header); err != nil || header.Engine != "json_engine" {
			continue
		}

		var settings engineSettings
		if err := root.Engines[index].Decode(&settings); err != nil {
			return engineSettings{}, fmt.Errorf("parse json_engine config: %w", err)
		}
		if err := settings.validate(); err != nil {
			return engineSettings{}, err
		}
		engines = append(engines, settings)
	}
	if len(engines) == 0 {
		return engineSettings{}, errors.New("config has no engine with engine: json_engine")
	}

	settings := engines[0]
	settings.Engines = engines
	return settings, nil
}

func (settings engineSettings) validate() error {
	if strings.TrimSpace(settings.SearchURL) == "" {
		return errors.New("json_engine config requires search_url")
	}
	if settings.URLQuery == "" {
		return errors.New("json_engine config requires url_query")
	}
	if settings.TitleQuery == "" {
		return errors.New("json_engine config requires title_query")
	}

	method := strings.ToUpper(strings.TrimSpace(settings.Method))
	if method != "" && method != "GET" && method != "POST" {
		return fmt.Errorf("json_engine method must be GET or POST")
	}
	if settings.Paging && settings.pageSize() < 1 {
		return errors.New("json_engine page_size must be positive when paging is enabled")
	}

	probeValues := map[string]string{
		"query":          "probe",
		"lang":           "en",
		"pageno":         "1",
		"time_range":     "",
		"safe_search":    "",
		"time_range_val": "",
	}
	formattedURL, err := renderTemplate(settings.SearchURL, probeValues)
	if err != nil {
		return fmt.Errorf("invalid json_engine search_url template: %w", err)
	}
	parsedURL, err := url.Parse(formattedURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" || parsedURL.User != nil {
		return errors.New("json_engine search_url must resolve to an HTTP or HTTPS URL without user credentials")
	}
	if settings.RequestBody != "" {
		if _, err := renderTemplate(settings.RequestBody, probeValues); err != nil {
			return fmt.Errorf("invalid json_engine request_body template: %w", err)
		}
	}
	if settings.TimeRangeURL != "" {
		if _, err := renderTemplate(settings.TimeRangeURL, probeValues); err != nil {
			return fmt.Errorf("invalid json_engine time_range_url template: %w", err)
		}
	}
	return nil
}

func (settings engineSettings) configuredEngines() []engineSettings {
	if len(settings.Engines) > 0 {
		return settings.Engines
	}
	return []engineSettings{settings}
}

func (settings engineSettings) pageSize() int {
	if settings.PageSize == nil {
		return 1
	}
	return *settings.PageSize
}

func (settings engineSettings) firstPageNum() int {
	if settings.FirstPageNum == nil {
		return 1
	}
	return *settings.FirstPageNum
}

func (settings engineSettings) sendPageNumOnFirstPage() bool {
	return settings.SendPageNumOnFirstPage == nil || *settings.SendPageNumOnFirstPage
}

func (settings engineSettings) method() string {
	if strings.TrimSpace(settings.Method) == "" {
		return "GET"
	}
	return strings.ToUpper(strings.TrimSpace(settings.Method))
}

func (settings engineSettings) languageAll() string {
	if settings.LangAll == "" {
		return "en"
	}
	return settings.LangAll
}

func (settings engineSettings) engineName() string {
	if settings.Name == "" {
		return "json_engine"
	}
	return settings.Name
}

func (settings engineSettings) timeRangeValue(value string) string {
	if !settings.TimeRangeSupport {
		return ""
	}
	if mapped, ok := settings.TimeRangeMap[value]; ok {
		return string(mapped)
	}
	if settings.TimeRangeMap != nil {
		return ""
	}
	defaults := map[string]string{
		"day":   "24",
		"week":  "168",
		"month": "720",
		"year":  "8760",
	}
	return defaults[value]
}

func (settings engineSettings) timeRangeURL() string {
	if settings.TimeRangeURL == "" {
		return "&hours={time_range_val}"
	}
	return settings.TimeRangeURL
}

func (settings engineSettings) safeSearchValue(value int) string {
	if !settings.SafeSearch {
		return ""
	}
	if mapped, ok := settings.SafeSearchMap[value]; ok {
		return mapped
	}
	if settings.SafeSearchMap != nil {
		return ""
	}
	defaults := map[int]string{
		0: "&filter=none",
		1: "&filter=moderate",
		2: "&filter=strict",
	}
	return defaults[value]
}
