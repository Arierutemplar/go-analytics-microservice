package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	dlqRedriven = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "dlq_redriven_total",
		Help: "Mensajes de la DLQ procesados por re-drive, por resultado (republished, duplicate, publish_error, delete_error).",
	}, []string{"result"})
	dlqDepth = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "analytics", Name: "dlq_depth",
		Help: "Mensajes actualmente almacenados en la Dead Letter Queue (sirve para alertar de acumulación).",
	})
)

func DLQRedrive(result string, n int) {
	if n > 0 {
		dlqRedriven.WithLabelValues(result).Add(float64(n))
	}
}

func DLQDepth(n uint64) { dlqDepth.Set(float64(n)) }
