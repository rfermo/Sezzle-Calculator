package api

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// statusRecorder remembers the status code so the logging middleware can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (s *statusRecorder) Unwrap() http.ResponseWriter {
	return s.ResponseWriter
}

// requestLogger logs one line per request. Only the path is logged, not the query string.
func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration", time.Since(start),
		)
	})
}

// recoverer turns a handler panic into a logged 500 JSON response. net/http would otherwise
// recover it itself but drop the connection with no body, which clients can't tell from a network failure.
func recoverer(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rv := recover()
			if rv == nil {
				return
			}
			if rv == http.ErrAbortHandler {
				// net/http's documented way to abort a response; it must keep propagating.
				panic(rv)
			}
			logger.Error("panic recovered", "panic", rv, "stack", string(debug.Stack()))
			writeError(w, http.StatusInternalServerError, codeInternal, "internal server error")
		}()
		next.ServeHTTP(w, r)
	})
}
