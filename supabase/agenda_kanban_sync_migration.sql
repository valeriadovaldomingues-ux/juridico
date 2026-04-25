-- ─────────────────────────────────────────────────────────────────────────────
-- agenda_kanban_sync_migration.sql
--
-- Vincula kanban_tasks a agenda_items para sincronização automática.
-- Execute APÓS agenda_import_migration.sql e kanban_v2_migration.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. FK de kanban_tasks → agenda_items ─────────────────────────────────────

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS agenda_item_id uuid
    REFERENCES public.agenda_items(id) ON DELETE SET NULL;

-- ── 2. Índice único para deduplicação ────────────────────────────────────────
-- Garante que cada agenda_item gere no máximo uma tarefa no kanban.
-- A condição WHERE exclui tasks manuais (agenda_item_id IS NULL).

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_tasks_agenda_item_dedup
  ON public.kanban_tasks(origem, agenda_item_id)
  WHERE agenda_item_id IS NOT NULL;

-- ── 3. Índice auxiliar para lookups por agenda_item_id ────────────────────────

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_agenda_item_id
  ON public.kanban_tasks(agenda_item_id)
  WHERE agenda_item_id IS NOT NULL;
