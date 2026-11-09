# Real-Time Analytics Engine

A high-concurrency Go microservice that accepts multi-tenant product events over HTTP, acknowledges them only after they are durable, and pushes a live aggregate to browsers over WebSockets. Memory stays bounded: the hot path uses a fixed-size channel, a capped dedup cache, and batch inserts instead of one connection per event. The same process exposes Prometheus metrics that Grafana and a React dashboard turn into an operator view.

Under Docker Compose the default path is **HTTP → NATS JetStream → a batch consumer → PostgreSQL**, with a background exporter writing Apache Parquet to MinIO. With `NATS_URL` unset, the process falls back to an in-memory worker pool so the API can run with nothing but the Go binary.

## Vista previa

El cliente Voke (`voke/`) en modo oscuro y claro.

![Voke marketing: hero, lámpara y playground de código](./assets/screenshots/Captura%20de%20pantalla%20%283268%29.png)

![Voke pricing: calculadora de tarifa plana y estado de modelos](./assets/screenshots/Captura%20de%20pantalla%20%283269%29.png)

![Voke dashboard: overview de uso en modo oscuro](./assets/screenshots/Captura%20de%20pantalla%20%283270%29.png)

![Voke playground: consola en modo claro](./assets/screenshots/Captura%20de%20pantalla%20%283271%29.png)

## 🚀 Guía de Ejecución Rápida

El stack local se levanta con Docker Compose. Las imágenes del API y del dashboard se construyen en el propio proyecto. No hace falta un archivo `.env`: cada variable tiene un valor por defecto pensado para desarrollo local. Si quieres cambiar credenciales o límites, exporta las variables antes de `up` o colócalas en un `.env` en la raíz (`GRAFANA_USER`, `GRAFANA_PASSWORD`, `API_KEY`, `WS_TOKEN`, `FRONTEND_INGEST_KEY`, `FRONTEND_TENANT_ID`).

```bash
git clone https://github.com/Arierutemplar/go-analytics-microservice.git
cd go-analytics-microservice
docker compose up -d --build
```

`--build` reconstruye el API y el frontend la primera vez. Los arranques siguientes pueden omitirlo.

### Servicios y Puertos Expuestos

Los puertos de la izquierda son los del host. Dentro de la red de Compose los servicios se hablan por su nombre y por el puerto del contenedor (`backend:8080`, `prometheus:9090`), no por estos mapeos.

| Servicio | URL en el host | Notas |
| --- | --- | --- |
| Frontend (Dashboard) | http://localhost:8085 | Nginx sirve el bundle de Vite |
| Backend (Go API) | http://localhost:8088 | El proceso escucha en `:8080` dentro del contenedor |
| Grafana (Observabilidad) | http://localhost:3005 | Credenciales: `admin` / `admin` |
| Prometheus | http://localhost:9092 | Scrapea `backend:8080/metrics` |
| PostgreSQL | `localhost:5433` | Base `analytics`, usuario y contraseña `postgres` |
| NATS JetStream | `localhost:4222` / `localhost:8222` | Clientes en 4222, monitor HTTP en 8222 |
| MinIO | `localhost:9000` / `localhost:9001` | API S3 y consola web. Local: `minioadmin` / `minioadmin` |

### Verificación del Entorno

Cuando los healthchecks terminan, todos los servicios deben figurar como `healthy`:

```bash
docker compose ps
```

La API publica métricas de Prometheus en el puerto del host:

```bash
curl http://localhost:8088/metrics
```

Una respuesta `200` con texto Prometheus confirma que el backend acepta tráfico desde el host. `/health` en el mismo origen comprueba la vida del proceso.

## Key Architectural Highlights

Dependencies point inward. `internal/domain` holds entities and ports; everything else is an adapter.

