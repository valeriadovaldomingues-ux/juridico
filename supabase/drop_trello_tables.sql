-- ============================================================================
-- drop_trello_tables.sql
-- ============================================================================
-- Remove a integração de API ao vivo do Trello (descontinuada).
--
-- ESCOPO: apenas as 4 tabelas da integração de API. NÃO toca no Kanban.
--   • PRESERVA a coluna public.kanban_tasks.trello_member_id (dados históricos)
--   • PRESERVA o valor 'trello' no CHECK de public.kanban_tasks.origem
--     (tarefas importadas via CSV continuam usando origem='trello')
--   • O importador de CSV do Trello (parseTrelloCsv / /api/kanban-tasks/import-csv)
--     permanece funcionando — não depende destas tabelas.
--
-- Idempotente. Revise antes de aplicar. NÃO aplicado automaticamente.
--
-- >>> ANTES DE APLICAR: rotacione o api_key/api_token do Trello, pois estiveram
-- >>> legíveis (RLS "allow all") enquanto a tabela existiu.
-- ============================================================================

BEGIN;

-- Ordem: mappings/logs primeiro (referenciam integration_id), depois integrations.
DROP TABLE IF EXISTS public.trello_sync_logs      CASCADE;
DROP TABLE IF EXISTS public.trello_member_mappings CASCADE;
DROP TABLE IF EXISTS public.trello_list_mappings  CASCADE;
DROP TABLE IF EXISTS public.trello_integrations   CASCADE;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (após aplicar):
--   As 4 tabelas não devem mais existir; kanban_tasks e sua coluna permanecem.
-- ============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'trello_%';   -- deve voltar 0 linhas
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='kanban_tasks'
--   AND column_name='trello_member_id';                            -- deve CONTINUAR existindo
-- ============================================================================
