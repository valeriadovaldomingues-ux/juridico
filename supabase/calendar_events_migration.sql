-- ─────────────────────────────────────────────────────────────────────────────
-- calendar_events_migration.sql
--
-- Tabela principal para eventos importados de sistemas externos (EasyJur, etc.)
-- Separada de agenda_items para preservar a riqueza dos dados do EasyJur
-- sem comprometer a estrutura simples da agenda manual.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_events (
  -- Chave primária
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rastreabilidade da fonte
  source               text        NOT NULL DEFAULT 'easyjur',
  source_file          text,
  source_event_id      text,          -- col 0: id do evento no EasyJur

  -- Dados principais do evento
  title                text        NOT NULL,
  description          text,          -- col 25: Descrição (pode ser longa)
  resolution           text,          -- col 26: Resolução
  event_type           text,          -- col 2:  AUDIENCIA, PRAZO, TAREFA, etc.
  workflow_name        text,          -- col 1:  Workflow Principal

  -- Status e datas
  status               text,          -- col 24: ABERTO, CONCLUIDO, CANCELADO
  event_date           date,          -- col 8:  Data interna (data do evento)
  deadline_date        date,          -- col 9:  Data fatal
  created_date         date,          -- col 16: Data de cadastro no EasyJur
  publication_date     date,          -- col 14: Data de publicação (agenda)
  start_time           time,          -- col 17: Hora início (HH:mm:ss)
  end_time             time,          -- col 18: Hora fim

  -- Responsáveis
  owner_name           text,          -- col 4:  Responsável 1 (titular)
  assigned_name        text,          -- col 5:  Responsável 2

  -- Partes
  client_name          text,          -- col 6:  Cliente
  client_id_external   text,          -- col 47: Id do Cliente no EasyJur
  opposing_party_name  text,          -- col 7:  Contrário
  parties_info         text,          -- col 82: Partes do processo (texto completo)

  -- Processo vinculado (dados externos)
  process_id_external  text,          -- col 44: Id do Processo no EasyJur
  process_number       text,          -- col 53: Número CNJ (sem aspas)
  court                text,          -- col 54: Tribunal (TRT03, etc.)
  county               text,          -- col 55: Comarca
  state                text,          -- col 56: UF
  court_branch         text,          -- col 57: Vara
  court_rite           text,          -- col 45: Rito (ordinario, sumario)
  judge_name           text,          -- col 52: Juiz

  -- Classificação jurídica
  matter               text,          -- col 58: Tipo da Ação
  procedural_role      text,          -- col 59: Qualificação do Cliente
  case_class           text,          -- col 60: Título da Ação
  case_value           numeric(14,2), -- col 61: Valor da Causa
  practice_area        text,          -- col 73: Área (Trabalhista)
  current_phase        text,          -- col 76: Fase Atual

  -- Status e datas do processo
  process_status       text,          -- col 72: Status do processo (Ativo)
  distribution_date    date,          -- col 68: Data da Distribuição
  process_type         text,          -- col 66: judicial / extrajudicial

  -- Vínculo interno (se o processo já existir no sistema)
  process_internal_id  uuid REFERENCES public.processos(id) ON DELETE SET NULL,

  -- Payload bruto para auditoria
  raw_payload          jsonb,

  -- Metadados de importação
  imported_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on calendar_events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Índice de deduplicação: (source, source_event_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_source_dedup
  ON public.calendar_events(source, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date     ON public.calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type     ON public.calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status         ON public.calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_process_number ON public.calendar_events(process_number);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source         ON public.calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_process_id     ON public.calendar_events(process_internal_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_events_updated_at();

-- ─── agenda_import_jobs já existe (criada em agenda_import_migration.sql)
-- ─── agenda_import_rows já existe (criada em agenda_import_migration.sql)
-- Apenas garantir que existem caso esta migration rode independente:

CREATE TABLE IF NOT EXISTS public.agenda_import_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text        NOT NULL DEFAULT 'easyjur',
  original_filename text        NOT NULL,
  imported_by       uuid        NOT NULL REFERENCES public.profiles(id),
  total_rows        int         NOT NULL DEFAULT 0,
  created_count     int         NOT NULL DEFAULT 0,
  updated_count     int         NOT NULL DEFAULT 0,
  skipped_count     int         NOT NULL DEFAULT 0,
  error_count       int         NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

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

-- RLS nas tabelas de log (idempotente se já existirem)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agenda_import_jobs'
    AND policyname = 'Authenticated full access on import jobs'
  ) THEN
    ALTER TABLE public.agenda_import_jobs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated full access on import jobs"
      ON public.agenda_import_jobs FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agenda_import_rows'
    AND policyname = 'Authenticated full access on import rows'
  ) THEN
    ALTER TABLE public.agenda_import_rows ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated full access on import rows"
      ON public.agenda_import_rows FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
