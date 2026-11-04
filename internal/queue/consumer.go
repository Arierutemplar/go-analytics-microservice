package queue

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/Arierutemplar/REPO/analytics-service/internal/domain"
	"github.com/Arierutemplar/REPO/analytics-service/internal/observability"
	"github.com/Arierutemplar/REPO/analytics-service/internal/resilience"
)

const (
	insertTimeout = 15 * time.Second
	statsInterval = 5 * time.Second
)

type entry struct {
	msg   jetstream.Msg
	event *domain.Event
}

// RunConsumer lee lotes del stream y los inserta en `repo`. Cada lote se cierra al
// llegar a BatchSize mensajes o al vencer FlushInterval, lo que ocurra primero.
// `onBatch` se invoca con los eventos ya persistidos y confirmados.
// Bloquea hasta que ctx se cancele; el lote en curso se termina antes de retornar.
func (c *Client) RunConsumer(ctx context.Context, repo domain.BatchEventRepository, onBatch func([]*domain.Event)) {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		c.pollStats(ctx)
	}()
	defer wg.Wait()

	for ctx.Err() == nil {
		// Circuito abierto: no se lee nada. Los mensajes siguen intactos en el stream
		// (sin consumir entregas) hasta que la base responda de nuevo.
		if c.Gate != nil {
			if err := c.Gate(ctx); err != nil {
				return
			}
		}

		batch, err := c.cons.Fetch(c.cfg.BatchSize, jetstream.FetchMaxWait(c.cfg.FlushInterval))
		if err != nil {
			if ctx.Err() == nil {
				slog.Error("queue: fetch", "error", err)
				sleep(ctx, time.Second)
			}
			continue
		}

		var entries []entry
		for msg := range batch.Messages() {
			ev, err := decode(msg)
			if err != nil {
				// Mensaje ilegible: reintentar no lo arreglará; se conserva en la DLQ
				observability.NATSDecodeError()
				c.deadLetter(msg, ReasonDecode, err)
				continue
			}
			entries = append(entries, entry{msg: msg, event: ev})
		}
		if err := batch.Error(); err != nil && !errors.Is(err, nats.ErrTimeout) && ctx.Err() == nil {
			slog.Warn("queue: lote incompleto", "error", err)
		}
		if len(entries) == 0 {
			continue
		}

		start := time.Now()
		c.persist(repo, entries, onBatch)
		observability.ObserveBatch(len(entries), time.Since(start).Seconds())
	}
}

// persist descarta los duplicados del lote y persiste el resto.
func (c *Client) persist(repo domain.BatchEventRepository, entries []entry, onBatch func([]*domain.Event)) {
	if fresh := c.dropDuplicates(entries); len(fresh) > 0 {
		c.persistBatch(repo, fresh, onBatch)
	}
}

// dropDuplicates reserva el id de cada evento en la caché; los que ya estaban reservados
// (reentregas, reenvíos del cliente o repetidos dentro del mismo lote) ya se persistieron
// o están en curso, así que se confirman sin tocar la base ni el resumen.
func (c *Client) dropDuplicates(entries []entry) []entry {
	if c.Dedup == nil {
		return entries
	}
	fresh := make([]entry, 0, len(entries))
	dups := 0
	for _, e := range entries {
		if c.Dedup.TryAdd(e.event.ScopedID()) {
			fresh = append(fresh, e)
			continue
		}
		dups++
		if err := e.msg.Ack(); err != nil {
			slog.Warn("queue: ack de duplicado falló", "error", err)
		}
	}
	observability.DedupDropped("consumer", dups)
	return fresh
}

// release devuelve los ids a la caché cuando el lote no se persistió, para que la
// reentrega no se confunda con un duplicado.
func (c *Client) release(entries []entry) {
	for _, e := range entries {
		c.Dedup.Forget(e.event.ScopedID())
	}
}

