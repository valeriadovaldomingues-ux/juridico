-- ============================================================================
-- drop_aurora_cliente.sql
-- ============================================================================
-- Remove os objetos de banco do "Aurora Cliente" (assistente de IA do portal),
-- descontinuado junto com Olavo Drive + Aurora.
--
-- ⚠️ A tabela portal_ai_conversations guarda o HISTÓRICO DE CONVERSAS dos
--    clientes com a Aurora. Dropar APAGA esse dado permanentemente.
--    Se quiser arquivar antes: faça dump/export da tabela.
--
-- Idempotente. Revise antes de aplicar. NÃO aplicado automaticamente.
-- ============================================================================

BEGIN;

-- RPC SECURITY DEFINER usada só pelo Aurora Cliente (derivava contexto do processo).
DROP FUNCTION IF EXISTS public.get_portal_aurora_cliente_contexto(uuid);

-- Tabela de conversas do portal (CASCADE remove policies/índices/constraints).
DROP TABLE IF EXISTS public.portal_ai_conversations CASCADE;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (após aplicar — ambas devem voltar 0 linhas):
-- ============================================================================
-- SELECT 1 FROM information_schema.tables
-- WHERE table_schema='public' AND table_name='portal_ai_conversations';
--
-- SELECT 1 FROM information_schema.routines
-- WHERE routine_schema='public' AND routine_name='get_portal_aurora_cliente_contexto';
-- ============================================================================
