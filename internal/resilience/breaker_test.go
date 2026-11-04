package resilience

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

var errBoom = errors.New("boom")

func newTestBreaker(cfg Config) *Breaker {
	if cfg.Name == "" {
		cfg.Name = "test"
	}
	if cfg.ConsecutiveFailures == 0 {
		cfg.ConsecutiveFailures = 3
	}
	if cfg.OpenTimeout == 0 {
		cfg.OpenTimeout = 100 * time.Millisecond
	}
	return New(cfg)
}

func fail(b *Breaker, n int) {
	for i := 0; i < n; i++ {
		_ = b.Do(func() error { return errBoom })
	}
}

func TestOpensAfterConsecutiveFailuresAndRejects(t *testing.T) {
	b := newTestBreaker(Config{OpenTimeout: time.Minute})
	fail(b, 3)
	if b.State() != Open {
		t.Fatalf("estado = %s, quiero open", b.State())
	}

	var called atomic.Bool
	err := b.Do(func() error { called.Store(true); return nil })
	if !errors.Is(err, ErrOpen) {
		t.Fatalf("err = %v, quiero ErrOpen", err)
	}
	if called.Load() {
		t.Fatal("con el circuito abierto no debe ejecutarse la operación")
	}
}

func TestSuccessResetsConsecutiveFailures(t *testing.T) {
	b := newTestBreaker(Config{OpenTimeout: time.Minute})
	fail(b, 2)
	_ = b.Do(func() error { return nil })
	fail(b, 2)
	if b.State() != Closed {
		t.Fatalf("los fallos no eran consecutivos: estado = %s", b.State())
	}
}

func TestIsFailureExcludesDataErrors(t *testing.T) {
	errData := errors.New("dato inválido")
	b := newTestBreaker(Config{IsFailure: func(err error) bool { return !errors.Is(err, errData) }})
	for i := 0; i < 10; i++ {
		if err := b.Do(func() error { return errData }); !errors.Is(err, errData) {
			t.Fatalf("Do debe propagar el error original, got %v", err)
		}
	}
	if b.State() != Closed {
		t.Fatalf("errores de datos no deben abrir el circuito: estado = %s", b.State())
	}
}

func TestRecoversThroughHalfOpen(t *testing.T) {
	b := newTestBreaker(Config{})
	fail(b, 3)
	if b.State() != Open {
		t.Fatal("debería estar abierto")
	}
	time.Sleep(150 * time.Millisecond)
	if b.State() != HalfOpen {
		t.Fatalf("estado = %s, quiero half_open", b.State())
	}
	if err := b.Do(func() error { return nil }); err != nil {
		t.Fatal(err)
	}
	if b.State() != Closed {
		t.Fatalf("estado = %s, quiero closed", b.State())
	}
}

func TestFailedProbeReopens(t *testing.T) {
	b := newTestBreaker(Config{})
	fail(b, 3)
	time.Sleep(150 * time.Millisecond)
	fail(b, 1)
	if b.State() != Open {
		t.Fatalf("estado = %s, quiero open tras fallar la prueba", b.State())
	}
}

func TestSlowCallCountsAsFailureButReturnsNil(t *testing.T) {
	b := newTestBreaker(Config{SlowThreshold: 20 * time.Millisecond, OpenTimeout: time.Minute})
	for i := 0; i < 3; i++ {
		err := b.Do(func() error { time.Sleep(40 * time.Millisecond); return nil })
		if err != nil {
			t.Fatalf("una llamada lenta pero completada no debe devolver error: %v", err)
		}
	}
	if b.State() != Open {
		t.Fatalf("estado = %s, la latencia crítica debe abrir el circuito", b.State())
	}
}

func TestWaitReadyProbesAndReturnsWhenDBRecovers(t *testing.T) {
	b := newTestBreaker(Config{})
	fail(b, 3)

	var probes atomic.Int32
	probe := func(context.Context) error {
		if probes.Add(1) < 3 {
			return errBoom // la base sigue caída en las dos primeras pruebas
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := b.WaitReady(ctx, probe); err != nil {
		t.Fatalf("WaitReady: %v", err)
	}
	if b.State() != Closed {
		t.Fatalf("estado = %s, quiero closed", b.State())
	}
	if probes.Load() != 3 {
		t.Fatalf("pruebas = %d, quiero 3", probes.Load())
	}
}

func TestWaitReadyHonoursContext(t *testing.T) {
	b := newTestBreaker(Config{OpenTimeout: time.Minute})
	fail(b, 3)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	if err := b.WaitReady(ctx, nil); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, quiero DeadlineExceeded", err)
	}
}
