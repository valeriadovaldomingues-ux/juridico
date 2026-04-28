-- =============================================
-- Agenda: Soft Delete + Auditoria
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================

-- ── 1. Adiciona colunas de soft delete ─────────────────────────────────────────

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice: filtra itens não excluídos com custo zero
CREATE INDEX IF NOT EXISTS idx_agenda_not_deleted
  ON public.agenda_items(deleted_at)
  WHERE deleted_at IS NULL;

-- ── 2. Tabela de auditoria de ações na agenda ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agenda_audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  acao         text        NOT NULL,          -- 'delete','complete','reschedule','bulk_delete', etc.
  item_ids     uuid[]      NOT NULL,          -- IDs dos itens afetados
  usuario_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  detalhes     jsonb,                         -- contexto extra (nova data, motivo, etc.)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_audit_usuario
  ON public.agenda_audit_log(usuario_id);

CREATE INDEX IF NOT EXISTS idx_agenda_audit_created
  ON public.agenda_audit_log(created_at DESC);

ALTER TABLE public.agenda_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access_agenda_audit"
  ON public.agenda_audit_log FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
