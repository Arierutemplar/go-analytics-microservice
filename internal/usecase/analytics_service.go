package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Arierutemplar/REPO/analytics-service/internal/dedup"
	"github.com/Arierutemplar/REPO/analytics-service/internal/domain"
	"github.com/Arierutemplar/REPO/analytics-service/internal/observability"
)

const (
	persistTimeout = 2 * time.Second
	publishTimeout = 3 * time.Second
)

// ErrQueueFull se retorna cuando el canal de eventos está lleno.
var ErrQueueFull = errors.New("analytics: event queue is full")

// AnalyticsService ingesta eventos y mantiene un resumen de métricas.
//
// Tiene dos modos de ingesta:
//   - directo (por defecto): canal en memoria + worker pool que persiste cada evento.
//   - publisher (WithPublisher): IngestEvent publica de forma durable en un broker y
//     un consumer externo persiste por lotes y llama a RecordProcessed.
type AnalyticsService struct {
	events    chan domain.Event
	repo      domain.EventRepository
	publisher domain.EventPublisher

	mu      sync.RWMutex
	summary domain.MetricSummary

	dedup *dedup.Cache

	wg       sync.WaitGroup
	stopOnce sync.Once
	done     chan struct{}
}

// WithDedup activa la deduplicación en memoria del modo directo: un evento con un id ya
// procesado recientemente no se persiste ni se cuenta de nuevo.
func (s *AnalyticsService) WithDedup(c *dedup.Cache) *AnalyticsService {
	s.dedup = c
	return s
}

func newEventID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand solo falla si el SO no tiene entropía; el id sigue siendo único por tiempo
		return fmt.Sprintf("evt-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b[:])
}

// WithPublisher activa el modo publisher. Debe llamarse antes de usar el servicio.
func (s *AnalyticsService) WithPublisher(p domain.EventPublisher) *AnalyticsService {
	s.publisher = p
	return s
}

// NewAnalyticsService crea el servicio con un canal con buffer de tamaño bufferSize
// y el repositorio donde se persistirá cada evento.
func NewAnalyticsService(bufferSize int, repo domain.EventRepository) *AnalyticsService {
	if bufferSize < 0 {
		bufferSize = 0
	}
	return &AnalyticsService{
		events: make(chan domain.Event, bufferSize),
		repo:   repo,
		done:   make(chan struct{}),
		summary: domain.MetricSummary{
			EventsByType: make(map[string]int64),
		},
	}
}

// GetHistory devuelve los eventos persistidos más recientes.
func (s *AnalyticsService) GetHistory(ctx context.Context, limit int) ([]*domain.Event, error) {
	return s.repo.GetHistory(ctx, limit)
}

// IngestEvent acepta el evento. En modo directo lo encola sin bloquear (ErrQueueFull si
// no hay espacio); en modo publisher lo publica y espera la confirmación del broker.
func (s *AnalyticsService) IngestEvent(e domain.Event) error {
	select {
	case <-s.done:
		return errors.New("analytics: service stopped")
	default:
	}

	// Sin id el evento no tendría identidad para deduplicar ni para trazarlo
	if e.ID == "" {
		e.ID = newEventID()
	}
	if e.TenantID == "" {
		e.TenantID = domain.DefaultTenant
	}

	if s.publisher != nil {
		ctx, cancel := context.WithTimeout(context.Background(), publishTimeout)
		defer cancel()
		if err := s.publisher.Publish(ctx, &e); err != nil {
			return fmt.Errorf("analytics: publicar evento: %w", err)
		}
		return nil
	}

	select {
	case s.events <- e:
		return nil
	default:
		return ErrQueueFull
	}
}

// RecordProcessed actualiza el resumen con eventos ya persistidos (modo publisher).
func (s *AnalyticsService) RecordProcessed(events []*domain.Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range events {
		s.apply(*e)
	}
}

// apply requiere s.mu tomado para escritura.
func (s *AnalyticsService) apply(e domain.Event) {
	s.summary.TotalEvents++
	s.summary.EventsByType[e.EventType]++
	s.summary.LastEvent = &e

	recent := s.summary.RecentEvents
	if len(recent) >= domain.RecentEventsLimit {
		recent = recent[:domain.RecentEventsLimit-1]
	}
	s.summary.RecentEvents = append([]domain.Event{e}, recent...)
}

// RecordDLQ registra un evento enviado a la Dead Letter Queue.
func (s *AnalyticsService) RecordDLQ() {
	s.mu.Lock()
	s.summary.DLQEvents++
	s.mu.Unlock()
}

// StartWorkerPool lanza `workers` goroutines que procesan eventos hasta Stop().
func (s *AnalyticsService) StartWorkerPool(workers int) {
	if workers < 1 {
		workers = 1
	}
	for i := 0; i < workers; i++ {
		s.wg.Add(1)
		go s.worker()
	}
}

func (s *AnalyticsService) worker() {
	defer s.wg.Done()
	for {
		select {
		case e := <-s.events:
			s.process(e)
		case <-s.done:
			// Drena lo que quede encolado antes de salir.
			for {
				select {
				case e := <-s.events:
					s.process(e)
				default:
					return
				}
			}
		}
	}
}

func (s *AnalyticsService) process(e domain.Event) {
	// Un id ya procesado (reenvío del cliente) no se persiste ni se cuenta otra vez
	if !s.dedup.TryAdd(e.ScopedID()) {
		observability.DedupDropped("worker", 1)
		return
	}

	// Persistir primero; un fallo se registra pero no pierde la métrica en memoria.
	ctx, cancel := context.WithTimeout(context.Background(), persistTimeout)
	if err := s.repo.Save(ctx, &e); err != nil {
		slog.Error("analytics: error persistiendo evento", "event_id", e.ID, "error", err)
	}
	cancel()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.apply(e)
}

// Stop detiene los workers tras drenar la cola y espera a que terminen.
func (s *AnalyticsService) Stop() {
	s.stopOnce.Do(func() { close(s.done) })
	s.wg.Wait()
}

// GetSummary retorna una copia del resumen actual, segura para uso concurrente.
func (s *AnalyticsService) GetSummary() domain.MetricSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	byType := make(map[string]int64, len(s.summary.EventsByType))
	for k, v := range s.summary.EventsByType {
		byType[k] = v
	}

	var last *domain.Event
	if s.summary.LastEvent != nil {
		l := *s.summary.LastEvent
		last = &l
	}

	return domain.MetricSummary{
		TotalEvents:  s.summary.TotalEvents,
		EventsByType: byType,
		LastEvent:    last,
		RecentEvents: append([]domain.Event{}, s.summary.RecentEvents...),
		DLQEvents:    s.summary.DLQEvents,
	}
}
