package domain

import (
	"context"
	"time"
)

// ExportRecord es una fila histórica lista para volcarse al data lake.
type ExportRecord struct {
	ID        int64
	EventID   string
	TenantID  string
	EventType string
	UserID    string
	Payload   string // JSON como texto; vacío si era NULL
	MsgID     string
	CreatedAt time.Time
}

// ExportState es el progreso persistido del exportador.
// PendingTo != 0 indica un lote (LastID, PendingTo] ya planificado pero no confirmado: un reintento
// debe reutilizar exactamente ese rango para regenerar los mismos objetos.
type ExportState struct {
	LastID    int64
	PendingTo int64
}

// ExportSource es el origen de eventos históricos del exportador (implementado por PostgreSQL).
type ExportSource interface {
	// TryLock garantiza un único exportador activo entre réplicas. ok=false si otra réplica lo tiene.
	TryLock(ctx context.Context) (release func(), ok bool, err error)
	State(ctx context.Context) (ExportState, error)
	// Plan devuelve el último id y la cantidad (hasta limit) de filas posteriores a afterID
	// creadas antes de `before`.
	Plan(ctx context.Context, afterID int64, before time.Time, limit int) (upTo int64, n int, err error)
	MarkPending(ctx context.Context, upTo int64) error
	// Read devuelve las filas con afterID < id <= upTo, en orden de id.
	Read(ctx context.Context, afterID, upTo int64) ([]ExportRecord, error)
	// Commit avanza el watermark a upTo y limpia el lote pendiente.
	Commit(ctx context.Context, upTo int64) error
}
