-- =============================================
-- Kanban Histórico v2 — adiciona coluna acao
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- Adiciona coluna acao para distinguir tipo de evento
ALTER TABLE public.kanban_historico
  ADD COLUMN IF NOT EXISTS acao text
    CHECK (acao IS NULL OR acao IN ('criacao', 'status', 'responsavel', 'status_responsavel', 'edicao'));

-- Índice para listagem cronológica por task
CREATE INDEX IF NOT EXISTS idx_kanban_historico_task_created
  ON public.kanban_historico(task_id, created_at DESC);
