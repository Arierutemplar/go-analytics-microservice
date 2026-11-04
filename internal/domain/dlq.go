package domain

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound indica que el mensaje pedido no existe (p. ej. ya fue re-driveado o expiró).
var ErrNotFound = errors.New("not found")

// DeadLetter describe un mensaje de la Dead Letter Queue.
type DeadLetter struct {
	Seq          uint64    `json:"seq"` // secuencia en el stream de la DLQ (identificador para re-drive selectivo)
	Reason       string    `json:"reason"`
	Error        string    `json:"error"`
	FailedAt     time.Time `json:"failed_at"`
	Deliveries   uint64    `json:"deliveries"`
	OriginalSeq  uint64    `json:"original_seq"`
	RedriveCount int       `json:"redrive_count"` // veces que ya se reinyectó y volvió a fallar
	MsgID        string    `json:"msg_id,omitempty"`
	EventID      string    `json:"event_id,omitempty"` // extraídos del cuerpo si es un evento válido
	TenantID     string    `json:"tenant_id,omitempty"`
	EventType    string    `json:"event_type,omitempty"`
	Size         int       `json:"size_bytes"`
	BodyPreview  string    `json:"body_preview,omitempty"`
	Body         string    `json:"body,omitempty"` // solo en consultas de detalle
}

// DLQFilter acota qué mensajes de la DLQ se consideran.
type DLQFilter struct {
	AfterSeq uint64   // solo mensajes con secuencia mayor
	Seqs     []uint64 // si no está vacío, solo estas secuencias
	Reason   string   // vacío = cualquiera
}

// RedriveResult resume una operación de re-drive.
type RedriveResult struct {
	Matched      int      `json:"matched"`       // mensajes que cumplen el filtro (y el límite)
	Republished  int      `json:"republished"`   // reinyectados y eliminados de la DLQ
	Duplicates   int      `json:"duplicates"`    // el broker ya tenía esa reinyección; se elimina de la DLQ
	Failed       int      `json:"failed"`        // no se pudo reinyectar; siguen en la DLQ
	DeleteFailed int      `json:"delete_failed"` // reinyectados pero no borrados de la DLQ (se deduplicarán)
	Truncated    bool     `json:"truncated"`     // quedan más mensajes que cumplen el filtro (se alcanzó el límite)
	DryRun       bool     `json:"dry_run"`
	Seqs         []uint64 `json:"seqs,omitempty"` // secuencias procesadas
	FirstError   string   `json:"first_error,omitempty"`
}

// DLQManager inspecciona y reprocesa la Dead Letter Queue.
type DLQManager interface {
	// Stats devuelve cuántos mensajes hay en la DLQ.
	Stats(ctx context.Context) (DLQStats, error)
	// List devuelve hasta limit mensajes (en orden de secuencia) que cumplan el filtro.
	List(ctx context.Context, f DLQFilter, limit int) ([]DeadLetter, error)
	// Get devuelve un mensaje con su cuerpo completo.
	Get(ctx context.Context, seq uint64) (*DeadLetter, error)
	// Redrive reinyecta en el stream principal hasta limit mensajes que cumplan el filtro y los
	// elimina de la DLQ solo tras confirmarse la publicación. Con dryRun no modifica nada.
	Redrive(ctx context.Context, f DLQFilter, limit int, dryRun bool) (RedriveResult, error)
}

// DLQStats resume el estado de la DLQ.
type DLQStats struct {
	Stream   string    `json:"stream"`
	Subject  string    `json:"subject"`
	Messages uint64    `json:"messages"`
	Bytes    uint64    `json:"bytes"`
	FirstSeq uint64    `json:"first_seq"`
	LastSeq  uint64    `json:"last_seq"`
	Oldest   time.Time `json:"oldest,omitempty"`
}
