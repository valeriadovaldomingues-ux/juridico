-- Complementar ao modulo de cobrancas Inter.
-- Nao altera dados existentes. Apenas remove policies antigas de escrita direta
-- e reafirma policies de leitura restritivas.

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobrancas_insert_financeiro" ON public.cobrancas;
DROP POLICY IF EXISTS "cobrancas_update_financeiro" ON public.cobrancas;
DROP POLICY IF EXISTS "cobranca_eventos_insert_financeiro" ON public.cobranca_eventos;
DROP POLICY IF EXISTS "cobranca_logs_insert_financeiro" ON public.cobranca_logs;

DROP POLICY IF EXISTS "cobrancas_select_financeiro" ON public.cobrancas;
CREATE POLICY "cobrancas_select_financeiro"
  ON public.cobrancas FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobranca_eventos_select_financeiro" ON public.cobranca_eventos;
CREATE POLICY "cobranca_eventos_select_financeiro"
  ON public.cobranca_eventos FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobranca_logs_select_financeiro" ON public.cobranca_logs;
CREATE POLICY "cobranca_logs_select_financeiro"
  ON public.cobranca_logs FOR SELECT TO authenticated
  USING (current_user_role() IN ('administrativo', 'gerente', 'socio'));

DROP POLICY IF EXISTS "cobranca_webhook_events_select_socio" ON public.cobranca_webhook_events;
CREATE POLICY "cobranca_webhook_events_select_socio"
  ON public.cobranca_webhook_events FOR SELECT TO authenticated
  USING (current_user_role() = 'socio');
