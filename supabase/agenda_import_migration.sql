-- ─────────────────────────────────────────────────────────────────────────────
-- agenda_import_migration.sql
--
-- 1. Estende agenda_items com colunas de fonte externa
-- 2. Cria tabela de jobs de importação (agenda_import_jobs)
-- 3. Cria tabela de log por linha  (agenda_import_rows)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extensão de agenda_items ───────────────────────────────────────────────

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS subtype             text,
  ADD COLUMN IF NOT EXISTS client_name         text,
  ADD COLUMN IF NOT EXISTS opposing_party_name text,
  ADD COLUMN IF NOT EXISTS process_number      text,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid
        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_name    text,
  ADD COLUMN IF NOT EXISTS court               text,
  ADD COLUMN IF NOT EXISTS county              text,
  ADD COLUMN IF NOT EXISTS published_at        timestamptz,
  ADD COLUMN IF NOT EXISTS source              text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_event_id     text,
  ADD COLUMN IF NOT EXISTS imported_at         timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload         jsonb;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_items_updated_at ON public.agenda_items;
CREATE TRIGGER trg_agenda_items_updated_at
  BEFORE UPDATE ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índice único para deduplicação: (source, source_event_id) quando não nulos
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_source_event_dedup
  ON public.agenda_items(source, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- Índices auxiliares para buscas por processo e responsável
CREATE INDEX IF NOT EXISTS idx_agenda_process_number      ON public.agenda_items(process_number);
CREATE INDEX IF NOT EXISTS idx_agenda_responsible_user_id ON public.agenda_items(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_source              ON public.agenda_items(source);

-- ── 2. Jobs de importação ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agenda_import_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text        NOT NULL DEFAULT 'easyjur',
  original_filename text        NOT NULL,
  imported_by       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_rows        int         NOT NULL DEFAULT 0,
  created_count     int         NOT NULL DEFAULT 0,
  updated_count     int         NOT NULL DEFAULT 0,
  skipped_count     int         NOT NULL DEFAULT 0,
  error_count       int         NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on import jobs"
  ON public.agenda_import_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_jobs_imported_by ON public.agenda_import_jobs(imported_by);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at  ON public.agenda_import_jobs(created_at DESC);

-- ── 3. Log por linha ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agenda_import_rows (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id  uuid        NOT NULL
        REFERENCES public.agenda_import_jobs(id) ON DELETE CASCADE,
  row_number     int         NOT NULL,
  raw_payload    jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL
        CHECK (status IN ('created', 'updated', 'skipped', 'error')),
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on import rows"
  ON public.agenda_import_rows FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_rows_job    ON public.agenda_import_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON public.agenda_import_rows(status);
