-- ============================================================
-- Conector MCP do PEDV: concessões do login OAuth (claude.ai, celular, tarefas na nuvem)
-- ============================================================
-- Uma linha por login autorizado ("Claude da Fulana no navegador"). Só guarda HASHES do código de autorização
-- e do token de renovação; nada em texto puro. Revogar = preencher revogado_em (vale na próxima chamada).
-- Acesso só pelo service role (RLS ligado, sem políticas).

CREATE TABLE IF NOT EXISTS public.mcp_oauth_concessoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id             text NOT NULL,
  client_nome           text,
  redirect_uri          text NOT NULL,
  code_challenge        text NOT NULL,
  code_hash             text UNIQUE,
  code_expira_em        timestamptz,
  refresh_hash          text UNIQUE,
  refresh_hash_anterior text,
  refresh_expira_em     timestamptz,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_em         timestamptz,
  revogado_em           timestamptz
);

CREATE INDEX IF NOT EXISTS mcp_oauth_concessoes_user_idx ON public.mcp_oauth_concessoes (user_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_concessoes_refresh_anterior_idx ON public.mcp_oauth_concessoes (refresh_hash_anterior);

ALTER TABLE public.mcp_oauth_concessoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_oauth_concessoes FROM anon, authenticated;
