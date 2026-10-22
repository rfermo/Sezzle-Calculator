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

// binaryEndpoints are the routes served by handleBinary. Request validation is shared, so its
// tests run against each of them to catch an operation wired up without it.
var binaryEndpoints = []string{"add", "subtract"}

func assertResult(t *testing.T, handler http.Handler, target, body string, want float64) {
	t.Helper()
	rec := postJSON(handler, target, body)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	var resp resultResponse
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&resp); err != nil {
		t.Fatalf("body is not a result response: %v", err)
	}
	if resp.Result != want {
		t.Errorf("result = %v, want %v", resp.Result, want)
	}
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
			assertResult(t, NewRouter(discardLogger()), "/api/v1/add", tt.body, tt.want)
		})
	}
}

func TestSubtractReturnsDifference(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"integers", `{"a": 8, "b": 5}`, 3},
		{"negative result", `{"a": 5, "b": 8}`, -3},
		{"decimals", `{"a": 3.75, "b": 1.25}`, 2.5},
		{"explicit zeros are valid operands", `{"a": 0, "b": 0}`, 0},
		{"field order does not matter", `{"b": 5, "a": 8}`, 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertResult(t, NewRouter(discardLogger()), "/api/v1/subtract", tt.body, tt.want)
		})
	}
}

func TestBinaryEndpointsRejectInvalidRequests(t *testing.T) {
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
	for _, endpoint := range binaryEndpoints {
		for _, tt := range tests {
			t.Run(endpoint+"/"+tt.name, func(t *testing.T) {
				rec := postJSON(NewRouter(discardLogger()), "/api/v1/"+endpoint, tt.body)

				detail := assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
				if detail.Message != tt.wantMessage {
					t.Errorf("message = %q, want %q", detail.Message, tt.wantMessage)
				}
			})
		}
	}
}

func TestBinaryEndpointsRejectWrongContentType(t *testing.T) {
	for _, endpoint := range binaryEndpoints {
		t.Run(endpoint, func(t *testing.T) {
			rec := httptest.NewRecorder()

			NewRouter(discardLogger()).ServeHTTP(rec, postRequest("/api/v1/"+endpoint, `{"a": 2, "b": 3}`, "text/plain"))

			assertErrorEnvelope(t, rec, http.StatusBadRequest, codeInvalidRequest)
		})
	}
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

func TestSubtractReportsOverflowAsUnprocessable(t *testing.T) {
	for _, body := range []string{
		`{"a": 1.7976931348623157e308, "b": -1.7976931348623157e308}`,
		`{"a": -1.7976931348623157e308, "b": 1.7976931348623157e308}`,
	} {
		t.Run(body, func(t *testing.T) {
			rec := postJSON(NewRouter(discardLogger()), "/api/v1/subtract", body)

			assertErrorEnvelope(t, rec, http.StatusUnprocessableEntity, codeResultNotFinite)
		})
	}
}

func TestBinaryEndpointsRejectWrongMethod(t *testing.T) {
	for _, endpoint := range binaryEndpoints {
		for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPatch} {
			t.Run(endpoint+"/"+method, func(t *testing.T) {
				rec := serveRequest(NewRouter(discardLogger()), method, "/api/v1/"+endpoint)

				assertErrorEnvelope(t, rec, http.StatusMethodNotAllowed, codeMethodNotAllowed)
				if allow := rec.Header().Get("Allow"); !strings.Contains(allow, http.MethodPost) {
					t.Errorf("Allow = %q, want it to list POST", allow)
				}
			})
		}
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
