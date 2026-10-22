// Package api holds the HTTP layer: routing, middleware, and the JSON request/response helpers
// shared by every endpoint.
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes returned in the error envelope. Domain-specific codes (e.g. division_by_zero)
// are added alongside the operations that produce them.
const (
	codeInvalidRequest   = "invalid_request"
	codeNotFound         = "not_found"
	codeMethodNotAllowed = "method_not_allowed"
	codeInternal         = "internal_error"
)

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// writeJSON marshals before writing anything so an encoding failure can still become a clean 500
// instead of a truncated 2xx body.
func writeJSON(w http.ResponseWriter, status int, body any) {
	payload, err := json.Marshal(body)
	if err != nil {
		slog.Error("encode response", "error", err)
		writeError(w, http.StatusInternalServerError, codeInternal, "internal server error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// A write error means the client went away; there is nobody left to tell.
	_, _ = w.Write(append(payload, '\n'))
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorBody{Error: errorDetail{Code: code, Message: message}})
}
