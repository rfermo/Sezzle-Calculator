package api

import (
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/rfermo/sezzle-calculator/backend/internal/calculator"
)

// Option customises NewRouter.
type Option func(*routerConfig)

type routerConfig struct {
	static http.Handler
}

// WithStaticFiles makes the router serve the files in fsys (the built frontend) for GET and HEAD
// requests that match no API route. Unknown paths outside /api get fsys's index.html.
func WithStaticFiles(fsys fs.FS) Option {
	return func(c *routerConfig) { c.static = staticHandler(fsys) }
}

// NewRouter wires every route and the middleware stack. The logger is outermost so it also
// records requests that panic (as the 500 produced by recoverer).
func NewRouter(logger *slog.Logger, opts ...Option) http.Handler {
	var cfg routerConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("POST /api/v1/add", handleBinary(calculator.Add))
	mux.HandleFunc("POST /api/v1/subtract", handleBinary(calculator.Subtract))
	mux.HandleFunc("POST /api/v1/multiply", handleBinary(calculator.Multiply))
	mux.HandleFunc("POST /api/v1/divide", handleBinary(calculator.Divide))
	mux.HandleFunc("POST /api/v1/power", handleBinary(calculator.Power))
	mux.HandleFunc("POST /api/v1/sqrt", handleUnary(calculator.Sqrt))
	mux.HandleFunc("POST /api/v1/percentage", handleBinary(calculator.Percentage))
	return requestLogger(logger, recoverer(logger, jsonErrors(mux, cfg.static)))
}

// jsonErrors replaces the mux's plain-text 404 and 405 responses with the JSON error envelope.
// The mux stays the source of truth for which of the two applies (and for the Allow header), so
// this keeps working as routes are added.
//
// static, when set, takes the page requests that match no route. It is a fallback here rather than
// a "GET /" mux route because a catch-all would swallow the mux's 405s for wrong-method API calls.
func jsonErrors(mux *http.ServeMux, static http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler, pattern := mux.Handler(r)
		if pattern != "" {
			handler.ServeHTTP(w, r)
			return
		}
		if static != nil && isPageRequest(r) {
			static.ServeHTTP(w, r)
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
