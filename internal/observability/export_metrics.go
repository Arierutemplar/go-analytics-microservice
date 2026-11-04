package observability

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	parquetExported = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Name: "parquet_exported_total",
		Help: "Archivos Parquet subidos con éxito al object storage.",
	})
	parquetEvents = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Name: "parquet_exported_events_total",
		Help: "Eventos volcados dentro de archivos Parquet.",
	})
	parquetBytes = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Name: "parquet_bytes_transferred_total",
		Help: "Bytes de Parquet transferidos al object storage.",
	})
	parquetDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "analytics", Name: "parquet_export_duration_seconds",
		Help:    "Duración de un lote de exportación (lectura, codificación, subida y confirmación).",
		Buckets: []float64{.05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60, 120},
	}, []string{"result"})
	parquetErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "analytics", Name: "parquet_export_errors_total",
		Help: "Errores de exportación por etapa (state, plan, read, encode, bucket, upload, commit).",
	}, []string{"stage"})
	parquetRetries = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "analytics", Name: "parquet_upload_retries_total",
		Help: "Reintentos de subida por fallos transitorios del object storage.",
	})
	parquetLastSuccess = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "analytics", Name: "parquet_last_success_timestamp_seconds",
		Help: "Instante (unix) del último lote exportado con éxito; sirve para alertar de exportador atascado.",
	})
	parquetWatermark = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "analytics", Name: "parquet_watermark_id",
		Help: "Último id de la tabla events confirmado en el data lake.",
	})
)

func ParquetFile(rows, bytes int) {
	parquetExported.Inc()
	parquetEvents.Add(float64(rows))
	parquetBytes.Add(float64(bytes))
}

func ParquetBatch(d time.Duration, ok bool, watermark int64) {
	if ok {
		parquetDuration.WithLabelValues("ok").Observe(d.Seconds())
		parquetLastSuccess.SetToCurrentTime()
		parquetWatermark.Set(float64(watermark))
		return
	}
	parquetDuration.WithLabelValues("error").Observe(d.Seconds())
}

func ParquetError(stage string) { parquetErrors.WithLabelValues(stage).Inc() }
func ParquetUploadRetry()       { parquetRetries.Inc() }
