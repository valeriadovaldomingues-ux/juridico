-- =============================================
-- Portal do Cliente — Storage Hardening
-- Fase 1 de Segurança
--
-- Cria o bucket privado docs-pedv para documentos do portal.
-- Execute no Supabase Dashboard → SQL Editor.
--
-- ANTES DE EXECUTAR:
--   Confirme que o bucket 'docs-pedv' ainda NÃO existe em
--   Storage → Buckets no Dashboard. Se já existir, ajuste
--   apenas as policies (a partir do passo 2).
--
-- Idempotente: INSERT ... ON CONFLICT DO NOTHING para o bucket.
-- =============================================

-- ── 1. Criar bucket privado ───────────────────────────────────────────────────

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'docs-pedv',
  'docs-pedv',
  false,           -- privado: sem acesso público direto
  52428800,        -- 50 MB por arquivo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Remover policies antigas (idempotente) ─────────────────────────────────

DROP POLICY IF EXISTS "docs_pedv_no_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "docs_pedv_staff_upload"     ON storage.objects;
DROP POLICY IF EXISTS "docs_pedv_staff_select"     ON storage.objects;
DROP POLICY IF EXISTS "docs_pedv_staff_delete"     ON storage.objects;
DROP POLICY IF EXISTS "docs_pedv_service_role_all" ON storage.objects;

-- ── 3. Policies de acesso ao bucket ──────────────────────────────────────────

-- Bloqueia qualquer leitura direta por usuários autenticados.
-- Downloads acontecem EXCLUSIVAMENTE via signed URLs geradas server-side.
CREATE POLICY "docs_pedv_no_direct_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'docs-pedv'
    AND false  -- nega TODA leitura direta; apenas signed URL funciona
  );

-- Uploads realizados apenas via service_role (backend/API route com service key).
-- Nenhum usuário autenticado (cliente ou staff) pode fazer upload diretamente.
-- O upload é feito por API routes que usam createServiceClient().
CREATE POLICY "docs_pedv_service_upload"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'docs-pedv');

-- Staff pode listar e visualizar objetos via service_role (para gestão interna).
CREATE POLICY "docs_pedv_service_select"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'docs-pedv');

-- Apenas service_role pode deletar (nunca o cliente).
CREATE POLICY "docs_pedv_service_delete"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'docs-pedv');

-- ── 4. Confirmação ────────────────────────────────────────────────────────────

SELECT
  id,
  name,
  public,
  file_size_limit,
  array_length(allowed_mime_types, 1) AS mime_types_count
FROM storage.buckets
WHERE id = 'docs-pedv';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE 'docs_pedv%'
ORDER BY cmd;
