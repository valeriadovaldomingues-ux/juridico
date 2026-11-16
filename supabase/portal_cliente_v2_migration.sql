-- ============================================================================
-- Portal do Cliente v2 (CPF/CNPJ + código de 6 dígitos) — migração ÚNICA e ADITIVA
-- ============================================================================
-- ⚠️  SÓ APLICAR COM AUTORIZAÇÃO EXPRESSA da sócia. Não foi aplicada em produção.
--
-- O que cria:
--   • 6 tabelas novas: portal_acessos, portal_codigos, portal_sessoes,
--     portal_pedidos_acesso, portal_tentativas, portal_acessos_log
--   • 1 coluna nova: processos.ocultar_portal boolean NOT NULL DEFAULT false
--
-- O que NÃO faz (de propósito):
--   • nenhum DROP, nenhuma mudança de policy/RLS/constraint existente;
--   • nenhuma role 'cliente' em profiles, nenhum usuário em auth.users;
--   • não reutiliza nada das migrações portal_*_migration.sql antigas (OBSOLETAS — ver supabase/README_PORTAL.md).
--
-- Segurança: o cliente NÃO tem sessão Supabase. O acesso a estas tabelas é feito só pelo servidor, com a
-- chave service_role. Por isso todas as tabelas têm RLS LIGADO e NENHUMA policy, e anon/authenticated não têm
-- nenhum privilégio. (Com a policy "Authenticated full access" das tabelas centrais, qualquer JWT authenticated
-- leria tudo; o portal evita isso não emitindo JWT nenhum.)
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. portal_acessos: quem pode entrar e com qual e-mail ────────────────────
-- Uma linha por cliente. email_acesso aprovado pelo escritório tem precedência sobre clientes.email.
-- ativo = false bloqueia o cliente mesmo que clientes.email exista (revogação).
CREATE TABLE IF NOT EXISTS public.portal_acessos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email_acesso   text,
  ativo          boolean     NOT NULL DEFAULT true,
  aprovado_por   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprovado_em    timestamptz NOT NULL DEFAULT now(),
  revogado_em    timestamptz,
  ultimo_acesso  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_acessos_email_se_ativo CHECK (ativo = false OR email_acesso IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_acessos_cliente_uniq ON public.portal_acessos (cliente_id);

-- ── 2. portal_codigos: códigos de 6 dígitos (só o hash HMAC; uso único; 5 tentativas) ──
CREATE TABLE IF NOT EXISTS public.portal_codigos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_hash    text        NOT NULL,
  expira_em      timestamptz NOT NULL,
  tentativas     integer     NOT NULL DEFAULT 0,
  usado_em       timestamptz,
  invalidado_em  timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_codigos_cliente_idx ON public.portal_codigos (cliente_id, criado_em DESC);

-- ── 3. portal_sessoes: sessão própria (cookie opaco; só o hash sha256 fica aqui) ──
CREATE TABLE IF NOT EXISTS public.portal_sessoes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     text        NOT NULL,
  cliente_id     uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL,
  revogada_em    timestamptz,
  ip_resumo      text,
  user_agent     text
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_sessoes_token_uniq ON public.portal_sessoes (token_hash);
CREATE INDEX IF NOT EXISTS portal_sessoes_cliente_idx ON public.portal_sessoes (cliente_id, criado_em DESC);

-- ── 4. portal_pedidos_acesso: fila de "primeiro acesso" para o escritório decidir ──
-- nascimento / nome_mae / nome_pai servem só de filtro para o revisor humano e são APAGADOS (NULL) ao aprovar
-- ou rejeitar o pedido (minimização LGPD).
CREATE TABLE IF NOT EXISTS public.portal_pedidos_acesso (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  documento      text        NOT NULL,
  email          text        NOT NULL,
  telefone       text,
  nascimento     date,
  nome_mae       text,
  nome_pai       text,
  status         text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  cliente_id     uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  decidido_por   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  decidido_em    timestamptz,
  ip_resumo      text,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_pedidos_status_idx ON public.portal_pedidos_acesso (status, criado_em DESC);
CREATE INDEX IF NOT EXISTS portal_pedidos_documento_idx ON public.portal_pedidos_acesso (documento);

-- ── 5. portal_tentativas: contador de janela deslizante do anti-abuso (rate limit no banco) ──
-- chave = HMAC do documento / IP / e-mail (nunca o valor em claro). Linhas com mais de 2 dias são apagadas
-- de forma oportunista pelo próprio código.
CREATE TABLE IF NOT EXISTS public.portal_tentativas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text        NOT NULL,
  chave          text        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_tentativas_chave_idx ON public.portal_tentativas (tipo, chave, criado_em DESC);
CREATE INDEX IF NOT EXISTS portal_tentativas_criado_idx ON public.portal_tentativas (criado_em);

-- ── 6. portal_acessos_log: trilha de auditoria (quem aprovou, rejeitou, revogou, ocultou; logins) ──
-- Sem dados pessoais em "detalhes" (nada de documento, e-mail ou código).
CREATE TABLE IF NOT EXISTS public.portal_acessos_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  acao           text        NOT NULL,
  cliente_id     uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id    uuid        REFERENCES public.processos(id) ON DELETE SET NULL,
  pedido_id      uuid,
  usuario_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  detalhes       jsonb,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_acessos_log_cliente_idx ON public.portal_acessos_log (cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS portal_acessos_log_criado_idx ON public.portal_acessos_log (criado_em DESC);

-- ── RLS ligado, SEM nenhuma policy, sem privilégio para anon/authenticated ───
-- (service_role ignora RLS; é o único caminho de acesso.)
ALTER TABLE public.portal_acessos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_codigos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_pedidos_acesso  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_tentativas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_acessos_log     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.portal_acessos         FROM anon, authenticated;
REVOKE ALL ON public.portal_codigos         FROM anon, authenticated;
REVOKE ALL ON public.portal_sessoes         FROM anon, authenticated;
REVOKE ALL ON public.portal_pedidos_acesso  FROM anon, authenticated;
REVOKE ALL ON public.portal_tentativas      FROM anon, authenticated;
REVOKE ALL ON public.portal_acessos_log     FROM anon, authenticated;

-- ── processos.ocultar_portal ─────────────────────────────────────────────────
-- Liberação padrão: todo processo do cliente aparece no portal, EXCETO segredo de justiça e os marcados aqui.
-- O interruptor "Ocultar do portal do cliente" fica na ficha do processo (por enquanto só o sócio: PORTAL_PAPEIS_GESTAO).
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS ocultar_portal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.processos.ocultar_portal IS
  'true = o processo NÃO aparece no Portal do Cliente (segredo de justiça nunca aparece, independentemente desta coluna).';