| Layer | Package | Responsibility |
|---|---|---|
| Composition root | `cmd/api`, `cmd/dlqctl` | Wire config, HTTP routes, graceful shutdown; DLQ CLI |
| Domain | `internal/domain` | `Event`, `MetricSummary`, repository and DLQ ports |
| Use case | `internal/usecase` | Ingest, in-memory summary, worker pool |
| HTTP / WebSocket | `internal/handler` | JSON ingest, history, summary, DLQ admin, fan-out |
| Messaging | `internal/queue` | JetStream publish, batch consume, DLQ, redrive |
| Persistence | `internal/repository` | PostgreSQL (`pgx`), circuit breaker, in-memory repo, export watermark |
| Data lake | `internal/export` | Parquet (Snappy) upload to S3 with retry |
| Cross-cutting | `middleware`, `dedup`, `resilience`, `observability` | Auth, per-IP rate limit, TTL cache, breaker, Prometheus |

Engineering choices that show up in the code:

- **Non-blocking ingest.** Direct mode offers the event to a buffered channel (`buffer 1000`) and returns `503` (`ErrQueueFull`) instead of stalling the handler. JetStream mode returns `202` only after the broker ack, so the HTTP goroutine waits on durability, not on PostgreSQL.
- **Worker pool.** `StartWorkerPool(4)` runs four goroutines that `select` on the event channel and a `done` signal. Shutdown drains the buffer before the workers exit.
- **Batch consumer.** One JetStream consumer fetches up to `BATCH_SIZE` (default 500) or until `BATCH_FLUSH_INTERVAL` (default 1s), then inserts with a single `unnest` statement.
- **Bounded memory.** Dedup cache is capped (`DEDUP_MAX_ENTRIES`, default 100,000) with a TTL. The WebSocket broadcast queue is 256 messages; a full queue drops the update rather than blocking the ingest path. Prometheus `event_type` labels stop at 50 distinct values.
- **Failure isolation.** A `sony/gobreaker` wrapper stops the consumer from fetching while PostgreSQL is down, so JetStream deliveries are not burned. Poison messages go to `EVENTS_DLQ` after `NATS_MAX_DELIVER` (default 3) or immediately on a permanent SQLSTATE.
- **Read path for humans.** `gorilla/websocket` fans the in-memory summary out to every `/ws` client. The React 19 + TypeScript + Vite UI (Nginx in production) reconnects with backoff and renders EPS, event mix, and the live feed.
- **Observability as a product surface.** `observability.Instrument` records count and latency per route. Grafana is provisioned with **Analytics Service - Overview** (EPS, RPS, p50/p95/p99, 429/503) and **Analytics Service - Backend & NATS JetStream** (publish vs consume, pending messages, DLQ, batch insert latency).

## Architecture and Data Flow

```mermaid
flowchart LR
    Client["Clients / k6 / React UI"]

    subgraph Edge["HTTP edge"]
        API["POST /api/events<br/>rate limit · tenant auth"]
        WS["GET /ws<br/>gorilla/websocket"]
    end

    subgraph Core["Go process"]
        Pool["Direct mode<br/>chan buffer 1000<br/>4 workers"]
        Sum["MetricSummary<br/>RWMutex"]
        Dedup["Dedup cache<br/>TTL + max entries"]
    end

    subgraph Durable["Durable path"]
        JS[("NATS JetStream<br/>EVENTS")]
        Cons["Batch consumer<br/>Fetch 500 or 1s"]
        DLQ[("EVENTS_DLQ")]
        PG[("PostgreSQL<br/>JSONB payload")]
        Lake["Parquet exporter<br/>watermark by id"]
        S3[("MinIO / S3")]
    end

    subgraph Obs["Observability"]
        Prom["Prometheus<br/>GET /metrics"]
        Graf["Grafana"]
        UI["React dashboard"]
    end

    Client -->|"HTTP"| API
    API -->|"NATS_URL set: publish + ack → 202"| JS
    API -->|"no NATS: non-blocking send"| Pool
    JS --> Cons
    Cons --> Dedup
    Pool --> Dedup
    Dedup --> PG
    Cons -->|"permanent error or max deliver"| DLQ
    Cons --> Sum
    Pool --> Sum
    Sum --> WS
    PG --> Lake --> S3
    WS --> UI
    API -.-> Prom
    Cons -.-> Prom
    Lake -.-> Prom
    Prom --> Graf
```