// persistBatch inserta el lote y resuelve cada mensaje: ack si se guardó, Nak con retardo
// si el fallo es transitorio y DLQ si es permanente. Ante un error permanente con
// varios eventos biseca el lote para aislar al evento venenoso sin perder los demás.
func (c *Client) persistBatch(repo domain.BatchEventRepository, entries []entry, onBatch func([]*domain.Event)) {
	events := make([]*domain.Event, len(entries))
	for i, e := range entries {
		events[i] = e.event
	}

	// Contexto propio: un apagado no debe cortar una inserción en curso
	ctx, cancel := context.WithTimeout(context.Background(), insertTimeout)
	err := repo.SaveBatch(ctx, events)
	cancel()

	switch {
	case err == nil:
		for _, e := range entries {
			if aerr := e.msg.Ack(); aerr != nil {
				// Si el ack se pierde habrá redelivery; msg_id evita el duplicado en la base
				slog.Warn("queue: ack falló", "error", aerr)
			}
		}
		observability.NATSConsumed(len(entries))
		if onBatch != nil {
			onBatch(events)
		}

	case errors.Is(err, domain.ErrPermanent) && len(entries) > 1:
		mid := len(entries) / 2
		c.persistBatch(repo, entries[:mid], onBatch)
		c.persistBatch(repo, entries[mid:], onBatch)

	case errors.Is(err, domain.ErrPermanent):
		observability.NATSInsertErrors(1)
		c.release(entries)
		c.deadLetter(entries[0].msg, ReasonPermanent, err)

	case errors.Is(err, resilience.ErrOpen):
		// El circuito se abrió (o ya lo estaba): no es culpa de los eventos, así que no
		// se cuentan como error ni como intento agotado. Se devuelven al stream y el
		// Gate pausa la lectura hasta que la base se recupere.
		c.release(entries)
		for _, e := range entries {
			nak(e.msg, c.cfg.RetryDelay)
		}
		slog.Warn("queue: circuito abierto, eventos devueltos a la cola", "eventos", len(entries))

	default:
		// Fallo transitorio: Nak con retardo creciente. Al agotar MaxDeliver el mensaje
		// va a la DLQ en lugar de quedarse bloqueando el stream.
		observability.NATSInsertErrors(len(entries))
		c.release(entries)
		retried := 0
		for _, e := range entries {
			if c.exhausted(e.msg) {
				c.deadLetter(e.msg, ReasonMaxDeliveries, err)
				continue
			}
			nak(e.msg, c.retryDelay(e.msg))
			retried++
		}
		slog.Error("queue: inserción fallida", "eventos", len(entries), "reintentos", retried, "error", err)
	}
}

// pollStats publica el backlog del consumer como gauges de Prometheus.
func (c *Client) pollStats(ctx context.Context) {
	t := time.NewTicker(statsInterval)
	defer t.Stop()
	for {
		ictx, cancel := context.WithTimeout(ctx, 3*time.Second)
		info, err := c.cons.Info(ictx)
		if err == nil {
			observability.NATSQueueDepth(int(info.NumPending), info.NumAckPending)
		}
		if st, err := c.admin.Stats(ictx); err == nil {
			observability.DLQDepth(st.Messages)
		}
		cancel()
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func decode(msg jetstream.Msg) (*domain.Event, error) {
	var e domain.Event
	if err := json.Unmarshal(msg.Data(), &e); err != nil {
		return nil, err
	}
	e.MessageID = msg.Headers().Get(nats.MsgIdHdr)
	// Mensajes publicados antes de existir el multi-tenancy no traen tenant_id
	if e.TenantID == "" {
		e.TenantID = domain.DefaultTenant
	}
	return &e, nil
}

// nak devuelve el mensaje al stream tras d; si falla, el AckWait lo reentregará igualmente.
func nak(msg jetstream.Msg, d time.Duration) {
	if err := msg.NakWithDelay(d); err != nil {
		slog.Warn("queue: nak falló", "error", err)
	}
}

func sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
