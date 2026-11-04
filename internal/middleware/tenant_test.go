package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func newAuth(t *testing.T, admin, keys string) *TenantAuth {
	t.Helper()
	m, err := ParseTenantKeys(keys)
	if err != nil {
		t.Fatal(err)
	}
	a, err := NewTenantAuth(admin, m)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func ingestStatus(t *testing.T, a *TenantAuth, method string, hdr map[string]string) (int, string) {
	t.Helper()
	var gotTenant string
	h := a.Ingest(func(w http.ResponseWriter, r *http.Request) {
		gotTenant = TenantFromContext(r.Context())
		w.WriteHeader(http.StatusAccepted)
	})
	req := httptest.NewRequest(method, "/api/events", strings.NewReader("{}"))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec.Code, gotTenant
}

func TestTenantAuthIngest(t *testing.T) {
	a := newAuth(t, "admin-key", "key-a:tenant-a, key:with:colons:tenant-b")

	cases := []struct {
		name   string
		hdr    map[string]string
		status int
		tenant string
	}{
		{"sin clave", nil, 401, ""},
		{"clave inválida", map[string]string{"X-API-Key": "nope"}, 401, ""},
		{"clave de tenant fija el tenant", map[string]string{"X-API-Key": "key-a"}, 202, "tenant-a"},
		{"clave con ':'", map[string]string{"X-API-Key": "key:with:colons"}, 202, "tenant-b"},
		{"cabecera coincidente", map[string]string{"X-API-Key": "key-a", "X-Tenant-ID": "tenant-a"}, 202, "tenant-a"},
		{"cabecera de otro tenant", map[string]string{"X-API-Key": "key-a", "X-Tenant-ID": "tenant-b"}, 403, ""},
		{"admin elige tenant", map[string]string{"X-API-Key": "admin-key", "X-Tenant-ID": "acme"}, 202, "acme"},
		{"admin sin cabecera", map[string]string{"X-API-Key": "admin-key"}, 202, "default"},
		{"tenant con formato inválido", map[string]string{"X-API-Key": "admin-key", "X-Tenant-ID": "a b/../c"}, 400, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			status, tenant := ingestStatus(t, a, http.MethodPost, c.hdr)
			if status != c.status || tenant != c.tenant {
				t.Fatalf("status=%d tenant=%q, quería %d / %q", status, tenant, c.status, c.tenant)
			}
		})
	}

	// Solo se protege POST; lo demás llega al handler (que responde 405)
	if status, _ := ingestStatus(t, a, http.MethodGet, nil); status != 202 {
		t.Errorf("GET sin clave debía pasar al handler, status=%d", status)
	}
}

func TestTenantAuthDisabled(t *testing.T) {
	a := newAuth(t, "", "")
	if a.Enabled() {
		t.Fatal("sin claves no debe estar activo")
	}
	if s, tn := ingestStatus(t, a, http.MethodPost, nil); s != 202 || tn != "default" {
		t.Errorf("sin cabecera: %d %q", s, tn)
	}
	if s, tn := ingestStatus(t, a, http.MethodPost, map[string]string{"X-Tenant-ID": "acme"}); s != 202 || tn != "acme" {
		t.Errorf("con cabecera: %d %q", s, tn)
	}
	if s, _ := ingestStatus(t, a, http.MethodPost, map[string]string{"X-Tenant-ID": "bad tenant"}); s != 400 {
		t.Errorf("tenant inválido: %d", s)
	}
}

func TestParseTenantKeysErrors(t *testing.T) {
	for _, in := range []string{"sinseparador", ":tenant", "key:", "k:bad tenant", "k:a,k:b"} {
		if _, err := ParseTenantKeys(in); err == nil {
			t.Errorf("%q debía fallar", in)
		}
	}
}

func TestWSToken(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	srv := httptest.NewServer(WSToken("read-token", "admin-key")(func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err == nil {
			c.Close()
		}
	}))
	defer srv.Close()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"

	dial := func(u string, h http.Header) (int, error) {
		c, resp, err := websocket.DefaultDialer.Dial(u, h)
		if c != nil {
			c.Close()
		}
		if resp != nil {
			return resp.StatusCode, err
		}
		return 0, err
	}

	if code, err := dial(url, nil); err == nil || code != 401 {
		t.Errorf("sin token: code=%d err=%v", code, err)
	}
	if code, err := dial(url+"?token=mal", nil); err == nil || code != 401 {
		t.Errorf("token inválido: code=%d err=%v", code, err)
	}
	if _, err := dial(url+"?token=read-token", nil); err != nil {
		t.Errorf("?token válido: %v", err)
	}
	if _, err := dial(url+"?token=admin-key", nil); err != nil {
		t.Errorf("clave admin por query: %v", err)
	}
	if _, err := dial(url, http.Header{"Authorization": {"Bearer read-token"}}); err != nil {
		t.Errorf("Bearer: %v", err)
	}
	if _, err := dial(url, http.Header{"X-Api-Key": {"admin-key"}}); err != nil {
		t.Errorf("X-API-Key: %v", err)
	}
}

func TestWSTokenDisabled(t *testing.T) {
	called := false
	h := WSToken("", "")(func(http.ResponseWriter, *http.Request) { called = true })
	h(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/ws", nil))
	if !called {
		t.Fatal("sin tokens configurados debe dejar pasar")
	}
}
