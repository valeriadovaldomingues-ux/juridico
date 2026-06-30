-- PEDV - Modulo de cobrancas Inter BolePix
-- Aplicar no Supabase SQL editor ou via CLI antes de usar /financeiro/cobrancas.

CREATE TABLE IF NOT EXISTS public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contrato_id uuid NULL,
  processo_id uuid NULL REFERENCES public.processos(id) ON DELETE SET NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_vencimento date NOT NULL,
  descricao text NOT NULL,
  parcela_numero integer NOT NULL DEFAULT 1 CHECK (parcela_numero > 0),
  parcela_total integer NOT NULL DEFAULT 1 CHECK (parcela_total > 0),
  status text NOT NULL DEFAULT 'rascunho',
  inter_status text NULL,
  inter_cobranca_id text NULL,
  nosso_numero text NULL,
  linha_digitavel text NULL,
  codigo_barras text NULL,
  pix_qrcode text NULL,
  pix_copia_cola text NULL,
  boleto_pdf_url text NULL,
  data_pagamento timestamptz NULL,
  valor_pago numeric(14,2) NULL,
  payload_criacao jsonb NULL,
  payload_ultimo_status jsonb NULL,
  erro_emissao text NULL,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cobrancas_status_check CHECK (
    status IN ('rascunho', 'pendente', 'processando', 'emitida', 'erro_emissao', 'vencida', 'paga', 'cancelada')
  ),
  CONSTRAINT cobrancas_parcela_check CHECK (parcela_numero <= parcela_total)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_idempotency_key
  ON public.cobrancas(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_parcela_unica
  ON public.cobrancas(cliente_id, COALESCE(processo_id, '00000000-0000-0000-0000-000000000000'::uuid), data_vencimento, parcela_numero, parcela_total, valor)
  WHERE status <> 'cancelada';

CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON public.cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_processo ON public.cobrancas(processo_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_vencimento ON public.cobrancas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_inter_id ON public.cobrancas(inter_cobranca_id);

CREATE TABLE IF NOT EXISTS public.cobranca_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  status_anterior text NULL,
  status_novo text NULL,
  payload jsonb NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_eventos_cobranca ON public.cobranca_eventos(cobranca_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cobranca_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NULL REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  acao text NOT NULL,
  detalhe text NULL,
  payload jsonb NULL,
  usuario_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_logs_cobranca ON public.cobranca_logs(cobranca_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cobranca_logs_acao ON public.cobranca_logs(acao);

CREATE TABLE IF NOT EXISTS public.cobranca_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'inter',
  event_id text NULL,
  cobranca_id uuid NULL REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  inter_cobranca_id text NULL,
  tipo text NULL,
  payload jsonb NOT NULL,
  headers jsonb NULL,
  processed_at timestamptz NULL,
  processing_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_webhook_events_inter_id
  ON public.cobranca_webhook_events(inter_cobranca_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobranca_webhook_events_event_id
  ON public.cobranca_webhook_events(provider, event_id)
  WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_cobrancas_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cobrancas_updated_at ON public.cobrancas;
CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.set_cobrancas_updated_at();

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobrancas_select_financeiro" ON public.cobrancas;
CREATE POLICY "cobrancas_select_financeiro"
  ON public.cobrancas FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobrancas_insert_financeiro" ON public.cobrancas;

DROP POLICY IF EXISTS "cobrancas_update_financeiro" ON public.cobrancas;
-- Escritas em cobrancas passam somente pelos Route Handlers server-side com service_role.
-- Usuarios autenticados podem consultar pela policy acima, mas nao inserir/alterar
-- diretamente via cliente Supabase exposto no navegador.

DROP POLICY IF EXISTS "cobranca_eventos_select_financeiro" ON public.cobranca_eventos;
CREATE POLICY "cobranca_eventos_select_financeiro"
  ON public.cobranca_eventos FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobranca_eventos_insert_financeiro" ON public.cobranca_eventos;
-- Eventos e logs sao trilha de auditoria: escrita somente pelo backend service_role.

DROP POLICY IF EXISTS "cobranca_logs_select_financeiro" ON public.cobranca_logs;
CREATE POLICY "cobranca_logs_select_financeiro"
  ON public.cobranca_logs FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobranca_logs_insert_financeiro" ON public.cobranca_logs;

-- Webhooks usam service_role no backend; usuarios autenticados nao acessam eventos crus.
DROP POLICY IF EXISTS "cobranca_webhook_events_select_socio" ON public.cobranca_webhook_events;
CREATE POLICY "cobranca_webhook_events_select_socio"
  ON public.cobranca_webhook_events FOR SELECT TO authenticated
  USING (current_user_role() = 'socio');
