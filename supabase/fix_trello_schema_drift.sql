-- =============================================
-- Correção de drift — módulo Trello
-- =============================================
--
-- O banco de produção divergiu do que trello_integration_migration.sql
-- descreve (provavelmente uma versão anterior/manual da tabela foi criada
-- antes deste arquivo ser escrito, e os CREATE TABLE IF NOT EXISTS
-- seguintes nunca tiveram efeito). Erros reais causados por isso:
--
--   1. trello_integrations: faltava `created_by`; `escritorio_id`
--      (coluna de multi-tenancy nunca implementada) estava NOT NULL sem
--      nada no app populando — todo POST /api/trello/config falhava.
--   2. trello_list_mappings / trello_member_mappings: não tinham a
--      coluna `integration_id` (chave usada em toda consulta e no
--      upsert de mapeamentos); mesma `escritorio_id` NOT NULL órfã;
--      `trello_member_mappings.profile_id` estava NOT NULL, impedindo
--      salvar um membro do Trello ainda sem vínculo com usuário PEDV
--      (fluxo normal antes de mapear todo mundo).
--   3. trello_sync_logs: faltavam `triggered_by` e `erro_detalhes`;
--      `board_id` era NOT NULL sem o código preenchê-lo (já usa
--      integration_id); mesma `escritorio_id` NOT NULL órfã.
--
-- Todas as 4 tabelas estavam com 0 linhas no momento da correção —
-- ajuste feito sem risco de perda de dado ou necessidade de backfill.
-- Aplicado diretamente em produção; este arquivo é o registro do que
-- foi rodado (idempotente — seguro rodar de novo).

ALTER TABLE public.trello_integrations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.trello_integrations
  ALTER COLUMN escritorio_id DROP NOT NULL;

ALTER TABLE public.trello_list_mappings
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.trello_integrations(id) ON DELETE CASCADE;
ALTER TABLE public.trello_list_mappings
  ALTER COLUMN integration_id SET NOT NULL,
  ALTER COLUMN escritorio_id DROP NOT NULL;
ALTER TABLE public.trello_list_mappings
  DROP CONSTRAINT IF EXISTS trello_list_mappings_integration_list_uq;
ALTER TABLE public.trello_list_mappings
  ADD CONSTRAINT trello_list_mappings_integration_list_uq UNIQUE (integration_id, trello_list_id);

ALTER TABLE public.trello_member_mappings
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.trello_integrations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS trello_username text,
  ADD COLUMN IF NOT EXISTS trello_full_name text;
ALTER TABLE public.trello_member_mappings
  ALTER COLUMN integration_id SET NOT NULL,
  ALTER COLUMN profile_id DROP NOT NULL,
  ALTER COLUMN trello_member_name DROP NOT NULL,
  ALTER COLUMN escritorio_id DROP NOT NULL;
ALTER TABLE public.trello_member_mappings
  DROP CONSTRAINT IF EXISTS trello_member_mappings_integration_member_uq;
ALTER TABLE public.trello_member_mappings
  ADD CONSTRAINT trello_member_mappings_integration_member_uq UNIQUE (integration_id, trello_member_id);

ALTER TABLE public.trello_sync_logs
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS erro_detalhes text;
ALTER TABLE public.trello_sync_logs
  ALTER COLUMN escritorio_id DROP NOT NULL,
  ALTER COLUMN board_id DROP NOT NULL;
