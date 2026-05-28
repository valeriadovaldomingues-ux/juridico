-- =============================================
-- Kanban v2 — escritório jurídico
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- ── 1. Evoluir tabela kanban_tasks ────────────────────────────────────────────

-- Adicionar responsavel_id (FK para profiles)
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Campos de processo e partes
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS numero_processo text;

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS partes_resumidas text;

-- Prioridade
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente'));

-- Ordem dentro da coluna
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- Área jurídica
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS area_juridica text;

-- Motivo de pendência
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS pendencia_motivo text;

-- Vínculo com publicação
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS publicacao_id uuid REFERENCES public.publicacoes(id) ON DELETE SET NULL;

-- Origem do card
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'publicacao', 'agenda', 'processo'));

-- Timestamps adicionais
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Corrigir constraint de status para incluir com_pendencia
ALTER TABLE public.kanban_tasks DROP CONSTRAINT IF EXISTS kanban_tasks_status_check;
ALTER TABLE public.kanban_tasks
  ADD CONSTRAINT kanban_tasks_status_check
    CHECK (status IN ('a_fazer', 'fazendo', 'com_pendencia', 'concluido'));

-- ── 2. Cor do usuário no Kanban ───────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cor_kanban text;

-- ── 3. Histórico de movimentação ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kanban_historico (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid        NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  usuario_id          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  de_status           text,
  para_status         text,
  de_responsavel_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  para_responsavel_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_historico ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kanban_historico TO authenticated;

DROP POLICY IF EXISTS "kanban_historico_authenticated" ON public.kanban_historico;
CREATE POLICY "kanban_historico_authenticated"
  ON public.kanban_historico FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kanban_responsavel  ON public.kanban_tasks(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_status       ON public.kanban_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kanban_ordem        ON public.kanban_tasks(ordem);
CREATE INDEX IF NOT EXISTS idx_kanban_publicacao   ON public.kanban_tasks(publicacao_id);
CREATE INDEX IF NOT EXISTS idx_kanban_historico_task ON public.kanban_historico(task_id);
