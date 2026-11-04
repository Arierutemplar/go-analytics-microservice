// Prueba de carga de la ingesta: POST /api/events.
//
//   k6 run scripts/k6-test.js
//   k6 run -e BASE_URL=http://localhost:8080 -e API_KEY=clave -e TENANT_ID=acme scripts/k6-test.js
//
// Variables: BASE_URL (def. http://localhost:8080), API_KEY (X-API-Key), TENANT_ID (X-Tenant-ID).
// El rate limiter por IP del backend (def. 20 req/s) rechazará con 429 casi todo el tráfico de
// esta prueba, que sale de una sola IP: levanta el backend con RATE_LIMIT_RPS/RATE_LIMIT_BURST altos.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const API_KEY = __ENV.API_KEY || "";
const TENANT_ID = __ENV.TENANT_ID || "";

const rateLimited = new Counter("events_rate_limited"); // 429
const overloaded = new Counter("events_overloaded"); // 503 (cola/stream saturado)
const accepted = new Counter("events_accepted"); // 202

export const options = {
  scenarios: {
    ingest: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 100 }, // rampa de 10 a 100 VUs
        { duration: "1m", target: 100 }, // carga máxima sostenida
        { duration: "10s", target: 0 }, // bajada a 0
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    http_reqs: ["rate>1000"], // throughput medio de toda la prueba (incluye rampa y bajada)
  },
};

const EVENT_TYPES = ["page_view", "button_click", "purchase"];
const PAGES = ["/", "/pricing", "/docs", "/checkout", "/account"];
const BUTTONS = ["signup", "add_to_cart", "buy_now", "download", "share"];
const BROWSERS = ["chrome", "firefox", "safari", "edge"];
const COUNTRIES = ["MX", "US", "ES", "AR", "CO", "BR"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildEvent() {
  const eventType = pick(EVENT_TYPES);
  const payload = {
    session_id: `s-${__VU}-${Math.floor(Math.random() * 1e6)}`,
    browser: pick(BROWSERS),
    country: pick(COUNTRIES),
    page: pick(PAGES),
    load_ms: Math.floor(Math.random() * 2000),
  };
  if (eventType === "button_click") payload.button = pick(BUTTONS);
  if (eventType === "purchase") {
    payload.order_id = `o-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    payload.total = Math.round(Math.random() * 50000) / 100;
    payload.items = [{ sku: `sku-${Math.floor(Math.random() * 500)}`, qty: 1 + Math.floor(Math.random() * 3) }];
  }

  return {
    // Único por VU/iteración: la deduplicación por event_id no debe descartar tráfico legítimo.
    id: `k6-${__VU}-${__ITER}-${Date.now()}`,
    event_type: eventType,
    user_id: `user-${1 + Math.floor(Math.random() * 5000)}`,
    timestamp: new Date().toISOString(),
    payload,
  };
}

const headers = { "Content-Type": "application/json" };
if (API_KEY) headers["X-API-Key"] = API_KEY;
if (TENANT_ID) headers["X-Tenant-ID"] = TENANT_ID;

export default function () {
  const res = http.post(`${BASE_URL}/api/events`, JSON.stringify(buildEvent()), {
    headers,
    tags: { endpoint: "/api/events" },
  });

  if (res.status === 202) accepted.add(1);
  else if (res.status === 429) rateLimited.add(1);
  else if (res.status === 503) overloaded.add(1);

  check(res, {
    "status 202": (r) => r.status === 202,
    "respuesta event_accepted": (r) => r.status === 202 && r.body.indexOf("event_accepted") !== -1,
  });

  sleep(Math.random() * 0.02); // think time mínimo para no sincronizar a los VUs
}

export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`el backend no responde en ${BASE_URL}/health (status ${res.status})`);
  }
}
