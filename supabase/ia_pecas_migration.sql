-- =============================================
-- Histórico de peças jurídicas geradas pela IA
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.ia_pecas (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id         uuid        NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  tipo_peca           text        NOT NULL,
  tipo_peca_label     text        NOT NULL,
  conteudo            text        NOT NULL,
  instrucoes          text,
  analise_estrategica jsonb,                          -- JSON da análise gerada antes da peça
  status              text        NOT NULL DEFAULT 'rascunho'
                                  CHECK (status IN ('rascunho', 'revisao', 'aprovada', 'rejeitada')),
  gerado_por          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  revisado_por        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  revisao_comentario  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ia_pecas_processo_idx   ON public.ia_pecas(processo_id);
CREATE INDEX IF NOT EXISTS ia_pecas_status_idx     ON public.ia_pecas(status);
CREATE INDEX IF NOT EXISTS ia_pecas_gerado_por_idx ON public.ia_pecas(gerado_por);
CREATE INDEX IF NOT EXISTS ia_pecas_created_idx    ON public.ia_pecas(created_at DESC);

ALTER TABLE public.ia_pecas ENABLE ROW LEVEL SECURITY;

-- Acesso total para usuários autenticados (controle de roles na API)
CREATE POLICY "authenticated_full_access_ia_pecas"
  ON public.ia_pecas FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
