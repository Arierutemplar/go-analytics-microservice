package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var authRejected = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "analytics", Name: "auth_rejected_total",
	Help: "Peticiones rechazadas por autenticación o tenant, por endpoint y motivo (missing_key, invalid_key, tenant_mismatch, invalid_tenant, missing_token, invalid_token).",
}, []string{"endpoint", "reason"})

// AuthRejected cuenta una petición rechazada. Los motivos son un conjunto cerrado (cardinalidad acotada).
func AuthRejected(endpoint, reason string) { authRejected.WithLabelValues(endpoint, reason).Inc() }
