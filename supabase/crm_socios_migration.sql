-- ═════════════════════════════════════════════════════════════════════════════
-- CRM Cris e Val — funil de oportunidades + propostas de honorários
--
-- ⚠️  SÓ APLICAR COM AUTORIZAÇÃO EXPRESSA DA VALÉRIA.
--     Esta migração ainda NÃO foi aplicada em produção. Até lá, a tela
--     /crm-socios mostra "módulo aguardando ativação" (não dá erro).
--
-- O que faz (100% aditivo e idempotente):
--   • cria 3 tabelas novas, todas com prefixo crm_socios_:
--       crm_socios_oportunidades, crm_socios_interacoes, crm_socios_propostas
--   • cria 1 função (crm_socios_set_updated_at) e 2 triggers de updated_at
--   • cria índices, CHECKs, RLS e policies SÓ para as tabelas novas
--
-- O que NÃO faz:
--   • não altera, não apaga e não lê nenhuma tabela/policy/função existente
--     (leads e propostas_comerciais — CRM da Luciana — ficam intactas);
--   • não cria current_user_role(): usa a que já existe em produção.
--
-- Segurança — diferente da maioria das tabelas do sistema ("Authenticated full
-- access"), aqui a RLS é de verdade: só papel 'socio' lê/escreve, inclusive via
-- PostgREST direto. anon não tem acesso nenhum.
--
-- Pré-requisitos (já existem em produção): public.profiles, public.clientes,
-- public.current_user_role(), extensão pgcrypto/gen_random_uuid().
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Oportunidades ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_socios_oportunidades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               TEXT NOT NULL,                       -- pessoa ou empresa
  tipo_pessoa        TEXT NOT NULL DEFAULT 'juridica',
  contato_nome       TEXT,
  contato_telefone   TEXT,
  contato_email      TEXT,
  origem             TEXT,                                -- como chegou (texto livre)
  indicado_por       TEXT,                                -- quem indicou (texto livre)
  area_interesse     TEXT,
  valor_estimado     NUMERIC(14,2),
  responsavel_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  etapa              TEXT NOT NULL DEFAULT 'contato_inicial',
  status             TEXT NOT NULL DEFAULT 'aberto',      -- derivado da etapa (ver CHECK abaixo)
  proxima_acao       TEXT,
  proxima_acao_data  DATE,
  ultimo_contato_em  TIMESTAMPTZ,                         -- atualizado ao registrar interação
  motivo_perda       TEXT,
  notas              TEXT,
  cliente_id         UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  data_fechamento    TIMESTAMPTZ,
  criado_por         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT crm_socios_oport_tipo_pessoa_ck CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  CONSTRAINT crm_socios_oport_etapa_ck CHECK (etapa IN (
    'contato_inicial', 'reuniao_marcada', 'reuniao_feita',
    'proposta_enviada', 'negociacao', 'fechado', 'perdido'
  )),
  CONSTRAINT crm_socios_oport_status_ck CHECK (status IN ('aberto', 'ganho', 'perdido')),
  -- status acompanha a etapa: fechado = ganho, perdido = perdido, o resto = aberto
  CONSTRAINT crm_socios_oport_etapa_status_ck CHECK (
    (etapa = 'fechado' AND status = 'ganho')
    OR (etapa = 'perdido' AND status = 'perdido')
    OR (etapa NOT IN ('fechado', 'perdido') AND status = 'aberto')
  ),
  CONSTRAINT crm_socios_oport_valor_ck CHECK (valor_estimado IS NULL OR valor_estimado >= 0)
);

CREATE INDEX IF NOT EXISTS crm_socios_oport_etapa_idx        ON public.crm_socios_oportunidades (etapa);
CREATE INDEX IF NOT EXISTS crm_socios_oport_status_idx       ON public.crm_socios_oportunidades (status);
CREATE INDEX IF NOT EXISTS crm_socios_oport_proxima_acao_idx ON public.crm_socios_oportunidades (proxima_acao_data) WHERE proxima_acao_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_socios_oport_responsavel_idx  ON public.crm_socios_oportunidades (responsavel_id);
CREATE INDEX IF NOT EXISTS crm_socios_oport_cliente_idx      ON public.crm_socios_oportunidades (cliente_id) WHERE cliente_id IS NOT NULL;

-- ── 2. Interações (histórico) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_socios_interacoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id  UUID NOT NULL REFERENCES public.crm_socios_oportunidades(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL,
  data_interacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  descricao        TEXT NOT NULL,
  autor_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT crm_socios_inter_tipo_ck CHECK (tipo IN ('ligacao', 'reuniao', 'whatsapp', 'email', 'nota'))
);

