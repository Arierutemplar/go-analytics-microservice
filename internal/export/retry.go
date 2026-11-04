package export

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"
)

// ErrPermanent marca fallos que no se arreglan reintentando (credenciales, bucket inexistente...).
var ErrPermanent = errors.New("export: error permanente")

// IsPermanent indica si err no debe reintentarse.
func IsPermanent(err error) bool { return errors.Is(err, ErrPermanent) }

// RetryPolicy define reintentos con backoff exponencial y jitter para fallos transitorios.
type RetryPolicy struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
}

func (p RetryPolicy) withDefaults() RetryPolicy {
	if p.MaxAttempts < 1 {
		p.MaxAttempts = 5
	}
	if p.BaseDelay <= 0 {
		p.BaseDelay = 500 * time.Millisecond
	}
	if p.MaxDelay <= 0 {
		p.MaxDelay = 10 * time.Second
	}
	return p
}

// Do ejecuta op hasta que tenga éxito, devuelva un error permanente, se agoten los intentos o
// se cancele ctx (también durante la espera). onRetry se invoca antes de cada espera.
func (p RetryPolicy) Do(ctx context.Context, op func(context.Context) error, onRetry func(attempt int, err error, wait time.Duration)) error {
	p = p.withDefaults()
	var err error
	for attempt := 1; ; attempt++ {
		if err = op(ctx); err == nil {
			return nil
		}
		if ctx.Err() != nil {
			return err
		}
		if IsPermanent(err) {
			return err
		}
		if attempt >= p.MaxAttempts {
			return fmt.Errorf("tras %d intentos: %w", attempt, err)
		}
		wait := p.backoff(attempt)
		if onRetry != nil {
			onRetry(attempt, err, wait)
		}
		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return fmt.Errorf("%w (cancelado durante el reintento: %v)", err, ctx.Err())
		case <-t.C:
		}
	}
}

// backoff: base*2^(n-1) acotado, con jitter en [d/2, d] para no sincronizar réplicas.
func (p RetryPolicy) backoff(attempt int) time.Duration {
	d := p.BaseDelay << (attempt - 1)
	if d <= 0 || d > p.MaxDelay {
		d = p.MaxDelay
	}
	return d/2 + time.Duration(rand.Int63n(int64(d/2)+1))
}
