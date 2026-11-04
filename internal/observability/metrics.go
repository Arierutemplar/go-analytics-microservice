package observability

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// maxEventTypeLabels limita la cardinalidad: event_type viene del cliente.
const maxEventTypeLabels = 50

var (
	eventsIngested = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics",
		Name:      "events_ingested_total",
		Help:      "Eventos ingeridos exitosamente, por tipo.",
	}, []string{"event_type"})

	httpRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics",
		Name:      "http_requests_total",
		Help:      "Peticiones HTTP por endpoint, método y código.",
	}, []string{"path", "method", "code"})

	httpDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "analytics",
		Name:      "http_request_duration_seconds",
		Help:      "Latencia de las peticiones HTTP por endpoint y método.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"path", "method"})

	typesMu    sync.Mutex
	knownTypes = make(map[string]struct{})
)

// RecordEventIngested incrementa el contador de eventos ingeridos para el tipo dado.
func RecordEventIngested(eventType string) {
	eventsIngested.WithLabelValues(eventTypeLabel(eventType)).Inc()
}

func eventTypeLabel(t string) string {
	if t == "" {
		return "unknown"
	}
	typesMu.Lock()
	defer typesMu.Unlock()
	if _, ok := knownTypes[t]; ok {
		return t
	}
	if len(knownTypes) >= maxEventTypeLabels {
		return "other"
	}
	knownTypes[t] = struct{}{}
	return t
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// Instrument mide conteo y latencia de un handler. `path` es una etiqueta fija
// (no la URL real) para evitar cardinalidad no acotada.
func Instrument(path string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}

		next(sw, r)

		httpDuration.WithLabelValues(path, r.Method).Observe(time.Since(start).Seconds())
		httpRequests.WithLabelValues(path, r.Method, strconv.Itoa(sw.status)).Inc()
	}
}
