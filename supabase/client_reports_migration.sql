CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  periodo_inicio date NULL,
  periodo_fim date NULL,
  resumo_executivo text NOT NULL DEFAULT '',
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  conteudo_texto text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovado', 'publicado', 'arquivado')),
  gerado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  aprovado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  publicado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz NULL,
  published_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_reports_cliente_id
  ON public.client_reports(cliente_id);

CREATE INDEX IF NOT EXISTS idx_client_reports_processo_id
  ON public.client_reports(processo_id);

CREATE INDEX IF NOT EXISTS idx_client_reports_status
  ON public.client_reports(status);

CREATE INDEX IF NOT EXISTS idx_client_reports_created_at
  ON public.client_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_reports_published_at
  ON public.client_reports(published_at DESC);

DROP TRIGGER IF EXISTS trg_client_reports_updated_at
  ON public.client_reports;

CREATE TRIGGER trg_client_reports_updated_at
  BEFORE UPDATE ON public.client_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.client_report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.client_reports(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('gerado', 'editado', 'aprovado', 'publicado', 'arquivado')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  executado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_report_logs_relatorio_id
  ON public.client_report_logs(relatorio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_report_logs_acao
  ON public.client_report_logs(acao);

ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_report_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_reports TO authenticated;
GRANT SELECT, INSERT ON TABLE public.client_report_logs TO authenticated;

DROP POLICY IF EXISTS client_reports_select_staff ON public.client_reports;
DROP POLICY IF EXISTS client_reports_insert_staff ON public.client_reports;
DROP POLICY IF EXISTS client_reports_update_staff ON public.client_reports;
DROP POLICY IF EXISTS client_reports_delete_socio ON public.client_reports;
DROP POLICY IF EXISTS client_reports_select_cliente ON public.client_reports;

CREATE POLICY client_reports_select_staff
  ON public.client_reports
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('estagiario', 'advogado', 'gerente', 'socio'));

CREATE POLICY client_reports_insert_staff
  ON public.client_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY client_reports_update_staff
  ON public.client_reports
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY client_reports_delete_socio
  ON public.client_reports
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');

CREATE POLICY client_reports_select_cliente
  ON public.client_reports
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'cliente'
    AND status = 'publicado'
    AND EXISTS (
      SELECT 1
      FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id = client_reports.cliente_id
        AND pc.ativo = true
    )
  );

DROP POLICY IF EXISTS client_report_logs_select_staff ON public.client_report_logs;
DROP POLICY IF EXISTS client_report_logs_insert_staff ON public.client_report_logs;

CREATE POLICY client_report_logs_select_staff
  ON public.client_report_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY client_report_logs_insert_staff
  ON public.client_report_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

notify pgrst, 'reload schema';
