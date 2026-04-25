-- ─────────────────────────────────────────────────────────────────────────────
-- kanban_trello_member_id.sql
--
-- Adiciona coluna trello_member_id à kanban_tasks.
-- Permite redistribuir responsáveis via SQL sem chamar a API do Trello,
-- pois o sync passa a armazenar o ID bruto do membro do card.
--
-- Execute ANTES de rodar o próximo sync com sync.ts atualizado.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS trello_member_id text;

COMMENT ON COLUMN public.kanban_tasks.trello_member_id IS
  'ID do primeiro membro Trello atribuído ao card (idMembers[0]). '
  'Populado pelo sync; permite redistribuição de responsável via SQL '
  'cruzando com trello_member_mappings.trello_member_id.';

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_trello_member_id
  ON public.kanban_tasks(trello_member_id)
  WHERE trello_member_id IS NOT NULL;
