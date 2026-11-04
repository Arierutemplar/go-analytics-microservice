package domain

import (
	"encoding/json"
	"time"
)

// Event representa la estructura del evento entrante de analíticas
type Event struct {
	ID        string `json:"id"`
	EventType string `json:"event_type"` // ej: "click", "page_view", "purchase"
	UserID    string `json:"user_id"`
	// TenantID lo fija el servidor a partir de la autenticación; el valor enviado en el cuerpo se ignora.
	TenantID  string          `json:"tenant_id"`
	Payload   json.RawMessage `json:"payload,omitempty"` // string, objeto, array o cualquier JSON válido
	Timestamp time.Time       `json:"timestamp"`

	// MessageID identifica el mensaje en el broker; permite insertar de forma
	// idempotente ante redeliveries. No forma parte del contrato JSON.
	MessageID string `json:"-"`
}

// DefaultTenant es el tenant de los eventos sin tenant explícito (modo sin autenticación o datos previos).
const DefaultTenant = "default"

// ScopedID devuelve el identificador de deduplicación del evento: el id acotado al tenant, de modo
// que dos tenants puedan usar el mismo id sin pisarse (ni bloquearse mutuamente). Vacío si no hay id.
func (e *Event) ScopedID() string {
	if e.ID == "" {
		return ""
	}
	t := e.TenantID
	if t == "" {
		t = DefaultTenant
	}
	return t + "/" + e.ID
}

// MetricSummary representa la agregación en tiempo real para el dashboard
type MetricSummary struct {
	TotalEvents  int64            `json:"total_events"`
	EventsByType map[string]int64 `json:"events_by_type"`
	LastEvent    *Event           `json:"last_event"`
	// RecentEvents contiene los últimos eventos (el más reciente primero), acotados a RecentEventsLimit.
	RecentEvents []Event `json:"recent_events"`
	// DLQEvents cuenta los eventos enviados a la Dead Letter Queue por esta instancia.
	DLQEvents int64 `json:"dlq_events"`
}

// RecentEventsLimit es el máximo de eventos recientes que se conservan en el resumen.
const RecentEventsLimit = 30
