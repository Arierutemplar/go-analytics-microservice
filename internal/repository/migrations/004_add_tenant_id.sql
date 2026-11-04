-- Multi-tenancy: cada evento pertenece a un tenant. Las filas previas quedan en 'default'.
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- La identidad de un evento pasa a ser (tenant_id, event_id): dos tenants pueden usar el mismo
-- event_id, y ninguno puede bloquear los ids del otro.
DROP INDEX IF EXISTS idx_events_event_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_tenant_event_id ON events (tenant_id, event_id) WHERE event_id <> '';

-- Consultas por tenant ordenadas por tiempo
CREATE INDEX IF NOT EXISTS idx_events_tenant_created_at ON events (tenant_id, created_at DESC);