**JetStream path (Compose default).** `POST /api/events` authenticates the tenant, publishes with a `Nats-Msg-Id`, and returns `202` after the stream ack. The durable consumer `analytics-batch-writer` pulls a batch, drops ids already in the dedup cache, and inserts the rest. `ON CONFLICT DO NOTHING` on `(tenant_id, event_id)` is the final idempotency barrier. After the batch commits, `RecordProcessed` updates the summary and one goroutine broadcasts the JSON snapshot.

**Direct path.** Four workers call `Save` with a 2s timeout. The summary lock is an `RWMutex`: workers take a write lock, `GetSummary` takes a read lock and returns a copy so handlers never share the live map. This mode loses queued events on crash. Use it for local iteration, not as the production contract.

**Shutdown.** SIGINT/SIGTERM flips `/ready` to `503` via `atomic.Bool`, then drains in order: HTTP (`Shutdown`), JetStream consumer (final batch ack), worker pool, Parquet exporter, WebSocket close frames, NATS `Drain`, PostgreSQL pool. A second signal exits immediately. `SHUTDOWN_TIMEOUT` defaults to 25s; Compose sets `stop_grace_period: 30s`.

## Performance and Concurrency Model

Go's scheduler multiplexes the HTTP server, the consumer, the exporter, and the WebSocket writer onto a small set of OS threads. The service does not spawn a goroutine per event.

| Mechanism | Where | What it protects |
|---|---|---|
| Buffered channel | `AnalyticsService.events` (1000) | Decouples HTTP from persistence in direct mode. A full channel is backpressure (`503`), not an unbounded queue. |
| Worker pool | 4 goroutines, `sync.WaitGroup` | Fixed parallelism for `Save`. `Stop` closes `done` once and drains remaining events. |
| `sync.RWMutex` | `MetricSummary` | Many readers (`/api/metrics`, each broadcast) share the snapshot; writers serialize `apply`. |
| `sync.Mutex` | WebSocket client map, dedup cache, per-IP limiter | Short critical sections. The broadcast loop holds the client lock only while writing, with a 5s write deadline, and drops dead connections in place. |
| `atomic.Bool` | `/ready` | The readiness handler observes shutdown without taking the summary lock. |
| `golang.org/x/time/rate` | One token bucket per remote IP | Default 20 rps, burst 40, on `/api/events`. A janitor goroutine evicts idle IPs so the map cannot grow without bound. |
| JetStream pull | Single consumer loop | Throughput scales by batch size, not by goroutines. Pending messages sit on disk in the NATS volume until PostgreSQL catches up. |
| Circuit breaker | `BreakerRepository` | After `DB_BREAKER_FAILURES` consecutive failures (capped at `NATS_MAX_DELIVER-1`) or a batch slower than `DB_BREAKER_SLOW_THRESHOLD`, the consumer stops `Fetch`. Messages stay in the stream. After `DB_BREAKER_OPEN_TIMEOUT` a `Ping` probe closes the circuit. |

Under a flood of POSTs the HTTP stack and the broker absorb the spike. PostgreSQL sees hundreds of rows per statement instead of one transaction per request. The in-memory summary and the WebSocket queue are O(recent events), not O(history); history lives in PostgreSQL and the lake.

Idempotency is four layers deep, which is what makes at-least-once delivery safe to scale: a 2-minute `Nats-Msg-Id` window on the stream, the consumer dedup cache, the worker-pool dedup cache, and the unique index plus `ON CONFLICT DO NOTHING`. Re-drive uses a deterministic id `<original>#dlq<seq>` so a retried redrive does not insert a second row.

Horizontal scaling of the API is straightforward for publish (JetStream is the buffer). The summary and the WebSocket fan-out are **per process**: they reset on restart and only count batches that process committed. The Parquet exporter takes a PostgreSQL advisory lock so only one replica uploads.

## Load Testing and Benchmarking (k6)

`scripts/k6-test.js` is an ingest stress harness against `POST /api/events`. It does not open WebSockets. Watch the React UI and Grafana during a run if you want fan-out and consumer lag in the same picture.

**Scenario `ingest`** (`ramping-vus`):