CREATE INDEX IF NOT EXISTS crm_socios_inter_oportunidade_idx ON public.crm_socios_interacoes (oportunidade_id, data_interacao DESC);

-- ── 3. Propostas de honorários ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_socios_propostas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id  UUID NOT NULL REFERENCES public.crm_socios_oportunidades(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  valor            NUMERIC(14,2),
  tipo_honorario   TEXT NOT NULL DEFAULT 'fixo',
  forma_pagamento  TEXT,                                  -- texto livre (ex.: "3x no boleto", "10% do êxito")
  data_envio       DATE,
  validade         DATE,
  status           TEXT NOT NULL DEFAULT 'rascunho',
  observacoes      TEXT,
  criado_por       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT crm_socios_prop_tipo_ck   CHECK (tipo_honorario IN ('fixo', 'mensal', 'exito', 'misto')),
  CONSTRAINT crm_socios_prop_status_ck CHECK (status IN ('rascunho', 'enviada', 'aceita', 'recusada')),
  CONSTRAINT crm_socios_prop_valor_ck  CHECK (valor IS NULL OR valor >= 0)
);

CREATE INDEX IF NOT EXISTS crm_socios_prop_oportunidade_idx ON public.crm_socios_propostas (oportunidade_id);
CREATE INDEX IF NOT EXISTS crm_socios_prop_status_idx       ON public.crm_socios_propostas (status);

-- ── 4. updated_at automático (mesmo padrão de cobrancas_inter_migration.sql) ─
CREATE OR REPLACE FUNCTION public.crm_socios_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_socios_oportunidades_updated_at ON public.crm_socios_oportunidades;
CREATE TRIGGER trg_crm_socios_oportunidades_updated_at
  BEFORE UPDATE ON public.crm_socios_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.crm_socios_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_socios_propostas_updated_at ON public.crm_socios_propostas;
CREATE TRIGGER trg_crm_socios_propostas_updated_at
  BEFORE UPDATE ON public.crm_socios_propostas
  FOR EACH ROW EXECUTE FUNCTION public.crm_socios_set_updated_at();

-- ── 5. Segurança: RLS de verdade (só sócio) ──────────────────────────────────
ALTER TABLE public.crm_socios_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_socios_interacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_socios_propostas     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_socios_oportunidades_somente_socio" ON public.crm_socios_oportunidades;
CREATE POLICY "crm_socios_oportunidades_somente_socio"
  ON public.crm_socios_oportunidades
  FOR ALL TO authenticated
  USING      (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

DROP POLICY IF EXISTS "crm_socios_interacoes_somente_socio" ON public.crm_socios_interacoes;
CREATE POLICY "crm_socios_interacoes_somente_socio"
  ON public.crm_socios_interacoes
  FOR ALL TO authenticated
  USING      (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

DROP POLICY IF EXISTS "crm_socios_propostas_somente_socio" ON public.crm_socios_propostas;
CREATE POLICY "crm_socios_propostas_somente_socio"
  ON public.crm_socios_propostas
  FOR ALL TO authenticated
  USING      (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

-- anon não enxerga nada. authenticated recebe o privilégio de tabela, mas a policy
-- acima só deixa passar quem é sócio (os demais papéis veem 0 linhas e não escrevem).
REVOKE ALL ON public.crm_socios_oportunidades FROM anon;
REVOKE ALL ON public.crm_socios_interacoes    FROM anon;
REVOKE ALL ON public.crm_socios_propostas     FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_socios_oportunidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_socios_interacoes    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_socios_propostas     TO authenticated;

GRANT ALL ON public.crm_socios_oportunidades TO service_role;
GRANT ALL ON public.crm_socios_interacoes    TO service_role;
GRANT ALL ON public.crm_socios_propostas     TO service_role;

-- Recarrega o schema cache do PostgREST para a API enxergar as tabelas na hora.
NOTIFY pgrst, 'reload schema';

-- ── Rollback (manual, só se precisar desfazer; apaga os dados do módulo) ─────
-- DROP TABLE IF EXISTS public.crm_socios_propostas;
-- DROP TABLE IF EXISTS public.crm_socios_interacoes;
-- DROP TABLE IF EXISTS public.crm_socios_oportunidades;
-- DROP FUNCTION IF EXISTS public.crm_socios_set_updated_at();
