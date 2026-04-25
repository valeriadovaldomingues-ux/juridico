-- =============================================
-- Módulo Comercial — PEDV
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- ── 1. Leads ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text        NOT NULL,
  telefone         text,
  email            text,
  origem           text        NOT NULL DEFAULT 'indicacao'
                               CHECK (origem IN ('indicacao','site','instagram','linkedin','facebook','google','evento','outro')),
  area_interesse   text,
  observacoes      text,
  responsavel_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'novo_lead'
                               CHECK (status IN ('novo_lead','contato_inicial','aguardando_retorno','reuniao_agendada','proposta_enviada','negociacao','fechado','perdido')),
  ordem            integer     NOT NULL DEFAULT 0,
  valor_estimado   numeric,
  cliente_id       uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  convertido_em    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_authenticated" ON public.leads;
CREATE POLICY "leads_authenticated" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leads_status        ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_responsavel   ON public.leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_leads_created       ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ordem         ON public.leads(ordem);

-- ── 2. Atendimentos comerciais ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.atendimentos_comerciais (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  data             date        NOT NULL DEFAULT CURRENT_DATE,
  tipo             text        NOT NULL DEFAULT 'whatsapp'
                               CHECK (tipo IN ('whatsapp','telefone','reuniao','email','presencial','outro')),
  resumo           text        NOT NULL,
  proxima_acao     text,
  responsavel_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos_comerciais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atendimentos_comerciais_authenticated" ON public.atendimentos_comerciais;
CREATE POLICY "atendimentos_comerciais_authenticated"
  ON public.atendimentos_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_atend_lead     ON public.atendimentos_comerciais(lead_id);
CREATE INDEX IF NOT EXISTS idx_atend_data     ON public.atendimentos_comerciais(data DESC);

-- ── 3. Propostas comerciais ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.propostas_comerciais (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  valor            numeric     NOT NULL,
  descricao        text,
  tipo_contratacao text        NOT NULL DEFAULT 'honorarios'
                               CHECK (tipo_contratacao IN ('honorarios','mensalidade','exito','misto')),
  data_envio       date,
  status           text        NOT NULL DEFAULT 'em_elaboracao'
                               CHECK (status IN ('em_elaboracao','enviada','aceita','recusada')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.propostas_comerciais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "propostas_comerciais_authenticated" ON public.propostas_comerciais;
CREATE POLICY "propostas_comerciais_authenticated"
  ON public.propostas_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_propostas_lead   ON public.propostas_comerciais(lead_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON public.propostas_comerciais(status);
