-- =============================================
-- Central de Publicações Oficiais — Fontes
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================

-- ── 1. Tabela de fontes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.publicacao_fontes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL,             -- "Themis", "Oficial", "TRT 3ª Região MG"
  codigo        text        NOT NULL,             -- "themis", "oficial", "trt", "tj" (para filtros)
  tipo          text        NOT NULL
                CHECK (tipo IN ('contratado_pago', 'tribunal_oficial', 'diario_oficial', 'manual')),
  descricao     text,
  -- Credenciais de e-mail (armazenadas criptografadas pelo Supabase RLS)
  email_config  jsonb,                            -- { host, port, user, password, mailbox, ssl }
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacao_fontes_codigo ON public.publicacao_fontes(codigo);

ALTER TABLE public.publicacao_fontes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access_publicacao_fontes"
  ON public.publicacao_fontes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Fontes iniciais ───────────────────────────────────────────────────────

INSERT INTO public.publicacao_fontes (nome, codigo, tipo, descricao) VALUES
  ('Themis',   'themis',  'contratado_pago',   'Serviço contratado de monitoramento de publicações Themis'),
  ('Oficial',  'oficial', 'contratado_pago',   'Serviço contratado de publicações Oficial'),
  ('TRT',      'trt',     'tribunal_oficial',  'Tribunais Regionais do Trabalho'),
  ('TJ',       'tj',      'tribunal_oficial',  'Tribunais de Justiça estaduais')
ON CONFLICT (codigo) DO NOTHING;

-- ── 3. Novos campos na tabela publicacoes ────────────────────────────────────

-- Vínculo com a fonte
ALTER TABLE public.publicacoes
  ADD COLUMN IF NOT EXISTS fonte_id          uuid REFERENCES public.publicacao_fontes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fonte_codigo      text,                   -- "themis", "oficial", "trt", "tj"

  -- Dados do e-mail de origem
  ADD COLUMN IF NOT EXISTS email_remetente   text,
  ADD COLUMN IF NOT EXISTS email_assunto     text,
  ADD COLUMN IF NOT EXISTS message_id        text,                   -- Message-ID do e-mail (dedup)

  -- Localização processual
  ADD COLUMN IF NOT EXISTS comarca           text,
  ADD COLUMN IF NOT EXISTS vara              text,

  -- Partes (enriquecimento manual ou via IA)
  ADD COLUMN IF NOT EXISTS cliente           text,
  ADD COLUMN IF NOT EXISTS parte_contraria   text,

  -- Urgência calculada
  ADD COLUMN IF NOT EXISTS urgencia          text
                           CHECK (urgencia IN ('critica', 'alta', 'media', 'baixa')),

  -- Prazo SUGERIDO (nunca criado automaticamente — aguarda revisão humana)
  ADD COLUMN IF NOT EXISTS prazo_sugerido    date,

  -- Fluxo de revisão obrigatório antes de gerar prazo fatal
  ADD COLUMN IF NOT EXISTS status_revisao    text NOT NULL DEFAULT 'pendente'
                           CHECK (status_revisao IN ('pendente', 'em_revisao', 'aprovado', 'descartado')),

  -- Auditoria de revisão
  ADD COLUMN IF NOT EXISTS revisado_por      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_em       timestamptz,
  ADD COLUMN IF NOT EXISTS revisao_nota      text,

  -- Anexo
  ADD COLUMN IF NOT EXISTS anexo_nome        text,
  ADD COLUMN IF NOT EXISTS anexo_url         text,

  -- Ações já tomadas
  ADD COLUMN IF NOT EXISTS tratado_em        timestamptz,
  ADD COLUMN IF NOT EXISTS acao_tomada       text;

-- Para publicações existentes: já foram revisadas (retroativo seguro)
UPDATE public.publicacoes
SET status_revisao = 'aprovado'
WHERE status_revisao = 'pendente' AND created_at < now() - interval '1 minute';

-- ── 4. Índices de deduplicação e performance ─────────────────────────────────

-- Dedup por message_id do e-mail
CREATE UNIQUE INDEX IF NOT EXISTS idx_pub_message_id
  ON public.publicacoes(message_id) WHERE message_id IS NOT NULL;

-- Dedup composto: (numero_processo, data_publicacao, fonte_codigo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pub_proc_data_fonte
  ON public.publicacoes(numero_processo, data_publicacao, fonte_codigo)
  WHERE numero_processo IS NOT NULL AND data_publicacao IS NOT NULL AND fonte_codigo IS NOT NULL;

-- Performance para filtros por fonte
CREATE INDEX IF NOT EXISTS idx_pub_fonte_codigo
  ON public.publicacoes(fonte_codigo)
  WHERE fonte_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_status_revisao
  ON public.publicacoes(status_revisao);

CREATE INDEX IF NOT EXISTS idx_pub_urgencia
  ON public.publicacoes(urgencia)
  WHERE urgencia IS NOT NULL;
