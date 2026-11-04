package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/Arierutemplar/REPO/analytics-service/internal/domain"
	"github.com/Arierutemplar/REPO/analytics-service/internal/middleware"
	"github.com/Arierutemplar/REPO/analytics-service/internal/observability"
	"github.com/Arierutemplar/REPO/analytics-service/internal/usecase"
)

const historyTimeout = 5 * time.Second

// AnalyticsHandler expone la ingesta, el historial y el resumen de métricas.
type AnalyticsHandler struct {
	service *usecase.AnalyticsService
}

// NewAnalyticsHandler crea el handler sobre el servicio de analíticas.
func NewAnalyticsHandler(service *usecase.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{service: service}
}

// HandleIngest procesa la llegada de nuevos eventos de analíticas (POST)
func (h *AnalyticsHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var event domain.Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, "Payload inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	// El tenant lo decide la autenticación, nunca el cuerpo de la petición
	event.TenantID = middleware.TenantFromContext(r.Context())

	// Ingesta asíncrona mediante el canal concurrente
	if err := h.service.IngestEvent(event); err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	observability.RecordEventIngested(event.EventType)

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "event_accepted"})
}

// HandleHistory devuelve los eventos recientes persistidos (GET ?limit=N, por defecto 50, máx. 1000)
func (h *AnalyticsHandler) HandleHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	limit := 50
	if q := r.URL.Query().Get("limit"); q != "" {
		n, err := strconv.Atoi(q)
		if err != nil || n < 1 {
			http.Error(w, "limit inválido", http.StatusBadRequest)
			return
		}
		limit = n
	}
	if limit > 1000 {
		limit = 1000
	}

	ctx, cancel := context.WithTimeout(r.Context(), historyTimeout)
	defer cancel()
	events, err := h.service.GetHistory(ctx, limit)
	if err != nil {
		slog.Error("leer historial", "error", err)
		http.Error(w, "No se pudo leer el historial", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, events)
}

// HandleSummary devuelve las métricas acumuladas (GET)
func (h *AnalyticsHandler) HandleSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, h.service.GetSummary())
}
