package dedup

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestTryAddDetectsDuplicates(t *testing.T) {
	c := New(time.Minute, 10)
	if !c.TryAdd("a") {
		t.Fatal("la primera inserción debe aceptarse")
	}
	if c.TryAdd("a") {
		t.Fatal("la segunda inserción debe detectarse como duplicado")
	}
	if !c.TryAdd("b") {
		t.Fatal("un id distinto debe aceptarse")
	}
}

func TestEmptyIDIsNeverDeduplicated(t *testing.T) {
	c := New(time.Minute, 10)
	for i := 0; i < 2; i++ {
		if !c.TryAdd("") {
			t.Fatal("un id vacío no tiene identidad y no debe deduplicarse")
		}
	}
}

func TestForgetAllowsRedelivery(t *testing.T) {
	c := New(time.Minute, 10)
	now := time.Now()
	c.now = func() time.Time { return now }

	c.TryAdd("a") // seq 1, expira en t+60s
	c.Forget("a")
	now = now.Add(30 * time.Second)
	if !c.TryAdd("a") { // seq 2, expira en t+90s
		t.Fatal("tras Forget el id debe poder reservarse de nuevo")
	}

	// En t+70s expira la entrada obsoleta (seq 1) y no debe arrastrar la reserva vigente.
	now = now.Add(40 * time.Second)
	if c.TryAdd("a") {
		t.Fatal("la reserva vigente de a debe seguir activa")
	}
}

func TestTTLExpiry(t *testing.T) {
	c := New(time.Minute, 10)
	now := time.Now()
	c.now = func() time.Time { return now }
	c.TryAdd("a")

	now = now.Add(59 * time.Second)
	if c.TryAdd("a") {
		t.Fatal("antes del TTL sigue siendo duplicado")
	}
	now = now.Add(2 * time.Second)
	if !c.TryAdd("a") {
		t.Fatal("tras el TTL el id debe volver a aceptarse")
	}
}

func TestMaxEntriesEvictsOldest(t *testing.T) {
	c := New(time.Hour, 3)
	for _, id := range []string{"a", "b", "c", "d"} {
		c.TryAdd(id)
	}
	if c.Len() != 3 {
		t.Fatalf("Len = %d, quiero 3", c.Len())
	}
	if c.TryAdd("d") {
		t.Fatal("el más reciente debe conservarse")
	}
	if !c.TryAdd("a") {
		t.Fatal("el más antiguo debió descartarse")
	}
}

func TestNilCacheIsNoop(t *testing.T) {
	var c *Cache
	for i := 0; i < 2; i++ {
		if !c.TryAdd("a") {
			t.Fatal("una caché nil no deduplica")
		}
	}
	c.Forget("a")
	if c.Len() != 0 {
		t.Fatal("Len de nil debe ser 0")
	}
	if New(0, 10) != nil || New(time.Minute, 0) != nil {
		t.Fatal("parámetros inválidos desactivan la caché")
	}
}

// Con -race: solo una goroutine puede ganar la reserva de cada id.
func TestConcurrentTryAddExactlyOneWinner(t *testing.T) {
	c := New(time.Minute, 10000)
	const ids, goroutines = 200, 16
	var winners atomic.Int64
	var wg sync.WaitGroup
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < ids; i++ {
				if c.TryAdd(fmt.Sprint("id-", i)) {
					winners.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	if winners.Load() != ids {
		t.Fatalf("ganadores = %d, quiero %d", winners.Load(), ids)
	}
}
