package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func bufferLogger() (*slog.Logger, *bytes.Buffer) {
	var buf bytes.Buffer
	return slog.New(slog.NewTextHandler(&buf, nil)), &buf
}

// assertErrorEnvelope checks the status, content type and {"error":{"code","message"}} shape.
func assertErrorEnvelope(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantCode string) errorDetail {
	t.Helper()
	if rec.Code != wantStatus {
		t.Fatalf("status = %d, want %d (body %q)", rec.Code, wantStatus, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	var body errorBody
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		t.Fatalf("body is not the error envelope: %v", err)
	}
	if body.Error.Code != wantCode {
		t.Errorf("code = %q, want %q", body.Error.Code, wantCode)
	}
	if body.Error.Message == "" {
		t.Error("message is empty")
	}
	return body.Error
}

func serveRequest(handler http.Handler, method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestHealth(t *testing.T) {
	rec := serveRequest(NewRouter(discardLogger()), http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	if got, want := strings.TrimSpace(rec.Body.String()), `{"status":"ok"}`; got != want {
		t.Errorf("body = %s, want %s", got, want)
	}
}

func TestWriteError(t *testing.T) {
	rec := httptest.NewRecorder()

	writeError(rec, http.StatusUnprocessableEntity, "division_by_zero", "cannot divide by zero")

	detail := assertErrorEnvelope(t, rec, http.StatusUnprocessableEntity, "division_by_zero")
	if detail.Message != "cannot divide by zero" {
		t.Errorf("message = %q", detail.Message)
	}
}

func TestWriteJSONEncodingFailureReturns500(t *testing.T) {
	rec := httptest.NewRecorder()

	writeJSON(rec, http.StatusOK, make(chan int))

	assertErrorEnvelope(t, rec, http.StatusInternalServerError, codeInternal)
}

func TestNotFound(t *testing.T) {
	for _, target := range []string{"/", "/nope", "/api/v1/unknown", "/healthz/extra"} {
		t.Run(target, func(t *testing.T) {
			rec := serveRequest(NewRouter(discardLogger()), http.MethodGet, target)

			assertErrorEnvelope(t, rec, http.StatusNotFound, codeNotFound)
		})
	}
}

func TestMethodNotAllowed(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		t.Run(method, func(t *testing.T) {
			rec := serveRequest(NewRouter(discardLogger()), method, "/healthz")

			assertErrorEnvelope(t, rec, http.StatusMethodNotAllowed, codeMethodNotAllowed)
			if allow := rec.Header().Get("Allow"); !strings.Contains(allow, http.MethodGet) {
				t.Errorf("Allow = %q, want it to list GET", allow)
			}
		})
	}
}

func TestRequestLoggerRecordsRequest(t *testing.T) {
	logger, logs := bufferLogger()

	serveRequest(NewRouter(logger), http.MethodGet, "/healthz?secret=1")

	for _, want := range []string{"method=GET", "path=/healthz", "status=200"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q is missing %q", logs.String(), want)
		}
	}
	if strings.Contains(logs.String(), "secret") {
		t.Errorf("log %q must not include the query string", logs.String())
	}
}

func TestStatusRecorderUnwrapsForResponseController(t *testing.T) {
	rec := httptest.NewRecorder()
	wrapped := &statusRecorder{ResponseWriter: rec, status: http.StatusOK}

	if err := http.NewResponseController(wrapped).Flush(); err != nil {
		t.Fatalf("Flush through the wrapper failed: %v", err)
	}
	if !rec.Flushed {
		t.Error("flush did not reach the underlying writer")
	}
}

func TestRecovererTurnsPanicInto500(t *testing.T) {
	logger, logs := bufferLogger()
	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	handler := requestLogger(logger, recoverer(logger, panicking))

	rec := serveRequest(handler, http.MethodGet, "/")

	assertErrorEnvelope(t, rec, http.StatusInternalServerError, codeInternal)
	if body := rec.Body.String(); strings.Contains(body, "boom") {
		t.Errorf("body %q leaks the panic value", body)
	}
	for _, want := range []string{"panic recovered", "boom", "status=500"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q is missing %q", logs.String(), want)
		}
	}
}

func TestRecovererKeepsServingAfterPanic(t *testing.T) {
	logger := discardLogger()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /panic", func(http.ResponseWriter, *http.Request) { panic("boom") })
	mux.HandleFunc("GET /healthz", handleHealth)
	handler := recoverer(logger, mux)

	serveRequest(handler, http.MethodGet, "/panic")
	rec := serveRequest(handler, http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Errorf("status after panic = %d, want 200", rec.Code)
	}
}

func TestRecovererRepanicsOnErrAbortHandler(t *testing.T) {
	aborting := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) })
	handler := recoverer(discardLogger(), aborting)

	defer func() {
		if rv := recover(); rv != http.ErrAbortHandler {
			t.Errorf("recovered %v, want http.ErrAbortHandler", rv)
		}
	}()
	serveRequest(handler, http.MethodGet, "/")
}
