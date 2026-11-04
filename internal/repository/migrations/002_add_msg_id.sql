ALTER TABLE events ADD COLUMN IF NOT EXISTS msg_id TEXT;

-- Idempotencia de inserciones desde la cola. Los NULL (inserciones directas) no colisionan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_msg_id ON events (msg_id);
