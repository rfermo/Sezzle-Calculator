package main

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rfermo/sezzle-calculator/backend/internal/api"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestListenAddr(t *testing.T) {
	tests := []struct {
		name    string
		port    string
		want    string
		wantErr bool
	}{
		{"defaults when unset", "", ":8080", false},
		{"custom port", "9000", ":9000", false},
		{"lowest port", "1", ":1", false},
		{"highest port", "65535", ":65535", false},
		{"not a number", "abc", "", true},
		{"zero", "0", "", true},
		{"too large", "65536", "", true},
		{"negative", "-1", "", true},
		{"has host", "localhost:80", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := listenAddr(tt.port)

			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("addr = %q, want %q", got, tt.want)
			}
		})
	}
}

func freePort(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	return port
}

// portEnv is a getenv that sets only PORT, so the other settings keep their defaults.
func portEnv(port string) func(string) string {
	return func(key string) string {
		if key == "PORT" {
			return port
		}
		return ""
	}
}

func TestRunRejectsInvalidPort(t *testing.T) {
	getenv := portEnv("not-a-port")

	if err := run(context.Background(), getenv, discardLogger()); err == nil {
		t.Fatal("run accepted an invalid PORT")
	}
}

func TestRunFailsWhenPortIsTaken(t *testing.T) {
	taken, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	_, port, _ := net.SplitHostPort(taken.Addr().String())

	err = run(context.Background(), portEnv(port), discardLogger())

	if err == nil {
		t.Fatal("run succeeded on a port that is already in use")
	}
}

func TestRunServesOnConfiguredPort(t *testing.T) {
	port := freePort(t)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- run(ctx, portEnv(port), discardLogger()) }()

	var resp *http.Response
	var err error
	for range 50 {
		if resp, err = http.Get("http://127.0.0.1:" + port + "/healthz"); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("server never became reachable: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	cancel()
	if err := <-done; err != nil {
		t.Errorf("run returned %v after shutdown, want nil", err)
	}
}

func TestServeServesUntilContextCancelledThenShutsDownCleanly(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	logger := discardLogger()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- serve(ctx, ln, api.NewRouter(logger), logger) }()

	resp, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("serve returned %v after shutdown, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serve did not return after context cancellation")
	}
}

func TestServeReturnsListenerFailure(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ln.Close()

	err = serve(context.Background(), ln, http.NotFoundHandler(), discardLogger())

	if err == nil {
		t.Fatal("serve returned nil for a closed listener")
	}
}

func writeIndex(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestStaticOptions(t *testing.T) {
	t.Run("empty dir adds no options", func(t *testing.T) {
		opts, err := staticOptions("")

		if err != nil || len(opts) != 0 {
			t.Errorf("staticOptions(\"\") = %v, %v; want no options and no error", opts, err)
		}
	})

	t.Run("dir with index.html adds the static option", func(t *testing.T) {
		opts, err := staticOptions(writeIndex(t, "<html></html>"))

		if err != nil || len(opts) != 1 {
			t.Errorf("staticOptions = %v, %v; want one option and no error", opts, err)
		}
	})

	t.Run("dir without index.html is rejected", func(t *testing.T) {
		if _, err := staticOptions(t.TempDir()); err == nil {
			t.Error("staticOptions accepted a dir with no index.html")
		}
	})

	t.Run("missing dir is rejected", func(t *testing.T) {
		if _, err := staticOptions(filepath.Join(t.TempDir(), "absent")); err == nil {
			t.Error("staticOptions accepted a dir that does not exist")
		}
	})
}

func TestRunRejectsInvalidStaticDir(t *testing.T) {
	getenv := func(key string) string {
		if key == "STATIC_DIR" {
			return t.TempDir()
		}
		return ""
	}

	if err := run(context.Background(), getenv, discardLogger()); err == nil {
		t.Fatal("run accepted a STATIC_DIR with no index.html")
	}
}

func TestRunServesFrontendFromStaticDir(t *testing.T) {
	port := freePort(t)
	staticDir := writeIndex(t, "<html>calculator</html>")
	getenv := func(key string) string {
		switch key {
		case "PORT":
			return port
		case "STATIC_DIR":
			return staticDir
		}
		return ""
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- run(ctx, getenv, discardLogger()) }()

	var body []byte
	var err error
	for range 50 {
		var resp *http.Response
		if resp, err = http.Get("http://127.0.0.1:" + port + "/"); err == nil {
			body, _ = io.ReadAll(resp.Body)
			resp.Body.Close()
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("server never became reachable: %v", err)
	}
	if string(body) != "<html>calculator</html>" {
		t.Errorf("GET / body = %q, want the index.html contents", body)
	}

	cancel()
	if err := <-done; err != nil {
		t.Errorf("run returned %v after shutdown, want nil", err)
	}
}
