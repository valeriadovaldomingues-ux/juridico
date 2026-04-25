-- =============================================
-- Módulo Publicações Jurídicas — PEDV
-- Execute DEPOIS do monitoramento_migration.sql
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.publicacoes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do processo
  numero_processo         text,
  processo_id             uuid        REFERENCES public.processos(id) ON DELETE SET NULL,

  -- Origem da publicação
  tribunal                text,
  orgao                   text,
  diario                  text,
  data_publicacao         date,
  data_disponibilizacao   date,

  -- Conteúdo
  nome_pesquisado         text        NOT NULL DEFAULT '',
  texto_publicacao        text,
  resumo                  text,
  tipo_publicacao         text        NOT NULL DEFAULT 'publicacao'
                          CHECK (tipo_publicacao IN ('intimacao','publicacao','despacho','sentenca','acordao','outro')),

  -- Detecção automática
  prazo_detectado         boolean     NOT NULL DEFAULT false,
  prazo_dias              integer,
  prazo_data              date,
  prazo_descricao         text,
  audiencia_detectada     boolean     NOT NULL DEFAULT false,
  audiencia_data          date,
  audiencia_descricao     text,

  -- Status de tratamento
  status                  text        NOT NULL DEFAULT 'nao_tratada'
                          CHECK (status IN ('nao_tratada','tratada','descartada')),

  -- Deduplicação
  hash                    text        NOT NULL,

  -- Campos extras (monitoramento automático)
  advogado_monitorado_id  uuid        REFERENCES public.advogados_monitorados(id) ON DELETE SET NULL,
  oab_pesquisada          text,
  termo_encontrado        text,
  origem                  text        NOT NULL DEFAULT 'manual'
                          CHECK (origem IN ('manual','importacao','datajud_oab','datajud_nome','datajud_processo','datajud_combinado')),

  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hash)
);

ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access"
  ON public.publicacoes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pub_status       ON public.publicacoes(status);
CREATE INDEX IF NOT EXISTS idx_pub_tribunal     ON public.publicacoes(tribunal);
CREATE INDEX IF NOT EXISTS idx_pub_data         ON public.publicacoes(data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_prazo_flag   ON public.publicacoes(prazo_detectado);
CREATE INDEX IF NOT EXISTS idx_pub_aud_flag     ON public.publicacoes(audiencia_detectada);
CREATE INDEX IF NOT EXISTS idx_pub_hash_u       ON public.publicacoes(hash);
CREATE INDEX IF NOT EXISTS idx_pub_processo     ON public.publicacoes(processo_id);
CREATE INDEX IF NOT EXISTS idx_pub_created      ON public.publicacoes(created_at DESC);
