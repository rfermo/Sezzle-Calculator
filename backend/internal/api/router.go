package api

import (
	"log/slog"
	"net/http"
)

// NewRouter wires every route and the middleware stack. The logger is outermost so it also
// records requests that panic (as the 500 produced by recoverer).
func NewRouter(logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	return requestLogger(logger, recoverer(logger, jsonErrors(mux)))
}

// jsonErrors replaces the mux's plain-text 404 and 405 responses with the JSON error envelope.
// The mux stays the source of truth for which of the two applies (and for the Allow header), so
// this keeps working as routes are added.
func jsonErrors(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler, pattern := mux.Handler(r)
		if pattern != "" {
			handler.ServeHTTP(w, r)
			return
		}

		// No route matched, so handler is the mux's built-in 404 or 405 responder. Run it against
		// a probe to learn which, without letting its text body reach the client.
		probe := &probeWriter{header: http.Header{}}
		handler.ServeHTTP(probe, r)
		if probe.status == http.StatusMethodNotAllowed {
			w.Header().Set("Allow", probe.header.Get("Allow"))
			writeError(w, http.StatusMethodNotAllowed, codeMethodNotAllowed, "method not allowed")
			return
		}
		writeError(w, http.StatusNotFound, codeNotFound, "resource not found")
	})
}

// probeWriter captures a status code and headers and discards the body.
type probeWriter struct {
	header http.Header
	status int
}

func (p *probeWriter) Header() http.Header         { return p.header }
func (p *probeWriter) Write(b []byte) (int, error) { return len(b), nil }
func (p *probeWriter) WriteHeader(status int)      { p.status = status }
