-- =============================================
-- Trello Integration — escritório jurídico
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- ── 1. Evoluir kanban_tasks ───────────────────────────────────────────────────

-- ID externo (Trello card ID, publicacao_id textual, etc.)
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS origem_id text;

-- Escritório (para multi-tenancy futuro)
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS escritorio_id uuid;

-- Adicionar 'trello' ao check de origem
ALTER TABLE public.kanban_tasks DROP CONSTRAINT IF EXISTS kanban_tasks_origem_check;
ALTER TABLE public.kanban_tasks
  ADD CONSTRAINT kanban_tasks_origem_check
    CHECK (origem IN ('manual', 'publicacao', 'agenda', 'processo', 'trello'));

-- Índice único para upsert por origem externa
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_tasks_origem_origem_id
  ON public.kanban_tasks(origem, origem_id)
  WHERE origem_id IS NOT NULL;

-- ── 2. Trello integrations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trello_integrations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    text        NOT NULL,
  api_key     text        NOT NULL,
  api_token   text        NOT NULL,
  board_name  text,
  ativo       boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trello_integrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trello_integrations TO authenticated;
DROP POLICY IF EXISTS "trello_integrations_admin" ON public.trello_integrations;
CREATE POLICY "trello_integrations_admin"
  ON public.trello_integrations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 3. Mapeamento de listas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trello_list_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    uuid NOT NULL REFERENCES public.trello_integrations(id) ON DELETE CASCADE,
  trello_list_id    text NOT NULL,
  trello_list_name  text,
  kanban_status     text NOT NULL CHECK (kanban_status IN ('a_fazer', 'fazendo', 'com_pendencia', 'concluido', 'ignorar')),
  UNIQUE(integration_id, trello_list_id)
);

ALTER TABLE public.trello_list_mappings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trello_list_mappings TO authenticated;
DROP POLICY IF EXISTS "trello_list_mappings_auth" ON public.trello_list_mappings;
CREATE POLICY "trello_list_mappings_auth"
  ON public.trello_list_mappings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 4. Mapeamento de membros ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trello_member_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    uuid NOT NULL REFERENCES public.trello_integrations(id) ON DELETE CASCADE,
  trello_member_id  text NOT NULL,
  trello_username   text,
  trello_full_name  text,
  profile_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(integration_id, trello_member_id)
);

ALTER TABLE public.trello_member_mappings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trello_member_mappings TO authenticated;
DROP POLICY IF EXISTS "trello_member_mappings_auth" ON public.trello_member_mappings;
CREATE POLICY "trello_member_mappings_auth"
  ON public.trello_member_mappings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 5. Log de sincronizações ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trello_sync_logs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id     uuid        NOT NULL REFERENCES public.trello_integrations(id) ON DELETE CASCADE,
  triggered_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status             text        NOT NULL CHECK (status IN ('sucesso', 'erro', 'em_andamento')),
  cards_criados      integer     NOT NULL DEFAULT 0,
  cards_atualizados  integer     NOT NULL DEFAULT 0,
  cards_ignorados    integer     NOT NULL DEFAULT 0,
  erro_detalhes      text,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz
);

ALTER TABLE public.trello_sync_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trello_sync_logs TO authenticated;
DROP POLICY IF EXISTS "trello_sync_logs_auth" ON public.trello_sync_logs;
CREATE POLICY "trello_sync_logs_auth"
  ON public.trello_sync_logs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 6. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trello_list_mappings_integration
  ON public.trello_list_mappings(integration_id);

CREATE INDEX IF NOT EXISTS idx_trello_member_mappings_integration
  ON public.trello_member_mappings(integration_id);

CREATE INDEX IF NOT EXISTS idx_trello_sync_logs_integration
  ON public.trello_sync_logs(integration_id, started_at DESC);
