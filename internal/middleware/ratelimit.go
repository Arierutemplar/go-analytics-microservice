package middleware

import (
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter aplica un token bucket independiente por IP.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*ipLimiter
	rps      rate.Limit
	burst    int
	ttl      time.Duration
}

// NewRateLimiter permite `rps` peticiones por segundo por IP con ráfagas de hasta `burst`.
// La goroutine de limpieza se detiene al cancelar `stop`.
func NewRateLimiter(rps float64, burst int, stop <-chan struct{}) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*ipLimiter),
		rps:      rate.Limit(rps),
		burst:    burst,
		ttl:      3 * time.Minute,
	}
	go rl.cleanup(stop)
	return rl
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, ok := rl.visitors[ip]
	if !ok {
		v = &ipLimiter{limiter: rate.NewLimiter(rl.rps, rl.burst)}
		rl.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	return v.limiter.Allow()
}

// cleanup elimina IPs inactivas para que el mapa no crezca sin límite.
func (rl *RateLimiter) cleanup(stop <-chan struct{}) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			rl.mu.Lock()
			for ip, v := range rl.visitors {
				if time.Since(v.lastSeen) > rl.ttl {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		case <-stop:
			return
		}
	}
}

// Limit envuelve un handler y responde 429 al superar el límite.
// Usa r.RemoteAddr; detrás de un proxy inverso habría que resolver la IP real
// de forma confiable, ya que X-Forwarded-For es falsificable.
func (rl *RateLimiter) Limit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		if !rl.allow(ip) {
			w.Header().Set("Retry-After", strconv.Itoa(1))
			http.Error(w, "Demasiadas peticiones", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
