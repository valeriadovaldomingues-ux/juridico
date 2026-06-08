CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.cliente_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cargo text,
  area_responsavel text,
  celular text,
  email text,
  observacoes text,
  contato_principal boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  recebe_juridico boolean NOT NULL DEFAULT false,
  recebe_financeiro boolean NOT NULL DEFAULT false,
  recebe_documentos boolean NOT NULL DEFAULT false,
  recebe_comunicados boolean NOT NULL DEFAULT false,
  criado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  atualizado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_contatos_cliente_id ON public.cliente_contatos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_contatos_ativo ON public.cliente_contatos(ativo);
CREATE INDEX IF NOT EXISTS idx_cliente_contatos_email ON public.cliente_contatos(email);
CREATE INDEX IF NOT EXISTS idx_cliente_contatos_celular ON public.cliente_contatos(celular);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_contatos_principal
  ON public.cliente_contatos(cliente_id)
  WHERE contato_principal;

DROP TRIGGER IF EXISTS trg_cliente_contatos_updated_at ON public.cliente_contatos;
CREATE TRIGGER trg_cliente_contatos_updated_at
  BEFORE UPDATE ON public.cliente_contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cliente_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cliente_contatos_select_staff ON public.cliente_contatos;
DROP POLICY IF EXISTS cliente_contatos_insert_editors ON public.cliente_contatos;
DROP POLICY IF EXISTS cliente_contatos_update_editors ON public.cliente_contatos;
DROP POLICY IF EXISTS cliente_contatos_delete_editors ON public.cliente_contatos;

CREATE POLICY cliente_contatos_select_staff
  ON public.cliente_contatos
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY cliente_contatos_insert_editors
  ON public.cliente_contatos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY cliente_contatos_update_editors
  ON public.cliente_contatos
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('comercial', 'administrativo', 'advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY cliente_contatos_delete_editors
  ON public.cliente_contatos
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('comercial', 'administrativo', 'advogado', 'gerente', 'socio'));
