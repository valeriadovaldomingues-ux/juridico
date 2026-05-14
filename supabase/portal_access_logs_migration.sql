-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 5: tabela portal_access_logs
-- Log auditável de ações do cliente no portal
-- Idempotente: CREATE TABLE IF NOT EXISTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.portal_access_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem
  user_id      uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  cliente_id   uuid        NOT NULL REFERENCES public.clientes(id)  ON DELETE CASCADE,

  -- O quê
  acao         text        NOT NULL
    CHECK (acao IN (
      'login',
      'view_processo',
      'view_agenda',
      'view_documento',
      'download_documento',
      'send_message',
      'view_mensagens',
      'view_perfil'
    )),

  -- Contexto
  resource_id  uuid,          -- ID do processo/doc acessado (quando aplicável)
  detalhes     jsonb,         -- payload extra (ex: nome do arquivo baixado)

  -- Metadados de rede
  ip_address   text,
  user_agent   text,

  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.portal_access_logs ENABLE ROW LEVEL SECURITY;

-- Staff (gerente/sócio) vê todos os logs para auditoria
DROP POLICY IF EXISTS "portal_logs_staff" ON public.portal_access_logs;
CREATE POLICY "portal_logs_staff"
  ON public.portal_access_logs FOR SELECT TO authenticated
  USING (
    current_user_role() IN ('gerente', 'socio')
  );

-- Cliente vê apenas o próprio histórico
DROP POLICY IF EXISTS "portal_logs_cliente_select" ON public.portal_access_logs;
CREATE POLICY "portal_logs_cliente_select"
  ON public.portal_access_logs FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND user_id = auth.uid()
  );

-- Qualquer autenticado pode inserir o próprio log (client + server-side)
DROP POLICY IF EXISTS "portal_logs_insert" ON public.portal_access_logs;
CREATE POLICY "portal_logs_insert"
  ON public.portal_access_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_portal_logs_user
  ON public.portal_access_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_logs_cliente
  ON public.portal_access_logs(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_logs_acao
  ON public.portal_access_logs(acao, created_at DESC);
