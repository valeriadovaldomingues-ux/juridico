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

CREATE TABLE IF NOT EXISTS public.processo_andamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_andamento timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('peticao', 'decisao', 'despacho', 'audiencia', 'prazo', 'publicacao', 'juntada', 'contato_cliente', 'observacao', 'documento', 'outro')),
  titulo text NOT NULL,
  descricao text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'tribunal', 'publicacao', 'sistema', 'aurora')),
  responsavel_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_andamentos_processo_id ON public.processo_andamentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_andamentos_data_andamento ON public.processo_andamentos(data_andamento);
CREATE INDEX IF NOT EXISTS idx_processo_andamentos_tipo ON public.processo_andamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_processo_andamentos_origem ON public.processo_andamentos(origem);

DROP TRIGGER IF EXISTS trg_processo_andamentos_updated_at ON public.processo_andamentos;
CREATE TRIGGER trg_processo_andamentos_updated_at
BEFORE UPDATE ON public.processo_andamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.processo_andamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS processo_andamentos_select_staff ON public.processo_andamentos;
DROP POLICY IF EXISTS processo_andamentos_insert_staff ON public.processo_andamentos;
DROP POLICY IF EXISTS processo_andamentos_update_socio ON public.processo_andamentos;
DROP POLICY IF EXISTS processo_andamentos_delete_socio ON public.processo_andamentos;

CREATE POLICY processo_andamentos_select_staff
  ON public.processo_andamentos
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY processo_andamentos_insert_staff
  ON public.processo_andamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio')
    OR (
      public.current_user_role() = 'estagiario'
      AND tipo = 'observacao'
    )
  );

CREATE POLICY processo_andamentos_update_socio
  ON public.processo_andamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY processo_andamentos_delete_socio
  ON public.processo_andamentos
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');