| Stage | Duration | Target VUs |
|---|---|---|
| Ramp | 30s | 10 → 100 |
| Sustain | 1m | 100 |
| Ramp down | 10s | 0 |

Each iteration posts one event (`page_view`, `button_click`, or `purchase`) with a unique `id` (`k6-<vu>-<iter>-<ts>`), a random user, and a JSON payload. Sleep is `random * 20ms` so virtual users do not lock-step.

**Thresholds** (non-zero exit if any fail; usable as a CI gate):

| k6 metric | Threshold | Intent |
|---|---|---|
| `http_req_duration` | `p(95) < 200` | 95th percentile under 200ms |
| `http_req_failed` | `rate < 0.01` | HTTP failure rate under 1% |
| `http_reqs` | `rate > 1000` | Mean throughput above 1,000 rps across the whole run, including ramp and cooldown |
| `checks` | `rate > 0.99` | More than 99% of responses are `202` and contain `event_accepted` |

Custom counters: `events_accepted` (202), `events_rate_limited` (429), `events_overloaded` (503).

The per-IP limiter (20 rps, burst 40) will 429 a single k6 process. Raise it for the run, then put it back:

```bash
RATE_LIMIT_RPS=50000 RATE_LIMIT_BURST=100000 docker compose up -d backend
k6 run scripts/k6-test.js
```

```powershell
$env:RATE_LIMIT_RPS="50000"; $env:RATE_LIMIT_BURST="100000"; docker compose up -d backend
& "$env:ProgramFiles\k6\k6.exe" run scripts/k6-test.js
```

Optional `-e` variables: `BASE_URL` (Compose publishes the API at `http://localhost:8088`; the script falls back to `http://localhost:8080` if unset), `API_KEY` (`X-API-Key`), `TENANT_ID` (`X-Tenant-ID`).

```bash
k6 run -e BASE_URL=http://localhost:8088 -e API_KEY=my-key -e TENANT_ID=acme scripts/k6-test.js
```

`setup()` fails the test if `GET /health` is not 200. After the run, JetStream is still the buffer: wait until `analytics_nats_pending_messages` is 0, then compare accepted ids with PostgreSQL.

```bash
docker compose exec postgres psql -U postgres -d analytics \
  -c "select count(*), count(distinct event_id) from events where event_id like 'k6-%'"
```

**Recorded reference** on a developer machine running the full Compose stack, with the limiter raised (not a hardware commitment):

| Metric | Observed | Threshold |
|---|---|---|
| Mean throughput | about 4,300 rps | > 1,000 rps |
| `http_req_duration` p95 | about 18 ms | < 200 ms |
| `http_req_failed` | 0% | < 1% |
| Accepted vs stored | 431,322 → 431,322, 0 duplicate `event_id`s | — |

p99 is on the Overview dashboard (`analytics_http_request_duration_seconds` histogram, Prometheus default buckets), not as a k6 threshold. The script gates p95 only.

Go-side checks that complement k6:

```bash
go test ./...
go test -race -count=20 ./internal/usecase
go test -bench=Concurrent -run=^$ ./internal/usecase
```

`TestConcurrentDirectMode` drives 100 HTTP producers plus WebSocket churn with no external services. Integration tests need Compose:

```bash
docker compose up -d nats postgres
TEST_NATS_URL=nats://localhost:4222 \
TEST_POSTGRES_DSN="postgres://postgres:postgres@localhost:5433/analytics?sslmode=disable" \
go test -race -count=1 ./...
```

## Local Setup and Observability Stack

Requirements: Docker Compose v2, and Go 1.27 if you run the API on the host. k6 is only required for the harness above.

```bash
docker compose up -d --build
docker compose ps
```

Every service should become healthy: Postgres, NATS, MinIO, the Go API, Nginx, Prometheus, Grafana.

Smoke test:

```bash
curl -X POST http://localhost:8088/api/events \
  -H "Content-Type: application/json" \
  -d '{"id":"evt-1","event_type":"click","user_id":"u-42","payload":"checkout"}'
curl http://localhost:8088/api/metrics
curl http://localhost:8088/health
curl http://localhost:8088/ready
```

