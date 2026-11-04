-- Idempotente: se ejecuta en cada arranque.
CREATE TABLE IF NOT EXISTS events (
    id         BIGSERIAL    PRIMARY KEY,
    event_id   TEXT         NOT NULL DEFAULT '',
    event_type TEXT         NOT NULL DEFAULT '',
    user_id    TEXT         NOT NULL DEFAULT '',
    payload    JSONB,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type);
