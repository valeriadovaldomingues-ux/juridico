-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 2: tabela portal_clientes
-- Vínculo entre auth.users do cliente externo e o registro clientes (CRM)
-- Idempotente: CREATE TABLE IF NOT EXISTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.portal_clientes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK para o usuário autenticado (auth.users)
  -- UNIQUE: cada auth user pode ter apenas um vínculo por cliente
  auth_user_id   uuid        NOT NULL UNIQUE
                               REFERENCES auth.users(id) ON DELETE CASCADE,

  -- FK para o registro de cliente no CRM
  cliente_id     uuid        NOT NULL
                               REFERENCES public.clientes(id) ON DELETE CASCADE,

  -- Controle de acesso
  ativo          boolean     NOT NULL DEFAULT true,

  -- Rastreabilidade
  convidado_por  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  convidado_em   timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso  timestamptz,

  -- Um auth user pode ser vinculado ao mesmo cliente apenas uma vez
  UNIQUE (auth_user_id, cliente_id)
);

-- RLS
ALTER TABLE public.portal_clientes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_clientes TO authenticated;

-- Staff interno vê todos os vínculos
DROP POLICY IF EXISTS "portal_clientes_staff" ON public.portal_clientes;
CREATE POLICY "portal_clientes_staff"
  ON public.portal_clientes FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

-- Cliente externo vê apenas o próprio vínculo
DROP POLICY IF EXISTS "portal_clientes_self" ON public.portal_clientes;
CREATE POLICY "portal_clientes_self"
  ON public.portal_clientes FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND auth_user_id = auth.uid()
    AND ativo = true
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_portal_clientes_auth_user
  ON public.portal_clientes(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_portal_clientes_cliente
  ON public.portal_clientes(cliente_id);

CREATE INDEX IF NOT EXISTS idx_portal_clientes_ativo
  ON public.portal_clientes(ativo)
  WHERE ativo = true;
