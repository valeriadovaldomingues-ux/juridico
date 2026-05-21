-- ============================================================
-- Google Gmail OAuth — Fase 1A
-- Escopo: conexao OAuth para socios + pre-analise somente leitura
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider                text NOT NULL DEFAULT 'google',
  google_email            text NOT NULL,
  scopes                  text[] NOT NULL DEFAULT ARRAY[]::text[],
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'revoked', 'error')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  revoked_at              timestamptz,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_google_connections_user_provider_status
  ON public.google_connections(user_id, provider, status);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_connections_select_own_socio" ON public.google_connections;
DROP POLICY IF EXISTS "google_connections_insert_own_socio" ON public.google_connections;
DROP POLICY IF EXISTS "google_connections_update_own_socio" ON public.google_connections;

CREATE POLICY "google_connections_select_own_socio"
  ON public.google_connections
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  );

CREATE POLICY "google_connections_insert_own_socio"
  ON public.google_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  );

CREATE POLICY "google_connections_update_own_socio"
  ON public.google_connections
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  );

CREATE TABLE IF NOT EXISTS public.google_gmail_query_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id   uuid REFERENCES public.google_connections(id) ON DELETE SET NULL,
  query_type      text NOT NULL,
  query_redacted  text,
  result_count    integer NOT NULL DEFAULT 0,
  selected_count  integer NOT NULL DEFAULT 0,
  imported_count  integer NOT NULL DEFAULT 0,
  has_attachments boolean NOT NULL DEFAULT false,
  status          text NOT NULL CHECK (status IN ('sucesso', 'erro')),
  error_code      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_gmail_query_logs_user_created
  ON public.google_gmail_query_logs(user_id, created_at DESC);

ALTER TABLE public.google_gmail_query_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_gmail_query_logs_select_own_socio" ON public.google_gmail_query_logs;
DROP POLICY IF EXISTS "google_gmail_query_logs_insert_own_socio" ON public.google_gmail_query_logs;

CREATE POLICY "google_gmail_query_logs_select_own_socio"
  ON public.google_gmail_query_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  );

CREATE POLICY "google_gmail_query_logs_insert_own_socio"
  ON public.google_gmail_query_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND current_user_role() = 'socio'
  );
