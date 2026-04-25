-- ─────────────────────────────────────────────────────────────────────────────
-- kanban_sla_migration.sql
--
-- Adiciona campos de SLA à tabela kanban_tasks.
-- Execute APÓS kanban_v2_migration.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Novos campos de SLA ────────────────────────────────────────────────────

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS sla_due_at     timestamptz,
  ADD COLUMN IF NOT EXISTS sla_status     text
    CHECK (sla_status IN ('on_time', 'warning', 'overdue')),
  ADD COLUMN IF NOT EXISTS priority_level text
    CHECK (priority_level IN ('low', 'normal', 'high', 'critical'));

-- ── 2. Índices para dashboard e filtros ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kanban_sla_status     ON public.kanban_tasks(sla_status);
CREATE INDEX IF NOT EXISTS idx_kanban_priority_level ON public.kanban_tasks(priority_level);
CREATE INDEX IF NOT EXISTS idx_kanban_sla_due_at     ON public.kanban_tasks(sla_due_at)
  WHERE sla_due_at IS NOT NULL;

-- ── 3. Comentários ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.kanban_tasks.sla_due_at IS
  'Prazo SLA calculado. Se a tarefa tem campo data, usa T23:59:59; caso contrário, created_at + SLA_HORAS por tipo/origem.';
COMMENT ON COLUMN public.kanban_tasks.sla_status IS
  'Status SLA calculado: on_time | warning (< 25% ou < 24h) | overdue (vencido).';
COMMENT ON COLUMN public.kanban_tasks.priority_level IS
  'Prioridade calculada pelo SLA: low (concluída) | normal | high | critical.';