| Surface | Host URL | Notes |
|---|---|---|
| React dashboard | http://localhost:8085 | Nginx, multi-stage Node build. Vite dev server is `npm run dev` on port 5173. |
| Go API | http://localhost:8088 | `/health` liveness, `/ready` fails during shutdown |
| PostgreSQL | `localhost:5433` | Database `analytics`, user/password `postgres` / `postgres` |
| NATS | `localhost:4222`, monitor `localhost:8222` | JetStream file store on volume `nats-data` |
| MinIO | API `localhost:9000`, console `localhost:9001` | `minioadmin` / `minioadmin` for local only |
| Prometheus | http://localhost:9092 | Scrapes `backend:8080/metrics` every 15s, 15-day retention |
| Grafana | http://localhost:3005 | `admin` / `admin` unless `GRAFANA_USER` / `GRAFANA_PASSWORD` are set. Folder **Analytics**. |

Networks: `data` (internal) holds Postgres, NATS, MinIO, and the API; `observability` holds the API, Prometheus, and Grafana; `edge` holds the dashboard. Volumes: `postgres-data`, `nats-data`, `minio-data`, `prometheus-data`, `grafana-data`.

```bash
docker compose down       # stop, keep volumes
docker compose down -v    # stop and delete data
```

**Images.** `Dockerfile` compiles `cmd/api` and `cmd/dlqctl` with `CGO_ENABLED=0`, `-trimpath`, and `-ldflags="-s -w"` in `golang:1.27-alpine`, then copies the static binaries onto `alpine:3.22` with CA certificates, a non-root `app` user, and no shell toolchain. `frontend/Dockerfile` runs `npm ci` and `npm run build` on `node:24-alpine`, then serves `dist/` from `nginx:alpine` with long-cache headers on hashed assets.

**Host-only API** (in-memory repository, 4 workers, no JetStream):

```bash
go run ./cmd/api
```

**Host API against Compose infrastructure:**

```bash
docker compose up -d postgres nats minio
POSTGRES_HOST=localhost POSTGRES_PORT=5433 POSTGRES_PASSWORD=postgres \
NATS_URL=nats://localhost:4222 \
S3_ENDPOINT=localhost:9000 S3_ACCESS_KEY=minioadmin S3_SECRET_KEY=minioadmin \
go run ./cmd/api
```

```bash
cd frontend && npm install && npm run dev
```

On PowerShell, set variables with `$env:NAME="value"` and call `curl.exe` if `curl` is aliased to `Invoke-WebRequest`.

### HTTP surface

| Route | Method | Auth | Behavior |
|---|---|---|---|
| `/api/events` | POST | Per-IP limit, then tenant key or `API_KEY` | Ingest. `202`, `400`, `401`, `403`, `429`, `503` |
| `/api/events/history?limit=` | GET | `API_KEY` | Newest rows, default 50, max 1000 |
| `/api/metrics` | GET | `API_KEY` | In-memory `MetricSummary` |
| `/metrics` | GET | `API_KEY` | Prometheus text format |
| `/ws` | WebSocket | `WS_TOKEN` or `API_KEY` via `?token=`, `Authorization: Bearer`, or `X-API-Key` | Summary snapshots |
| `/api/dlq` | GET | **Admin `API_KEY` only** | DLQ stats and messages. Own limiter, 2 rps |
| `/api/dlq/redrive` | POST | **Admin `API_KEY` only** | Republish into the ingest subject |
| `/health` | GET | Open | Process is up |
| `/ready` | GET | Open | `503` once shutdown has started |

Empty auth env vars leave the matching routes open for local development. DLQ routes **fail closed** (`503`) when `API_KEY` is unset.

### Configuration

Invalid positive-number or duration values log a warning and fall back to the default. They do not crash startup.

