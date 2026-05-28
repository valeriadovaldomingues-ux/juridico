-- ============================================================
-- Integracoes Processuais
-- ============================================================
-- Configuracoes nao sensiveis e logs tecnicos.
--
-- Nao armazenar:
--   senha de tribunal, certificado digital, token MFA/TOTP, QR code,
--   cookie, sessao, token de tribunal/API ou qualquer segredo.
-- Segredos devem ficar somente em variaveis de ambiente server-side.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integracoes_processuais_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT false,
  nome_exibicao text NOT NULL,
  configuracoes_publicas jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integracoes_processuais_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  tipo_operacao text NOT NULL,
  status text NOT NULL CHECK (status IN ('sucesso', 'erro')),
  referencia text,
  mensagem text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.integracoes_processuais_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes_processuais_sync_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.integracoes_processuais_configuracoes TO authenticated;
GRANT SELECT, INSERT ON TABLE public.integracoes_processuais_sync_logs TO authenticated;

CREATE INDEX IF NOT EXISTS idx_integracoes_processuais_logs_provider
  ON public.integracoes_processuais_sync_logs(provider);

CREATE INDEX IF NOT EXISTS idx_integracoes_processuais_logs_criado
  ON public.integracoes_processuais_sync_logs(iniciado_em DESC);

CREATE INDEX IF NOT EXISTS idx_integracoes_processuais_logs_status
  ON public.integracoes_processuais_sync_logs(status);

CREATE OR REPLACE FUNCTION public.set_integracoes_processuais_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_integracoes_processuais_config_updated_at
  ON public.integracoes_processuais_configuracoes;

CREATE TRIGGER trg_integracoes_processuais_config_updated_at
  BEFORE UPDATE ON public.integracoes_processuais_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_integracoes_processuais_updated_at();

INSERT INTO public.integracoes_processuais_configuracoes (
  provider,
  ativo,
  nome_exibicao,
  configuracoes_publicas
)
VALUES
  (
    'mock',
    true,
    'Mock manual',
    '{"modo":"desenvolvimento","aceita_credenciais_no_sistema":false}'::jsonb
  ),
  (
    'jusbrasil',
    false,
    'Jusbrasil',
    '{"modo":"externo","aceita_credenciais_no_sistema":false,"requer_env":["JUSBRASIL_API_URL","JUSBRASIL_API_TOKEN"]}'::jsonb
  )
ON CONFLICT (provider) DO UPDATE
SET nome_exibicao = EXCLUDED.nome_exibicao,
    configuracoes_publicas = EXCLUDED.configuracoes_publicas;

-- Configuracoes: somente socio administra e visualiza.
DROP POLICY IF EXISTS "integracoes_processuais_config_socio_select" ON public.integracoes_processuais_configuracoes;
DROP POLICY IF EXISTS "integracoes_processuais_config_socio_insert" ON public.integracoes_processuais_configuracoes;
DROP POLICY IF EXISTS "integracoes_processuais_config_socio_update" ON public.integracoes_processuais_configuracoes;
DROP POLICY IF EXISTS "integracoes_processuais_config_socio_delete" ON public.integracoes_processuais_configuracoes;

CREATE POLICY "integracoes_processuais_config_socio_select"
  ON public.integracoes_processuais_configuracoes
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'socio');

CREATE POLICY "integracoes_processuais_config_socio_insert"
  ON public.integracoes_processuais_configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "integracoes_processuais_config_socio_update"
  ON public.integracoes_processuais_configuracoes
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "integracoes_processuais_config_socio_delete"
  ON public.integracoes_processuais_configuracoes
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'socio');

-- Logs: gerente e socio visualizam; apenas socio insere logs das operacoes sensiveis.
DROP POLICY IF EXISTS "integracoes_processuais_logs_select_management" ON public.integracoes_processuais_sync_logs;
DROP POLICY IF EXISTS "integracoes_processuais_logs_insert_socio" ON public.integracoes_processuais_sync_logs;

CREATE POLICY "integracoes_processuais_logs_select_management"
  ON public.integracoes_processuais_sync_logs
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('gerente', 'socio'));

CREATE POLICY "integracoes_processuais_logs_insert_socio"
  ON public.integracoes_processuais_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
