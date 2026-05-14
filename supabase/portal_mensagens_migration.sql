-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 4: tabela portal_mensagens
-- Canal de comunicação cliente↔escritório — separado de contact_interactions
-- (contact_interactions é CRM interno; portal_mensagens é canal externo)
-- Idempotente: CREATE TABLE IF NOT EXISTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.portal_mensagens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexto
  cliente_id   uuid        NOT NULL REFERENCES public.clientes(id)   ON DELETE CASCADE,
  processo_id  uuid                    REFERENCES public.processos(id) ON DELETE SET NULL,

  -- Autoria
  autor_tipo   text        NOT NULL
    CHECK (autor_tipo IN ('cliente', 'escritorio')),
  autor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Conteúdo
  conteudo     text        NOT NULL,
  lida         boolean     NOT NULL DEFAULT false,

  -- Classificação
  tipo         text        NOT NULL DEFAULT 'mensagem'
    CHECK (tipo IN ('mensagem', 'solicitacao_documento', 'solicitacao_prazo', 'outro')),
  status       text        NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_atendimento', 'resolvida', 'encerrada')),

  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.portal_mensagens ENABLE ROW LEVEL SECURITY;

-- Staff interno vê todas as mensagens dos seus clientes
DROP POLICY IF EXISTS "portal_mensagens_staff" ON public.portal_mensagens;
CREATE POLICY "portal_mensagens_staff"
  ON public.portal_mensagens FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

-- Cliente vê apenas as mensagens do seu próprio vínculo
DROP POLICY IF EXISTS "portal_mensagens_cliente_select" ON public.portal_mensagens;
CREATE POLICY "portal_mensagens_cliente_select"
  ON public.portal_mensagens FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id   = portal_mensagens.cliente_id
        AND pc.ativo        = true
    )
  );

-- Cliente pode inserir mensagens apenas para o seu próprio cliente_id
DROP POLICY IF EXISTS "portal_mensagens_cliente_insert" ON public.portal_mensagens;
CREATE POLICY "portal_mensagens_cliente_insert"
  ON public.portal_mensagens FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'cliente'
    AND autor_tipo = 'cliente'
    AND autor_id   = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id   = portal_mensagens.cliente_id
        AND pc.ativo        = true
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_portal_mensagens_cliente
  ON public.portal_mensagens(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_mensagens_processo
  ON public.portal_mensagens(processo_id)
  WHERE processo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_mensagens_nao_lidas
  ON public.portal_mensagens(cliente_id, lida)
  WHERE lida = false;
