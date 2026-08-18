-- =============================================
-- Kanban — arquivamento de tarefas
-- Aditiva e idempotente. Corrige o carregamento do board, que buscava
-- TODAS as tarefas sem filtro (1500+ cards na coluna "A Fazer" travavam
-- o navegador). Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

ALTER TABLE public.kanban_tasks ADD COLUMN IF NOT EXISTS arquivado    boolean NOT NULL DEFAULT false;
ALTER TABLE public.kanban_tasks ADD COLUMN IF NOT EXISTS arquivado_em timestamptz;
ALTER TABLE public.kanban_tasks ADD COLUMN IF NOT EXISTS arquivado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_arquivado ON public.kanban_tasks(status, arquivado);

-- Amplia o histórico para registrar arquivamento/restauração
ALTER TABLE public.kanban_historico DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;
ALTER TABLE public.kanban_historico ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao IS NULL OR acao IN ('criacao', 'status', 'responsavel', 'status_responsavel', 'edicao', 'arquivamento', 'restauracao'));
