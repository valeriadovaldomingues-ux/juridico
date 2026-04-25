-- ─────────────────────────────────────────────────────────────────────────────
-- kanban_sla_simple_migration.sql
--
-- Sistema de SLA enxuto: 3 níveis — normal | atencao | critico
--
-- Execute APÓS kanban_v2_migration.sql.
-- Se já executou kanban_sla_migration.sql (versão complexa), este script
-- remove as colunas antigas e adiciona o modelo simplificado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Remover colunas do modelo complexo anterior (se existirem) ─────────────

ALTER TABLE public.kanban_tasks
  DROP COLUMN IF EXISTS sla_status,
  DROP COLUMN IF EXISTS priority_level;

DROP INDEX IF EXISTS idx_kanban_sla_status;
DROP INDEX IF EXISTS idx_kanban_priority_level;

-- ── 2. Adicionar colunas do modelo simples ────────────────────────────────────

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS sla_level  text
    CHECK (sla_level IN ('normal', 'atencao', 'critico')),
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;  -- prazo da tarefa em ISO

-- ── 3. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kanban_sla_level
  ON public.kanban_tasks(sla_level)
  WHERE sla_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_sla_due_at
  ON public.kanban_tasks(sla_due_at)
  WHERE sla_due_at IS NOT NULL;

-- ── 4. Comentários ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.kanban_tasks.sla_level IS
  'Nível SLA calculado: normal | atencao | critico. Tarefas concluídas retornam normal.';
COMMENT ON COLUMN public.kanban_tasks.sla_due_at IS
  'Prazo da tarefa em ISO (task.data + T23:59:59 quando disponível).';