| Variable | Default | Role |
|---|---|---|
| `API_KEY` | empty | Admin key: reads, `/metrics`, ingest for any tenant, `/ws`, and the only key accepted by DLQ routes |
| `TENANT_API_KEYS` | empty | `key:tenant` pairs. The key selects the tenant |
| `WS_TOKEN` | empty | Browser-safe read token for `/ws` |
| `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST` | `20` / `40` | Token bucket per IP on ingest |
| `POSTGRES_HOST` | empty | Empty selects the in-memory repository |
| `POSTGRES_PORT` / `USER` / `PASSWORD` / `DB` | `5432` / `postgres` / empty / `analytics` | Connection |
| `POSTGRES_SSLMODE` | `disable` | Use `require` or `verify-full` outside local Compose |
| `NATS_URL` | empty | Empty selects the 4-worker in-memory pool |
| `NATS_STREAM` / `NATS_SUBJECT` / `NATS_DURABLE` | `EVENTS` / `events.ingest` / `analytics-batch-writer` | Stream topology. DLQ stream name is `<stream>_DLQ` |
| `NATS_DLQ_SUBJECT` / `NATS_MAX_DELIVER` | `analytics.dlq` / `3` | Dead-letter subject and delivery cap |
| `BATCH_SIZE` / `BATCH_FLUSH_INTERVAL` | `500` / `1s` | Consumer batch |
| `DB_BREAKER_FAILURES` / `OPEN_TIMEOUT` / `SLOW_THRESHOLD` | `2` / `15s` / `5s` | Breaker |
| `DEDUP_TTL` / `DEDUP_MAX_ENTRIES` | `10m` / `100000` | In-memory id cache |
| `SHUTDOWN_TIMEOUT` | `25s` | Drain budget |
| `LOG_LEVEL` / `LOG_FORMAT` | `info` / `text` | `slog`; format `text` or `json` |
| `S3_ENDPOINT` | empty (Compose: `minio:9000`) | Empty disables Parquet export |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | empty (Compose: `minioadmin`) | Object-store credentials |
| `S3_BUCKET` / `S3_REGION` | `analytics-lake` / `us-east-1` | Bucket is created when the key is allowed to |
| `S3_USE_SSL` / `S3_PREFIX` | `false` / empty | TLS and key prefix |
| `EXPORT_INTERVAL` / `EXPORT_BATCH_SIZE` / `EXPORT_LAG` | `5m` / `50000` / `30s` | Export cadence, row cap, safety lag |
| `EXPORT_RETRY_ATTEMPTS` | `5` | Exponential backoff with jitter |

Compose-only: `MINIO_IMAGE`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, `FRONTEND_INGEST_KEY`, `FRONTEND_TENANT_ID`. Frontend build also reads `VITE_WS_URL`, `VITE_API_URL`, `VITE_WS_TOKEN`, `VITE_API_KEY`, `VITE_INGEST_API_KEY`, `VITE_TENANT_ID`. Every `VITE_*` value is visible in the JavaScript bundle. Put a read-only `WS_TOKEN` and a tenant ingest key there, never the admin key.

Fixed in code: listen address `:8080`, direct-mode queue length 1000, direct-mode worker count 4.

### What the pipeline guarantees

- **Durability.** `202` means JetStream accepted the message. The stream is work-queue retention with a 72h `MaxAge`, stored on `nats-data`.
- **Storage-level exactly-once.** Delivery is at-least-once. The unique `(tenant_id, event_id)` index collapses duplicates. Transient database errors `NakWithDelay`. A third failed delivery, or a permanent error such as a NUL inside JSONB, is copied to the DLQ and only then acked, so the main stream cannot stall on one poison message.
- **PostgreSQL outage.** The breaker pauses fetches. Events wait in JetStream. They are not sent to the DLQ.
- **Lake.** Objects land at `s3://analytics-lake/year=YYYY/month=MM/day=DD/tenant=<id>/events-<from>-<to>.parquet`. The watermark advances only after every partition upload succeeds. Rows are not deleted from `events` after export.
- **DLQ operations.** `dlqctl` ships in the API image. `docker compose exec -e NATS_URL=nats://nats:4222 backend dlqctl list`. Redrive requires an explicit selector (`seqs`, `reason`, or `all=true`). `decode_error` messages will fail again if redriven.

### Limits to know before you operate it

