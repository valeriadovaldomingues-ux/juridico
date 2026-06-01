-- ============================================================
-- Central de Arquivos da Aurora
-- Fase 1: pastas, documentos, vínculos e storage privado
-- ============================================================
--
-- Observação:
-- - esta migration assume a existência de public.profiles, public.clientes
--   e public.processos já presentes no schema do projeto;
-- - caso o caso jurídico ainda não exista como tabela própria, os campos
--   caso_id ficam preparados sem FK nesta fase.

-- ── Função auxiliar de role ─────────────────────────────────────────────────
-- Reaproveita a lógica do projeto para checar o papel do usuário atual.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── Trigger padrão de updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Tabela: central_arquivos_pastas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.central_arquivos_pastas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  descricao     text,
  cliente_id    uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id   uuid NULL REFERENCES public.processos(id) ON DELETE SET NULL,
  caso_id       uuid NULL,
  pasta_pai_id  uuid NULL REFERENCES public.central_arquivos_pastas(id) ON DELETE SET NULL,
  criado_por    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  visibilidade  text NOT NULL DEFAULT 'interna' CHECK (visibilidade IN ('interna', 'portal')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_pastas_cliente
  ON public.central_arquivos_pastas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_pastas_processo
  ON public.central_arquivos_pastas(processo_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_pastas_pai
  ON public.central_arquivos_pastas(pasta_pai_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_pastas_visibilidade
  ON public.central_arquivos_pastas(visibilidade);

DROP TRIGGER IF EXISTS trg_central_arquivos_pastas_updated_at
  ON public.central_arquivos_pastas;
CREATE TRIGGER trg_central_arquivos_pastas_updated_at
  BEFORE UPDATE ON public.central_arquivos_pastas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Tabela: central_arquivos_documentos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.central_arquivos_documentos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id              uuid NULL REFERENCES public.central_arquivos_pastas(id) ON DELETE SET NULL,
  nome_original         text NOT NULL,
  nome_armazenado        text NOT NULL,
  tipo_mime             text NOT NULL,
  extensao              text,
  tamanho_bytes         bigint,
  storage_bucket        text NOT NULL,
  storage_path          text NOT NULL,
  cliente_id            uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id           uuid NULL REFERENCES public.processos(id) ON DELETE SET NULL,
  caso_id               uuid NULL,
  categoria             text,
  descricao             text,
  enviado_por           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status_processamento  text NOT NULL DEFAULT 'pendente'
    CHECK (status_processamento IN ('pendente', 'processando', 'processado', 'erro')),
  status_transcricao     text NULL
    CHECK (status_transcricao IN ('pendente', 'processando', 'transcrito', 'erro')),
  visibilidade          text NOT NULL DEFAULT 'interna'
    CHECK (visibilidade IN ('interna', 'portal')),
  analise_aurora        jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_central_arquivos_documentos_storage_path
  ON public.central_arquivos_documentos(storage_path);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_pasta
  ON public.central_arquivos_documentos(pasta_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_cliente
  ON public.central_arquivos_documentos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_processo
  ON public.central_arquivos_documentos(processo_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_categoria
  ON public.central_arquivos_documentos(categoria);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_visibilidade
  ON public.central_arquivos_documentos(visibilidade);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_status_processamento
  ON public.central_arquivos_documentos(status_processamento);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_documentos_status_transcricao
  ON public.central_arquivos_documentos(status_transcricao);

DROP TRIGGER IF EXISTS trg_central_arquivos_documentos_updated_at
  ON public.central_arquivos_documentos;
CREATE TRIGGER trg_central_arquivos_documentos_updated_at
  BEFORE UPDATE ON public.central_arquivos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Tabela: central_arquivos_vinculos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.central_arquivos_vinculos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  uuid NOT NULL REFERENCES public.central_arquivos_documentos(id) ON DELETE CASCADE,
  cliente_id    uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id   uuid NULL REFERENCES public.processos(id) ON DELETE SET NULL,
  caso_id       uuid NULL,
  tipo_vinculo  text NOT NULL CHECK (tipo_vinculo IN ('cliente', 'processo', 'caso')),
  criado_por    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_vinculos_documento
  ON public.central_arquivos_vinculos(documento_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_vinculos_cliente
  ON public.central_arquivos_vinculos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_vinculos_processo
  ON public.central_arquivos_vinculos(processo_id);

CREATE INDEX IF NOT EXISTS idx_central_arquivos_vinculos_tipo
  ON public.central_arquivos_vinculos(tipo_vinculo);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.central_arquivos_pastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_arquivos_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_arquivos_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_arquivos_pastas_staff_select" ON public.central_arquivos_pastas;
DROP POLICY IF EXISTS "central_arquivos_pastas_staff_insert" ON public.central_arquivos_pastas;
DROP POLICY IF EXISTS "central_arquivos_pastas_staff_update" ON public.central_arquivos_pastas;
DROP POLICY IF EXISTS "central_arquivos_pastas_staff_delete" ON public.central_arquivos_pastas;

CREATE POLICY "central_arquivos_pastas_staff_select"
  ON public.central_arquivos_pastas
  FOR SELECT TO authenticated
  USING (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_pastas_staff_insert"
  ON public.central_arquivos_pastas
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_pastas_staff_update"
  ON public.central_arquivos_pastas
  FOR UPDATE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  )
  WITH CHECK (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_pastas_staff_delete"
  ON public.central_arquivos_pastas
  FOR DELETE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

DROP POLICY IF EXISTS "central_arquivos_documentos_staff_select" ON public.central_arquivos_documentos;
DROP POLICY IF EXISTS "central_arquivos_documentos_staff_insert" ON public.central_arquivos_documentos;
DROP POLICY IF EXISTS "central_arquivos_documentos_staff_update" ON public.central_arquivos_documentos;
DROP POLICY IF EXISTS "central_arquivos_documentos_staff_delete" ON public.central_arquivos_documentos;
CREATE POLICY "central_arquivos_documentos_staff_select"
  ON public.central_arquivos_documentos
  FOR SELECT TO authenticated
  USING (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_documentos_staff_insert"
  ON public.central_arquivos_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_documentos_staff_update"
  ON public.central_arquivos_documentos
  FOR UPDATE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  )
  WITH CHECK (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_documentos_staff_delete"
  ON public.central_arquivos_documentos
  FOR DELETE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

DROP POLICY IF EXISTS "central_arquivos_vinculos_staff_select" ON public.central_arquivos_vinculos;
DROP POLICY IF EXISTS "central_arquivos_vinculos_staff_insert" ON public.central_arquivos_vinculos;
DROP POLICY IF EXISTS "central_arquivos_vinculos_staff_update" ON public.central_arquivos_vinculos;
DROP POLICY IF EXISTS "central_arquivos_vinculos_staff_delete" ON public.central_arquivos_vinculos;

CREATE POLICY "central_arquivos_vinculos_staff_select"
  ON public.central_arquivos_vinculos
  FOR SELECT TO authenticated
  USING (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_vinculos_staff_insert"
  ON public.central_arquivos_vinculos
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_vinculos_staff_update"
  ON public.central_arquivos_vinculos
  FOR UPDATE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  )
  WITH CHECK (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE POLICY "central_arquivos_vinculos_staff_delete"
  ON public.central_arquivos_vinculos
  FOR DELETE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
  );

-- ── Storage ────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'central-arquivos',
  'central-arquivos',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/x-m4a',
    'audio/m4a',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "central_arquivos_storage_no_direct_read" ON storage.objects;
DROP POLICY IF EXISTS "central_arquivos_storage_service_insert" ON storage.objects;
DROP POLICY IF EXISTS "central_arquivos_storage_service_select" ON storage.objects;
DROP POLICY IF EXISTS "central_arquivos_storage_service_delete" ON storage.objects;

CREATE POLICY "central_arquivos_storage_no_direct_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'central-arquivos' AND false);

CREATE POLICY "central_arquivos_storage_service_insert"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'central-arquivos');

CREATE POLICY "central_arquivos_storage_service_select"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'central-arquivos');

CREATE POLICY "central_arquivos_storage_service_delete"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'central-arquivos');
