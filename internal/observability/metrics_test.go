package observability

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func TestMetricsExposed(t *testing.T) {
	h := Instrument("/api/events", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	})
	h(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/events", nil))
	RecordEventIngested("click")

	rec := httptest.NewRecorder()
	promhttp.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := rec.Body.String()

	for _, want := range []string{
		`analytics_events_ingested_total{event_type="click"} 1`,
		`analytics_http_requests_total{code="202",method="POST",path="/api/events"} 1`,
		`analytics_http_request_duration_seconds_count{method="POST",path="/api/events"} 1`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("falta métrica: %s", want)
		}
	}
}
