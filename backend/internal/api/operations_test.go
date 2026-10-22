package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func postRequest(target, body, contentType string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, target, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return req
}

func postJSON(handler http.Handler, target, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, postRequest(target, body, "application/json"))
	return rec
}

func TestAddReturnsSum(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"integers", `{"a": 2, "b": 3}`, 5},
		{"negative result", `{"a": 2, "b": -5}`, -3},
		{"decimals", `{"a": 1.5, "b": 2.25}`, 3.75},
		{"explicit zeros are valid operands", `{"a": 0, "b": 0}`, 0},
		{"field order does not matter", `{"b": 3, "a": 2}`, 5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/add", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			var body resultResponse
			dec := json.NewDecoder(rec.Body)
			dec.DisallowUnknownFields()
			if err := dec.Decode(&body); err != nil {
				t.Fatalf("body is not a result response: %v", err)
			}
			if body.Result != tt.want {
				t.Errorf("result = %v, want %v", body.Result, tt.want)
			}
		})
	}
}

func TestAddRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		wantMessage string
	}{
		{"missing a", `{"b": 3}`, `field "a" is required`},
		{"missing b", `{"a": 2}`, `field "b" is required`},
		{"empty object", `{}`, `field "a" is required`},
		{"null a", `{"a": null, "b": 3}`, `field "a" is required`},
		{"null b", `{"a": 2, "b": null}`, `field "b" is required`},
		{"string operand", `{"a": "2", "b": 3}`, `field "a" has an invalid type`},
		{"boolean operand", `{"a": 2, "b": true}`, `field "b" has an invalid type`},
		{"unknown field", `{"a": 2, "b": 3, "c": 4}`, `unknown field "c"`},
		{"malformed JSON", `{"a": 2,`, "request body is not valid JSON"},
		{"number beyond float64 range", `{"a": 1e999, "b": 3}`, `field "a" has an invalid type`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/add", tt.body)

			detail := assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
			if detail.Message != tt.wantMessage {
				t.Errorf("message = %q, want %q", detail.Message, tt.wantMessage)
			}
		})
	}
}

func TestAddRejectsWrongContentType(t *testing.T) {
	rec := httptest.NewRecorder()

	NewRouter(discardLogger()).ServeHTTP(rec, postRequest("/api/v1/add", `{"a": 2, "b": 3}`, "text/plain"))

	assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
}

func TestAddReportsOverflowAsUnprocessable(t *testing.T) {
	for _, body := range []string{
		`{"a": 1.7976931348623157e308, "b": 1.7976931348623157e308}`,
		`{"a": -1.7976931348623157e308, "b": -1.7976931348623157e308}`,
	} {
		t.Run(body, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/add", body)

			assertErrorEnvelope(t, rec, http.StatusUnprocessableEntity, codeResultNotFinite)
		})
	}
}

func TestAddRejectsWrongMethod(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		t.Run(method, func(t *testing.T) {
			rec := serveRequest(NewRouter(discardLogger()), method, "/api/v1/add")

			assertErrorEnvelope(t, rec, http.StatusMethodNotAllowed, codeMethodNotAllowed)
			if allow := rec.Header().Get("Allow"); !strings.Contains(allow, http.MethodPost) {
				t.Errorf("Allow = %q, want it to list POST", allow)
			}
		})
	}
}

func TestDivideReturnsQuotient(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"exact quotient", `{"a": 6, "b": 3}`, 2},
		{"fractional result", `{"a": 1, "b": 4}`, 0.25},
		{"negative result", `{"a": -6, "b": 3}`, -2},
		{"zero dividend", `{"a": 0, "b": 5}`, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/divide", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
			}
			var body resultResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("body is not a result response: %v", err)
			}
			if body.Result != tt.want {
				t.Errorf("result = %v, want %v", body.Result, tt.want)
			}
		})
	}
}

func TestDivideReportsDivisionByZeroAsUnprocessable(t *testing.T) {
	for _, body := range []string{
		`{"a": 1, "b": 0}`,
		`{"a": 1, "b": -0}`,
		`{"a": 1, "b": 0.0}`,
		`{"a": 0, "b": 0}`,
	} {
		t.Run(body, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/divide", body)

			detail := assertErrorEnvelope(t, rec, http.StatusUnprocessableEntity, codeDivisionByZero)
			if detail.Message != "division by zero" {
				t.Errorf("message = %q, want %q", detail.Message, "division by zero")
			}
		})
	}
}

func TestDivideReportsOverflowAsUnprocessable(t *testing.T) {
	rec := postJSON(NewRouter(discardLogger()), "/api/v1/divide", `{"a": 1.7976931348623157e308, "b": 0.5}`)

	assertErrorEnvelope(t, rec, http.StatusUnprocessableEntity, codeResultNotFinite)
}

func TestDivideRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		wantMessage string
	}{
		{"missing a", `{"b": 3}`, `field "a" is required`},
		{"missing b", `{"a": 2}`, `field "b" is required`},
		{"string operand", `{"a": 2, "b": "3"}`, `field "b" has an invalid type`},
		{"unknown field", `{"a": 2, "b": 3, "c": 4}`, `unknown field "c"`},
		{"malformed JSON", `{"a": 2,`, "request body is not valid JSON"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/divide", tt.body)

			detail := assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
			if detail.Message != tt.wantMessage {
				t.Errorf("message = %q, want %q", detail.Message, tt.wantMessage)
			}
		})
	}
}

func TestDivideRejectsWrongMethod(t *testing.T) {
	rec := serveRequest(NewRouter(discardLogger()), http.MethodGet, "/api/v1/divide")

	assertErrorEnvelope(t, rec, http.StatusMethodNotAllowed, codeMethodNotAllowed)
	if allow := rec.Header().Get("Allow"); !strings.Contains(allow, http.MethodPost) {
		t.Errorf("Allow = %q, want it to list POST", allow)
	}
}

func TestHandleBinaryHidesUnexpectedErrors(t *testing.T) {
	handler := handleBinary(func(float64, float64) (float64, error) {
		return 0, errors.New("database password is hunter2")
	})

	rec := postJSON(handler, "/", `{"a": 1, "b": 2}`)

	detail := assertErrorEnvelope(t, rec, http.StatusInternalServerError, codeInternal)
	if strings.Contains(detail.Message, "hunter2") {
		t.Errorf("message %q leaks the underlying error", detail.Message)
	}
}
