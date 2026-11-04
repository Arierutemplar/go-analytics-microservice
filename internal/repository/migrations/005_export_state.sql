-- Progreso del exportador a Parquet. pending_to fija el rango del lote en curso para que un
-- reintento regenere exactamente los mismos objetos (claves deterministas).
CREATE TABLE IF NOT EXISTS export_state (
    name       TEXT        PRIMARY KEY,
    last_id    BIGINT      NOT NULL DEFAULT 0,
    pending_to BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO export_state (name) VALUES ('parquet') ON CONFLICT (name) DO NOTHING;
