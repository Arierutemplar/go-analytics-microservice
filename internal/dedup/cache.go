// Package dedup ofrece una memoria temporal de identificadores ya procesados.
package dedup

import (
	"sync"
	"time"
)

type item struct {
	id  string
	seq uint64
	exp time.Time
}

// Cache recuerda identificadores durante un TTL con un tope de entradas (las más
// antiguas se descartan primero). Es seguro para uso concurrente y todos sus métodos
// aceptan un receptor nil (sin deduplicación en memoria).
type Cache struct {
	mu      sync.Mutex
	ttl     time.Duration
	max     int
	now     func() time.Time
	seq     uint64
	entries map[string]uint64 // id -> seq vigente
	queue   []item            // en orden de inserción; con TTL fijo, también de expiración
}

// New crea una caché. ttl <= 0 o max <= 0 desactivan la deduplicación (retorna nil).
func New(ttl time.Duration, max int) *Cache {
	if ttl <= 0 || max <= 0 {
		return nil
	}
	return &Cache{ttl: ttl, max: max, now: time.Now, entries: make(map[string]uint64)}
}

// TryAdd reserva id. Retorna false si ya estaba reservado y vigente (duplicado).
func (c *Cache) TryAdd(id string) bool {
	if c == nil || id == "" {
		return true
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	c.evict(now)
	if _, ok := c.entries[id]; ok {
		return false
	}
	c.seq++
	c.entries[id] = c.seq
	c.queue = append(c.queue, item{id: id, seq: c.seq, exp: now.Add(c.ttl)})
	for len(c.queue) > 0 && len(c.entries) > c.max {
		c.pop()
	}
	return true
}

// Forget libera id para que una reentrega posterior no se considere duplicado.
// Debe llamarse cuando el procesamiento falló y el evento no quedó persistido.
func (c *Cache) Forget(id string) {
	if c == nil || id == "" {
		return
	}
	c.mu.Lock()
	delete(c.entries, id)
	c.mu.Unlock()
}

// Len devuelve el número de identificadores recordados.
func (c *Cache) Len() int {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.entries)
}

func (c *Cache) evict(now time.Time) {
	for len(c.queue) > 0 && !c.queue[0].exp.After(now) {
		c.pop()
	}
}

// pop retira la cabeza de la cola; solo borra la entrada si no fue reemplazada
// (Forget + TryAdd posterior la dejan con otro seq).
func (c *Cache) pop() {
	head := c.queue[0]
	c.queue[0] = item{}
	c.queue = c.queue[1:]
	if c.entries[head.id] == head.seq {
		delete(c.entries, head.id)
	}
}
