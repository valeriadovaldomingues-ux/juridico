-- =============================================
-- Módulo Monitoramento de Publicações — PEDV
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- ─── Advogados monitorados ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.advogados_monitorados (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text       NOT NULL,
  oab_numero   text        NOT NULL,
  oab_uf       text        NOT NULL CHECK (length(oab_uf) = 2),
  ativo        boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oab_numero, oab_uf)
);

ALTER TABLE public.advogados_monitorados ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.advogados_monitorados TO authenticated;
CREATE POLICY "Authenticated full access"
  ON public.advogados_monitorados FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ─── Publicações monitoradas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publicacoes_monitoradas (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  advogado_monitorado_id  uuid        REFERENCES public.advogados_monitorados(id) ON DELETE SET NULL,
  nome_pesquisado         text        NOT NULL,
  oab_pesquisada          text,
  processo_id             uuid        REFERENCES public.processos(id) ON DELETE SET NULL,
  numero_processo         text,
  tribunal                text,
  data_publicacao         date,
  data_disponibilizacao   date,
  texto_publicacao        text,
  termo_encontrado        text,
  tipo_resultado          text        NOT NULL DEFAULT 'publicacao'
                          CHECK (tipo_resultado IN ('intimacao','publicacao','despacho','sentenca','acordao','outro')),
  prazo_detectado         boolean     NOT NULL DEFAULT false,
  prazo_dias              integer,
  prazo_data              date,
  prazo_descricao         text,
  audiencia_detectada     boolean     NOT NULL DEFAULT false,
  audiencia_data          date,
  audiencia_descricao     text,
  hash_publicacao         text        NOT NULL,
  status_tratamento       text        NOT NULL DEFAULT 'nova'
                          CHECK (status_tratamento IN ('nova','lida','tratada','descartada')),
  origem                  text        NOT NULL DEFAULT 'datajud_oab'
                          CHECK (origem IN ('datajud_oab','datajud_nome','datajud_processo','datajud_combinado','manual')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hash_publicacao)
);

ALTER TABLE public.publicacoes_monitoradas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.publicacoes_monitoradas TO authenticated;
CREATE POLICY "Authenticated full access"
  ON public.publicacoes_monitoradas FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pub_advogado   ON public.publicacoes_monitoradas(advogado_monitorado_id);
CREATE INDEX IF NOT EXISTS idx_pub_status     ON public.publicacoes_monitoradas(status_tratamento);
CREATE INDEX IF NOT EXISTS idx_pub_tribunal   ON public.publicacoes_monitoradas(tribunal);
CREATE INDEX IF NOT EXISTS idx_pub_data       ON public.publicacoes_monitoradas(data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_prazo      ON public.publicacoes_monitoradas(prazo_detectado);
CREATE INDEX IF NOT EXISTS idx_pub_audiencia  ON public.publicacoes_monitoradas(audiencia_detectada);
CREATE INDEX IF NOT EXISTS idx_pub_hash       ON public.publicacoes_monitoradas(hash_publicacao);

-- ─── Logs de execução ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitoramento_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em      timestamptz NOT NULL DEFAULT now(),
  total_advogados   integer     NOT NULL DEFAULT 0,
  total_pesquisas   integer     NOT NULL DEFAULT 0,
  total_encontradas integer     NOT NULL DEFAULT 0,
  total_novas       integer     NOT NULL DEFAULT 0,
  total_duplicadas  integer     NOT NULL DEFAULT 0,
  duracao_ms        integer,
  erro              text,
  detalhes_json     jsonb,
  disparado_por     text        NOT NULL DEFAULT 'manual'
                    CHECK (disparado_por IN ('manual','cron','api'))
);

ALTER TABLE public.monitoramento_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.monitoramento_logs TO authenticated;
CREATE POLICY "Authenticated full access"
  ON public.monitoramento_logs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_log_executado ON public.monitoramento_logs(executado_em DESC);

-- ─── Pré-cadastro dos advogados monitorados ────────────────────────────────────
INSERT INTO public.advogados_monitorados (nome_completo, oab_numero, oab_uf) VALUES
  ('CRISTIANO PESSOA SOUSA', '88465', 'MG'),
  ('CRISTIANO PESSOA SOUSA', '66507', 'PE'),
  ('CRISTIANO PESSOA SOUSA', '77178', 'DF'),
  ('CRISTIANO PESSOA SOUSA', '213527', 'RJ'),
  ('CRISTIANO PESSOA SOUSA', '523464', 'SP'),
  ('VALÉRIA FERREIRA DO VAL DOMINGUES PESSOA', '98185', 'MG')
ON CONFLICT (oab_numero, oab_uf) DO NOTHING;