- The live summary is process-local and starts at zero after a restart. Full history is in PostgreSQL.
- The rate limiter keys on `RemoteAddr`. Behind a proxy, that is the proxy unless you terminate TLS and set the real client IP yourself. `X-Forwarded-For` is not trusted.
- CORS allows any origin. WebSocket auth is a static shared secret; `?token=` can land in proxy logs. Production wants an allow-list, `wss://`, and short-lived tokens.
- Tenant keys authorize ingest only. Summary and history are a global operator view.
- `events` is not purged after export. Plan a retention or partition policy before the table is the bottleneck.
- Replace the database by implementing `domain.BatchEventRepository` and returning it from `newEventRepository` in `cmd/api/main.go`.

## Voke API Frontend Dashboard

Cliente de desarrollo y panel de métricas para **Voke**, un proxy compatible con OpenAI. La interfaz concentra un sitio de producto, un playground de alta fidelidad y una consola de uso, con la marca visual Violet Neon: fondo profundo y acentos violeta que se leen igual en modo oscuro y en modo claro.

### Stack tecnológico

| Capa | Elección |
| --- | --- |
| Framework | Next.js (App Router) y TypeScript estricto |
| UI | React 19, Tailwind CSS 4, primitivos Radix |
| Datos | TanStack Query y TanStack Table |
| Diseño | Patrones de Aceternity UI y Magic UI implementados en el propio código: lámpara cónica, grid de fondo y Shine Border |

La paleta de referencia es un negro profundo `#09090b` con acentos `#643d88` y `#d9b0ff`. Esos valores viven en las variables de `voke/app/globals.css` y en el brillo por defecto de `ShineBorder`. El modo claro usa una superficie `#fafafa` y un violeta más oscuro para conservar contraste.

### Características clave

#### Sistema de iluminación y lámpara

Bajo la navegación de marketing, `HeaderLamp` proyecta un haz cónico violeta. Dos degradados cónicos opuestos salen de una barra neón (`#d9b0ff`) y se disuelven sobre el grid, sin un recuadro opaco detrás. El contenedor es transparente y no intercepta el puntero.

#### Modo oscuro y modo claro

El switch del header usa `next-themes` con la clase en `<html>`, tema oscuro por defecto y persistencia en el navegador. El estado marcado es el modo oscuro. Textos, tarjetas, gráficos y el toaster cambian con los tokens de color. No hace falta recargar la página.

#### Dev-Indicator (botón N)

En desarrollo, el badge de Next.js se reestiliza dentro de su shadow DOM. Es un disco circular con relieve neumórfico: grafito `#18181b` en oscuro y `#e8e8e8` en claro. La letra N permanece en violeta neón. El menú (Route, Bundler, Route Info, Preferences) sigue el tema oscuro de la app. En una build de producción el indicador no se monta.

#### Microinteracciones y widgets

La ventana de código del inicio tiene dos filas de chips: lenguajes (JavaScript, Python, cURL) y modelos (`voke/auto`, `openai/gpt-4.1`, y el resto del catálogo). Los chips inactivos usan cursor de puntero y un hover violeta. Las tarjetas principales llevan Shine Border, el único trazo animado del panel. La consola añade el playground con editor, la gestión de API keys y el resumen de uso.

### Estructura del proyecto

```text
voke/
├── app/
│   ├── (marketing)/          # Inicio, precios y matriz de modelos
│   ├── (dashboard)/          # /overview, /api-keys, /playground
│   ├── globals.css           # Tokens, lámpara, neón y switch
│   └── layout.tsx
├── components/
│   ├── ui/                   # Lámpara, Shine Border, grid, controles
│   ├── shared/               # Shell, tema, proveedores, logo
│   ├── marketing/
│   └── dashboard/
├── lib/                      # API mock, precios, snippets, modelos
└── types/
```

Las rutas de App Router se quedan en `voke/app/`. Lo reutilizable vive en `voke/components/ui/`. El dominio de producto está en `marketing/` y `dashboard/`.

### Instalación y ejecución

Requisitos: Node.js 20.9 o superior.

```bash
cd voke
npm install
npm run dev
```

La app queda en [http://localhost:3000](http://localhost:3000).

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build anterior |

Los datos de uso, claves y completaciones salen de `voke/lib/api.ts`. No hace falta un backend para recorrer el dashboard.