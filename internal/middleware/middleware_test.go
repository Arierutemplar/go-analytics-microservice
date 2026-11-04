package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func ok(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }

func TestRateLimitPerIP(t *testing.T) {
	stop := make(chan struct{})
	defer close(stop)
	h := NewRateLimiter(0.001, 2, stop).Limit(ok)

	do := func(addr string) int {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = addr
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec.Code
	}

	if do("1.1.1.1:1") != 200 || do("1.1.1.1:2") != 200 {
		t.Fatal("la ráfaga debería pasar")
	}
	if do("1.1.1.1:3") != http.StatusTooManyRequests {
		t.Fatal("debería limitar")
	}
	if do("2.2.2.2:1") != 200 {
		t.Fatal("otra IP no debe verse afectada")
	}
}

func TestAPIKey(t *testing.T) {
	h := APIKeyFunc("secret")(ok)
	cases := map[string]int{"": 401, "bad": 401, "secret": 200}
	for key, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		if key != "" {
			req.Header.Set("X-API-Key", key)
		}
		rec := httptest.NewRecorder()
		h(rec, req)
		if rec.Code != want {
			t.Errorf("key=%q: got %d want %d", key, rec.Code, want)
		}
	}

	// Sin clave configurada, la verificación queda desactivada
	rec := httptest.NewRecorder()
	APIKeyFunc("")(ok)(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != 200 {
		t.Errorf("modo opcional: got %d", rec.Code)
	}
}
