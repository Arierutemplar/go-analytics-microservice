package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminOnly(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	call := func(key, hdr string) int {
		req := httptest.NewRequest("POST", "/", nil)
		if hdr != "" {
			req.Header.Set("X-API-Key", hdr)
		}
		rec := httptest.NewRecorder()
		AdminOnly(key)(ok).ServeHTTP(rec, req)
		return rec.Code
	}
	if c := call("admin", "admin"); c != http.StatusNoContent {
		t.Fatalf("clave correcta: %d", c)
	}
	if c := call("admin", "tenant-key"); c != http.StatusUnauthorized {
		t.Fatalf("clave de otro tipo: %d", c)
	}
	if c := call("admin", ""); c != http.StatusUnauthorized {
		t.Fatalf("sin clave: %d", c)
	}
	// Fail-closed: sin clave configurada no se puede entrar ni sin cabecera
	if c := call("", ""); c != http.StatusServiceUnavailable {
		t.Fatalf("admin deshabilitado: %d", c)
	}
}
