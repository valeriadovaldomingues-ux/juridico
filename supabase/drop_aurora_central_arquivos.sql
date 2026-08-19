-- =============================================
-- Remoção do Aurora e da Central de Arquivos — PEDV
-- =============================================
--
-- Não há nada a dropar para "Aurora Cliente" (a tabela
-- portal_ai_conversations nunca chegou a ser aplicada neste banco) nem
-- para funções (nenhuma function com "aurora" no nome existe no banco).

DROP TABLE IF EXISTS public.central_arquivos_vinculos CASCADE;
DROP TABLE IF EXISTS public.central_arquivos_documentos CASCADE;
DROP TABLE IF EXISTS public.central_arquivos_pastas CASCADE;

-- ─── Bucket de storage — requer a Storage API, não SQL direto ────────────────
-- O Supabase bloqueia DELETE bruto em storage.objects/storage.buckets
-- (trigger storage.protect_delete, evita perda acidental de arquivos órfãos).
-- Existiam 3 arquivos no bucket "central-arquivos" no momento da remoção
-- (baixo risco — nenhuma funcionalidade do app referencia mais este bucket).
-- Para removê-lo por completo, use uma das opções abaixo:
--
--   1. Supabase Dashboard → Storage → bucket "central-arquivos" → excluir
--      todos os arquivos, depois excluir o bucket.
--   2. Supabase CLI: supabase storage rm --recursive supabase://central-arquivos
--   3. Storage API (com a service_role key, nunca no client):
--        DELETE https://<project>.supabase.co/storage/v1/bucket/central-arquivos/empty
--        DELETE https://<project>.supabase.co/storage/v1/bucket/central-arquivos
