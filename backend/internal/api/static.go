package api

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

const indexPage = "index.html"

// staticHandler serves files from fsys. A path that is not a file gets index.html, so the app
// loads from any URL the browser lands on.
func staticHandler(fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Cleaning against a rooted path stops ".." from climbing out of fsys.
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if !isFile(fsys, name) {
			name = indexPage
		}
		http.ServeFileFS(w, r, fsys, name)
	})
}

func isFile(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}

// isPageRequest reports whether r is a request a browser makes to load a page: GET or HEAD
// outside /api.
func isPageRequest(r *http.Request) bool {
	return (r.Method == http.MethodGet || r.Method == http.MethodHead) && !isAPIPath(r.URL.Path)
}

// isAPIPath reports whether p is under /api. Those paths must keep the JSON 404/405 responses
// instead of falling back to the HTML page.
func isAPIPath(p string) bool {
	return p == "/api" || strings.HasPrefix(p, "/api/")
}
