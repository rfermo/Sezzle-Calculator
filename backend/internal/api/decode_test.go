package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type operandsRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

func jsonRequest(body, contentType string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return req
}

func TestDecodeJSONRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		contentType string
		wantMessage string
	}{
		{"malformed JSON", `{"a": 1,`, "application/json", "request body is not valid JSON"},
		{"not JSON at all", `hello`, "application/json", "request body is not valid JSON"},
		{"empty body", ``, "application/json", "request body must not be empty"},
		{"unknown field", `{"a": 1, "c": 2}`, "application/json", `unknown field "c"`},
		{"wrong field type", `{"a": "1"}`, "application/json", `field "a" has an invalid type`},
		{"array instead of object", `[1, 2]`, "application/json", "request body must be a JSON object"},
		{"trailing second object", `{"a": 1}{"b": 2}`, "application/json", "request body must contain a single JSON object"},
		{"trailing garbage", `{"a": 1} xyz`, "application/json", "request body is not valid JSON"},
		{"oversized body", `{"a": ` + strings.Repeat("1", 2*maxBodyBytes) + `}`, "application/json", "request body must not exceed 1024 bytes"},
		{"missing content type", `{"a": 1}`, "", "Content-Type must be application/json"},
		{"wrong content type", `{"a": 1}`, "text/plain", "Content-Type must be application/json"},
		{"malformed content type", `{"a": 1}`, "application/json; =", "Content-Type must be application/json"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			var dst operandsRequest

			ok := decodeJSON(rec, jsonRequest(tt.body, tt.contentType), &dst)

			if ok {
				t.Fatal("decodeJSON reported success")
			}
			detail := assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
			if detail.Message != tt.wantMessage {
				t.Errorf("message = %q, want %q", detail.Message, tt.wantMessage)
			}
		})
	}
}

func TestDecodeJSONAcceptsValidRequests(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		contentType string
		wantA       *float64
		wantB       *float64
	}{
		{"both fields", `{"a": 1.5, "b": -2}`, "application/json", ptr(1.5), ptr(-2)},
		{"zero is not missing", `{"a": 0}`, "application/json", ptr(0), nil},
		{"absent field stays nil", `{"b": 3}`, "application/json", nil, ptr(3)},
		{"null field stays nil", `{"a": null, "b": 3}`, "application/json", nil, ptr(3)},
		{"charset parameter", `{"a": 1}`, "application/json; charset=utf-8", ptr(1), nil},
		{"trailing whitespace", "{\"a\": 1}\n  ", "application/json", ptr(1), nil},
		{"content type is case-insensitive", `{"a": 1}`, "Application/JSON", ptr(1), nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			var dst operandsRequest

			ok := decodeJSON(rec, jsonRequest(tt.body, tt.contentType), &dst)

			if !ok {
				t.Fatalf("decodeJSON failed: %s", rec.Body.String())
			}
			if rec.Body.Len() != 0 {
				t.Errorf("wrote a response on success: %s", rec.Body.String())
			}
			assertOperand(t, "a", dst.A, tt.wantA)
			assertOperand(t, "b", dst.B, tt.wantB)
		})
	}
}

func TestDescribeDecodeErrorFallsBackForUnexpectedErrors(t *testing.T) {
	if got, want := describeDecodeError(errors.New("something else")), "request body is invalid"; got != want {
		t.Errorf("message = %q, want %q", got, want)
	}
}

func ptr(f float64) *float64 { return &f }

func assertOperand(t *testing.T, name string, got, want *float64) {
	t.Helper()
	switch {
	case got == nil && want == nil:
	case got == nil || want == nil:
		t.Errorf("%s = %v, want %v", name, got, want)
	case *got != *want:
		t.Errorf("%s = %v, want %v", name, *got, *want)
	}
}
