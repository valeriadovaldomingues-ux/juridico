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

CREATE TABLE IF NOT EXISTS public.comunicacoes_inteligentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  andamento_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  tipo text NOT NULL DEFAULT 'relatorio'
    CHECK (tipo IN ('relatorio', 'mensagem', 'atualizacao')),
  canal_destino text NOT NULL DEFAULT 'portal'
    CHECK (canal_destino IN ('portal', 'email', 'whatsapp')),
  status text NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao', 'em_edicao', 'aprovada', 'enviada', 'descartada')),
  titulo text NOT NULL,
  resumo_executivo text NOT NULL DEFAULT '',
  o_que_aconteceu text NOT NULL DEFAULT '',
  o_que_isso_significa text NOT NULL DEFAULT '',
  proximos_passos jsonb NOT NULL DEFAULT '[]'::jsonb,
  acao_necessaria_cliente text NOT NULL DEFAULT '',
  mensagem_cliente text NOT NULL DEFAULT '',
  observacoes_internas text NOT NULL DEFAULT '',
  campos_nao_encontrados jsonb NOT NULL DEFAULT '[]'::jsonb,
  inconsistencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  conteudo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  conteudo_texto text NOT NULL DEFAULT '',
  visivel_portal boolean NOT NULL DEFAULT false,
  aprovado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprovado_em timestamptz NULL,
  enviado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  enviado_em timestamptz NULL,
  portal_mensagem_id uuid NULL REFERENCES public.portal_mensagens(id) ON DELETE SET NULL,
  criado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  atualizado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_processo_id
  ON public.comunicacoes_inteligentes(processo_id);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_cliente_id
  ON public.comunicacoes_inteligentes(cliente_id);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_status
  ON public.comunicacoes_inteligentes(status);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_tipo
  ON public.comunicacoes_inteligentes(tipo);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_canal_destino
  ON public.comunicacoes_inteligentes(canal_destino);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_created_at
  ON public.comunicacoes_inteligentes(created_at DESC);

DROP TRIGGER IF EXISTS trg_comunicacoes_inteligentes_updated_at
  ON public.comunicacoes_inteligentes;

CREATE TRIGGER trg_comunicacoes_inteligentes_updated_at
  BEFORE UPDATE ON public.comunicacoes_inteligentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.comunicacoes_inteligentes_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicacao_id uuid NOT NULL REFERENCES public.comunicacoes_inteligentes(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('gerada', 'editada', 'aprovada', 'enviada', 'descartada')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  realizado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_logs_comunicacao_id
  ON public.comunicacoes_inteligentes_logs(comunicacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_inteligentes_logs_acao
  ON public.comunicacoes_inteligentes_logs(acao);

ALTER TABLE public.comunicacoes_inteligentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicacoes_inteligentes_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comunicacoes_inteligentes TO authenticated;
GRANT SELECT, INSERT ON TABLE public.comunicacoes_inteligentes_logs TO authenticated;

DROP POLICY IF EXISTS comunicacoes_inteligentes_select_staff ON public.comunicacoes_inteligentes;
DROP POLICY IF EXISTS comunicacoes_inteligentes_insert_staff ON public.comunicacoes_inteligentes;
DROP POLICY IF EXISTS comunicacoes_inteligentes_update_staff ON public.comunicacoes_inteligentes;
DROP POLICY IF EXISTS comunicacoes_inteligentes_delete_staff ON public.comunicacoes_inteligentes;

CREATE POLICY comunicacoes_inteligentes_select_staff
  ON public.comunicacoes_inteligentes
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY comunicacoes_inteligentes_insert_staff
  ON public.comunicacoes_inteligentes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY comunicacoes_inteligentes_update_staff
  ON public.comunicacoes_inteligentes
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY comunicacoes_inteligentes_delete_staff
  ON public.comunicacoes_inteligentes
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

DROP POLICY IF EXISTS comunicacoes_inteligentes_logs_select_staff ON public.comunicacoes_inteligentes_logs;
DROP POLICY IF EXISTS comunicacoes_inteligentes_logs_insert_staff ON public.comunicacoes_inteligentes_logs;

CREATE POLICY comunicacoes_inteligentes_logs_select_staff
  ON public.comunicacoes_inteligentes_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY comunicacoes_inteligentes_logs_insert_staff
  ON public.comunicacoes_inteligentes_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));
