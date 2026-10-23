-- =============================================
-- Monitoramento DJEN — Diário de Justiça Eletrônico Nacional — PEDV
-- Execute DEPOIS de monitoramento_migration.sql e publicacoes_migration.sql
-- Execute no Supabase Dashboard → SQL Editor → New Query
--
-- Aditiva e idempotente: não remove colunas nem dados existentes.
-- Reversão: ver bloco comentado ao final do arquivo.
-- =============================================

-- ─── publicacoes: campos da fonte DJEN ───────────────────────────────────────
-- fonte_id/fonte_codigo existem no banco de produção mas não constam da
-- publicacoes_migration.sql; os guards abaixo tornam este arquivo autossuficiente.
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS fonte_id               uuid REFERENCES public.publicacao_fontes(id) ON DELETE SET NULL;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS fonte_codigo           text;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS id_externo             text;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS url_oficial            text;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS tipo_comunicacao       text;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS partes                 jsonb;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS advogados_publicacao   jsonb;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS dados_brutos           jsonb;
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS grau_confianca_vinculo text
  CHECK (grau_confianca_vinculo IS NULL OR grau_confianca_vinculo IN ('exata','multipla','nenhuma','manual'));

-- Número CNJ normalizado (somente dígitos) para vinculação por índice
ALTER TABLE public.publicacoes ADD COLUMN IF NOT EXISTS numero_processo_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(numero_processo, ''), '\D', '', 'g')) STORED;

-- ─── publicacoes: CHECK de origem ────────────────────────────────────────────
-- O CHECK atual só aceita manual/importacao/datajud_*. O código de fontes DJEN
-- por tribunal insere valores *_djen, que hoje violam o constraint e são
-- perdidos silenciosamente. Amplia a lista preservando os valores legados e
-- adicionando a fonte consolidada 'djen'.
ALTER TABLE public.publicacoes DROP CONSTRAINT IF EXISTS publicacoes_origem_check;
ALTER TABLE public.publicacoes ADD CONSTRAINT publicacoes_origem_check
  CHECK (origem IN (
    'manual','importacao',
    'datajud_oab','datajud_nome','datajud_processo','datajud_combinado',
    'djen',
    'superior_djen','trf_djen','tj_djen','tjsp_djen','trt_djen','trt3_djen','trt3_dejt'
  ));

-- Dedup pelo identificador oficial da comunicação no DJEN
CREATE UNIQUE INDEX IF NOT EXISTS uq_publicacoes_djen_id_externo
  ON public.publicacoes (id_externo)
  WHERE id_externo IS NOT NULL AND fonte_codigo = 'djen';

CREATE INDEX IF NOT EXISTS idx_publicacoes_numero_digits
  ON public.publicacoes (numero_processo_digits)
  WHERE numero_processo_digits <> '';

CREATE INDEX IF NOT EXISTS idx_publicacoes_fonte_codigo
  ON public.publicacoes (fonte_codigo);

-- ─── advogados_monitorados: cadastro completo de monitoramento ───────────────
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS termos_adicionais       text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS variacoes_nome          text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS tribunais_interesse     text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS data_inicial_busca      date;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS frequencia              text NOT NULL DEFAULT 'diaria'
  CHECK (frequencia IN ('diaria','manual'));
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS ultima_execucao         timestamptz;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS proxima_execucao        timestamptz;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS status_ultima_execucao  text
  CHECK (status_ultima_execucao IS NULL OR status_ultima_execucao IN ('sucesso','erro','parcial'));
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS erro_ultima_execucao    text;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS publicacoes_encontradas integer NOT NULL DEFAULT 0;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS criado_por              uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS atualizado_por          uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.advogados_monitorados ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();

-- ─── monitoramento_logs: auditoria completa da execução ─────────────────────
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS fonte          text;
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS usuario_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS periodo_inicio date;
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS periodo_fim    date;
ALTER TABLE public.monitoramento_logs ADD COLUMN IF NOT EXISTS total_falhas   integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_monitoramento_logs_fonte
  ON public.monitoramento_logs (fonte, executado_em DESC);

-- ─── publicacao_fontes: DJEN como fonte identificável ────────────────────────
INSERT INTO public.publicacao_fontes (nome, codigo, tipo, descricao, ativo)
SELECT
  'DJEN — Diário de Justiça Eletrônico Nacional',
  'djen',
  'diario_oficial',
  'Consulta pública oficial de comunicações processuais do CNJ (comunicaapi.pje.jus.br). Canal de publicidade processual — não confundir com o Domicílio Judicial Eletrônico (comunicações pessoais/citações), que não está integrado.',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.publicacao_fontes WHERE codigo = 'djen');

-- =============================================
-- Reversão (executar manualmente apenas se necessário):
--   DROP INDEX IF EXISTS uq_publicacoes_djen_id_externo;
--   DROP INDEX IF EXISTS idx_publicacoes_numero_digits;
--   DROP INDEX IF EXISTS idx_publicacoes_fonte_codigo;
--   DROP INDEX IF EXISTS idx_monitoramento_logs_fonte;
--   ALTER TABLE public.publicacoes
--     DROP COLUMN IF EXISTS id_externo, DROP COLUMN IF EXISTS url_oficial,
--     DROP COLUMN IF EXISTS tipo_comunicacao, DROP COLUMN IF EXISTS partes,
--     DROP COLUMN IF EXISTS advogados_publicacao, DROP COLUMN IF EXISTS dados_brutos,
--     DROP COLUMN IF EXISTS grau_confianca_vinculo, DROP COLUMN IF EXISTS numero_processo_digits;
--   (colunas novas de advogados_monitorados e monitoramento_logs idem;
--    restaurar o CHECK antigo de origem exigiria limpar valores novos antes)
-- =============================================
