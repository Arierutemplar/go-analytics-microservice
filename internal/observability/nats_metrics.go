package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	natsPublished = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "published_total",
		Help: "Eventos publicados y confirmados por JetStream.",
	})
	natsPublishErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "publish_errors_total",
		Help: "Publicaciones a JetStream que fallaron.",
	})
	natsConsumed = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "consumed_total",
		Help: "Mensajes consumidos con éxito: insertados en la base de datos y confirmados (ack).",
	})
	natsInsertErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "insert_errors_total",
		Help: "Eventos cuya inserción falló (se reintentan con Nak o se descartan si el error es permanente).",
	})
	natsDecodeErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "decode_errors_total",
		Help: "Mensajes ilegibles descartados.",
	})
	dlqMessages = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "dlq_messages_total",
		Help: "Eventos enviados a la Dead Letter Queue, por motivo (decode_error, permanent_error, max_deliveries_exceeded).",
	}, []string{"reason"})
	dlqPublishErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Name: "dlq_publish_errors_total",
		Help: "Fallos al publicar en la Dead Letter Queue (el mensaje original no se confirma).",
	})
	natsPending = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "pending_messages",
		Help: "Mensajes en el stream aún no entregados al consumer (backlog).",
	})
	natsAckPending = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "ack_pending_messages",
		Help: "Mensajes entregados pendientes de ack.",
	})
	batchSize = promauto.NewHistogram(prometheus.HistogramOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "batch_size",
		Help:    "Tamaño de los lotes leídos de la cola.",
		Buckets: []float64{1, 5, 10, 50, 100, 250, 500, 1000},
	})
	batchInsertDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Namespace: "analytics", Subsystem: "nats", Name: "batch_insert_duration_seconds",
		Help:    "Duración de cada inserción por lotes en la base de datos.",
		Buckets: prometheus.DefBuckets,
	})
)

func NATSPublished()           { natsPublished.Inc() }
func NATSPublishError()        { natsPublishErrors.Inc() }
func NATSConsumed(n int)       { natsConsumed.Add(float64(n)) }
func NATSInsertErrors(n int)   { natsInsertErrors.Add(float64(n)) }
func NATSDecodeError()         { natsDecodeErrors.Inc() }
func DLQMessage(reason string) { dlqMessages.WithLabelValues(reason).Inc() }
func DLQPublishError()         { dlqPublishErrors.Inc() }
func NATSQueueDepth(pending, ackPending int) {
	natsPending.Set(float64(pending))
	natsAckPending.Set(float64(ackPending))
}
func ObserveBatch(size int, seconds float64) {
	batchSize.Observe(float64(size))
	batchInsertDuration.Observe(seconds)
}
