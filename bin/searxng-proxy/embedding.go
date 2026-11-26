package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"unicode"
)

type embeddingRequest struct {
	Input []string `json:"input"`
}

type embeddingResponse struct {
	Data []struct {
		Index     *int      `json:"index"`
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
}

type rankedResult struct {
	index int
	score float64
}

func rerankResults(ctx context.Context, client *http.Client, settings embeddingSettings, query string, results []searchResult) []searchResult {
	if strings.TrimSpace(settings.LMHost) == "" || len(results) < 2 {
		return results
	}

	texts := []string{truncateTokens(strings.TrimSpace(settings.LMQueryPrefix + query))}
	validIndices := make([]int, 0, len(results))
	for index, result := range results {
		host := resultHost(result.URL)
		text := truncateTokens(strings.TrimSpace(settings.LMDocPrefix + result.Title + " " + host + "\n" + result.Content))
		if text == "" {
			continue
		}
		texts = append(texts, text)
		validIndices = append(validIndices, index)
	}
	if len(validIndices) < 2 {
		return results
	}

	embeddings, err := fetchEmbeddings(ctx, client, settings.LMHost, texts)
	if err != nil {
		logEmbeddingFailure(err)
		return results
	}
	if len(embeddings) != len(texts) {
		logEmbeddingFailure(fmt.Errorf("embedding API returned %d vectors, expected %d", len(embeddings), len(texts)))
		return results
	}

	queryEmbedding := embeddings[0]
	queryNorm := vectorNorm(queryEmbedding)
	ranked := make([]rankedResult, len(validIndices))
	for index, embedding := range embeddings[1:] {
		dot := 0.0
		for dimension, value := range embedding {
			dot += queryEmbedding[dimension] * value
		}
		norm := vectorNorm(embedding)
		score := 0.0
		if queryNorm != 0 && norm != 0 {
			score = dot / (queryNorm * norm)
		}
		ranked[index] = rankedResult{index: validIndices[index], score: score}
	}
	sort.SliceStable(ranked, func(left, right int) bool {
		return ranked[left].score > ranked[right].score
	})

	reranked := make([]searchResult, 0, len(results))
	for _, result := range ranked {
		reranked = append(reranked, results[result.index])
	}
	for index, result := range results {
		if !containsIndex(validIndices, index) {
			reranked = append(reranked, result)
		}
	}
	return reranked
}

func fetchEmbeddings(ctx context.Context, client *http.Client, host string, texts []string) ([][]float64, error) {
	endpoint, err := embeddingEndpoint(host)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(embeddingRequest{Input: texts})
	if err != nil {
		return nil, fmt.Errorf("encode embedding request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create embedding request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("send embedding request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("embedding API returned HTTP %d", response.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read embedding response: %w", err)
	}
	if len(responseBody) > maxUpstreamBodyBytes {
		return nil, errors.New("embedding response exceeded size limit")
	}

	var parsed embeddingResponse
	if err := json.Unmarshal(responseBody, &parsed); err != nil {
		return nil, fmt.Errorf("decode embedding response: %w", err)
	}
	if len(parsed.Data) != len(texts) {
		return nil, fmt.Errorf("embedding API returned %d vectors, expected %d", len(parsed.Data), len(texts))
	}
	embeddings := make([][]float64, len(texts))
	for position, item := range parsed.Data {
		index := position
		if item.Index != nil {
			index = *item.Index
		}
		if index < 0 || index >= len(embeddings) || embeddings[index] != nil {
			return nil, errors.New("embedding API returned invalid vector indexes")
		}
		embeddings[index] = item.Embedding
	}
	if len(embeddings[0]) == 0 {
		return nil, errors.New("embedding API returned an empty vector")
	}
	for _, embedding := range embeddings {
		if len(embedding) != len(embeddings[0]) {
			return nil, errors.New("embedding API returned vectors with different dimensions")
		}
	}
	return embeddings, nil
}

func embeddingEndpoint(host string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(host))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("embedding lm_host must be an HTTP or HTTPS URL without credentials, query, or fragment")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if !strings.HasSuffix(parsed.Path, "/v1/embeddings") {
		parsed.Path += "/v1/embeddings"
	}
	parsed.RawPath = ""
	return parsed.String(), nil
}

func resultHost(value string) string {
	parsed, err := url.Parse(value)
	if err != nil {
		return ""
	}
	return parsed.Hostname()
}

func truncateTokens(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	const maxQuarterTokens = 512 * 4
	quarterTokens := 0
	byteOffset := 0
	lastSpace := -1
	cutoff := -1
	for _, character := range text {
		characterSize := len(string(character))
		if unicode.IsSpace(character) {
			lastSpace = byteOffset
		}
		cost := 1
		if unicode.In(character, unicode.Han, unicode.Hiragana, unicode.Katakana, unicode.Hangul, unicode.Bopomofo) {
			cost = 4
		}
		if quarterTokens+cost > maxQuarterTokens {
			cutoff = byteOffset
			break
		}
		quarterTokens += cost
		byteOffset += characterSize
	}
	if cutoff < 0 {
		return text
	}
	if lastSpace >= 0 {
		cutoff = lastSpace
	}
	return strings.TrimSpace(text[:cutoff])
}

func vectorNorm(vector []float64) float64 {
	sum := 0.0
	for _, value := range vector {
		sum += value * value
	}
	return math.Sqrt(sum)
}

func containsIndex(indices []int, target int) bool {
	for _, index := range indices {
		if index == target {
			return true
		}
	}
	return false
}

func logEmbeddingFailure(err error) {
	log.Printf("embedding reranking failed: %v", err)
}
