package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	breakerState = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "analytics", Name: "circuit_breaker_state",
		Help: "Estado del circuit breaker: 0 = cerrado, 1 = semiabierto, 2 = abierto (consumo pausado).",
	}, []string{"name"})
	breakerTransitions = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "circuit_breaker_transitions_total",
		Help: "Cambios de estado del circuit breaker, por estado destino.",
	}, []string{"name", "to"})
	breakerRejected = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "circuit_breaker_rejected_total",
		Help: "Operaciones rechazadas sin ejecutarse porque el circuito estaba abierto.",
	}, []string{"name"})
	breakerSlow = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "circuit_breaker_slow_calls_total",
		Help: "Operaciones que terminaron pero superaron el umbral de latencia crítica (cuentan como fallo).",
	}, []string{"name"})
	dedupDropped = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "dedup_dropped_total",
		Help: "Eventos duplicados descartados, por etapa (publish, consumer, worker, database).",
	}, []string{"stage"})
)

// BreakerInit registra el breaker con estado cerrado para que la serie exista desde el arranque.
func BreakerInit(name string) { breakerState.WithLabelValues(name).Set(0) }

func BreakerStateChange(name string, state int, to string) {
	breakerState.WithLabelValues(name).Set(float64(state))
	breakerTransitions.WithLabelValues(name, to).Inc()
}
func BreakerRejected(name string) { breakerRejected.WithLabelValues(name).Inc() }
func BreakerSlowCall(name string) { breakerSlow.WithLabelValues(name).Inc() }

func DedupDropped(stage string, n int) {
	if n > 0 {
		dedupDropped.WithLabelValues(stage).Add(float64(n))
	}
}
