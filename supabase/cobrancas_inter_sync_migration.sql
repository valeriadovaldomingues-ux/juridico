-- Complementar ao modulo de cobrancas Inter.
-- Nao remove dados existentes.
-- Atualiza o check de status para incluir "processando" e cria a trava do lote
-- usada pelo endpoint interno protegido por CRON_SECRET.

ALTER TABLE public.cobrancas
  DROP CONSTRAINT IF EXISTS cobrancas_status_check;

ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_status_check CHECK (
    status IN ('rascunho', 'pendente', 'processando', 'emitida', 'erro_emissao', 'vencida', 'paga', 'cancelada')
  );

CREATE TABLE IF NOT EXISTS public.cobranca_sync_locks (
  lock_name text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NOT NULL DEFAULT now(),
  locked_by text NULL,
  last_started_at timestamptz NULL,
  last_finished_at timestamptz NULL,
  last_error text NULL,
  last_summary jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_sync_locks ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cobranca_sync_locks (lock_name)
VALUES ('inter_cobrancas_batch')
ON CONFLICT (lock_name) DO NOTHING;
