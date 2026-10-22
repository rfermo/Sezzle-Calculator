package api

import (
	"net/http"
	"strings"
	"testing"
	"testing/fstest"
)

const (
	indexHTML = "<!doctype html><title>Calculator</title>"
	assetJS   = "console.log('app')"
)

func staticRouter() http.Handler {
	fsys := fstest.MapFS{
		"index.html":    {Data: []byte(indexHTML)},
		"assets/app.js": {Data: []byte(assetJS)},
	}
	return NewRouter(discardLogger(), WithStaticFiles(fsys))
}

func TestStaticServesFiles(t *testing.T) {
	tests := []struct {
		name     string
		target   string
		wantBody string
	}{
		{"index at root", "/", indexHTML},
		{"asset", "/assets/app.js", assetJS},
		{"unknown path falls back to index", "/some/client/route", indexHTML},
		{"missing asset falls back to index", "/assets/missing.js", indexHTML},
		{"directory falls back to index", "/assets/", indexHTML},
		{"unknown path that looks like healthz", "/healthz/extra", indexHTML},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serveRequest(staticRouter(), http.MethodGet, tt.target)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
			}
			if got := rec.Body.String(); got != tt.wantBody {
				t.Errorf("body = %q, want %q", got, tt.wantBody)
			}
		})
	}
}

func TestStaticRejectsDotDotPaths(t *testing.T) {
	rec := serveRequest(staticRouter(), http.MethodGet, "/../../etc/passwd")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestStaticSetsContentType(t *testing.T) {
	tests := []struct {
		target string
		want   string
	}{
		{"/", "text/html"},
		{"/assets/app.js", "text/javascript"},
	}
	for _, tt := range tests {
		t.Run(tt.target, func(t *testing.T) {
			rec := serveRequest(staticRouter(), http.MethodGet, tt.target)

			if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, tt.want) {
				t.Errorf("Content-Type = %q, want prefix %q", got, tt.want)
			}
		})
	}
}

func TestStaticAnswersHead(t *testing.T) {
	rec := serveRequest(staticRouter(), http.MethodHead, "/")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("HEAD body = %q, want empty", rec.Body.String())
	}
}

func TestStaticKeepsJSONErrorsForAPIPaths(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		target     string
		wantStatus int
		wantCode   string
	}{
		{"unknown API path", http.MethodGet, "/api/v1/unknown", http.StatusNotFound, codeNotFound},
		{"API root", http.MethodGet, "/api", http.StatusNotFound, codeNotFound},
		{"API prefix with trailing slash", http.MethodGet, "/api/", http.StatusNotFound, codeNotFound},
		{"wrong method on an API route", http.MethodGet, "/api/v1/add", http.StatusMethodNotAllowed, codeMethodNotAllowed},
		{"wrong method on healthz", http.MethodPost, "/healthz", http.StatusMethodNotAllowed, codeMethodNotAllowed},
		{"POST to a page path", http.MethodPost, "/some/page", http.StatusNotFound, codeNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serveRequest(staticRouter(), tt.method, tt.target)

			assertErrorEnvelope(t, rec, tt.wantStatus, tt.wantCode)
		})
	}
}

func TestStaticDoesNotShadowRoutes(t *testing.T) {
	rec := serveRequest(staticRouter(), http.MethodGet, "/healthz")

	if got, want := strings.TrimSpace(rec.Body.String()), `{"status":"ok"}`; got != want {
		t.Errorf("body = %s, want %s", got, want)
	}
}

func TestStaticWithoutIndexReturnsNotFound(t *testing.T) {
	router := NewRouter(discardLogger(), WithStaticFiles(fstest.MapFS{}))

	rec := serveRequest(router, http.MethodGet, "/")

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}
