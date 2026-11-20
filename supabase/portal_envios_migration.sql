-- ============================================================================
-- Portal do cliente — documentos que o CLIENTE envia ao escritório (caminho 2: direto para a equipe)
-- ============================================================================
-- O que faz:
--   • 1 tabela nova: portal_envios (um registro por arquivo enviado pelo cliente);
--   • 1 bucket privado novo no Storage: portal-envios (25 MB por arquivo, só tipos de documento/imagem).
-- O que NÃO faz: nenhum DROP, nenhuma mudança em tabela/policy existente; não mexe nos buckets atuais.
--
-- Segurança: igual às demais tabelas portal_*: RLS LIGADO, NENHUMA policy, sem privilégio para anon/authenticated.
-- Só o servidor (service_role) lê/grava, sempre depois de checar a sessão do cliente (ou o papel da equipe).
-- O bucket é privado: o cliente envia por URL assinada de uso único (gerada pelo servidor para UM caminho) e a equipe
-- baixa por URL assinada de 5 minutos. Ninguém lê o bucket diretamente.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portal_envios (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  processo_id    uuid        REFERENCES public.processos(id) ON DELETE SET NULL,
  nome_original  text        NOT NULL,
  storage_path   text        NOT NULL,
  tipo_mime      text,
  tamanho_bytes  bigint,
  descricao      text,
  -- 'pendente' = o servidor autorizou o envio mas o arquivo ainda não foi confirmado; só 'enviado' aparece para alguém.
  status         text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  enviado_em     timestamptz,
  visto_por      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  visto_em       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_envios_path_uniq ON public.portal_envios (storage_path);
CREATE INDEX IF NOT EXISTS portal_envios_cliente_idx ON public.portal_envios (cliente_id, enviado_em DESC);

ALTER TABLE public.portal_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portal_envios FROM anon, authenticated;

-- ── Bucket privado ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-envios',
  'portal-envios',
  false,
  26214400,   -- 25 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "portal_envios_storage_no_direct_read" ON storage.objects;
DROP POLICY IF EXISTS "portal_envios_storage_service_all" ON storage.objects;

CREATE POLICY "portal_envios_storage_no_direct_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'portal-envios' AND false);

CREATE POLICY "portal_envios_storage_service_all"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'portal-envios')
  WITH CHECK (bucket_id = 'portal-envios');
