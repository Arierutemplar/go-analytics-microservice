-- Deduplicación por event_id (semántica exactly-once a nivel de almacenamiento).
-- Solo se ejecuta mientras el índice no exista: elimina duplicados históricos
-- (conserva la primera inserción de cada event_id) y crea el índice único parcial.
-- Los event_id vacíos no tienen identidad y quedan fuera del índice.
DO $$
BEGIN
    IF to_regclass('idx_events_event_id') IS NULL AND to_regclass('idx_events_tenant_event_id') IS NULL THEN
        DELETE FROM events a
        USING events b
        WHERE a.event_id <> ''
          AND a.event_id = b.event_id
          AND a.id > b.id;

        CREATE UNIQUE INDEX idx_events_event_id ON events (event_id) WHERE event_id <> '';
    END IF;
END
$$;
