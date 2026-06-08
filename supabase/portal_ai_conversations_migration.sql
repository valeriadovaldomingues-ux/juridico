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

CREATE TABLE IF NOT EXISTS public.portal_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  resposta text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'precisa_revisao'
    CHECK (status IN ('respondida', 'precisa_revisao', 'encaminhada_equipe')),
  precisa_retorno_humano boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_portal_ai_conversations_cliente_created
  ON public.portal_ai_conversations(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_ai_conversations_processo_created
  ON public.portal_ai_conversations(processo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_ai_conversations_status
  ON public.portal_ai_conversations(status);

ALTER TABLE public.portal_ai_conversations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.portal_ai_conversations TO authenticated;

DROP POLICY IF EXISTS portal_ai_conversations_select_staff ON public.portal_ai_conversations;
CREATE POLICY portal_ai_conversations_select_staff
  ON public.portal_ai_conversations
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

DROP POLICY IF EXISTS portal_ai_conversations_select_cliente ON public.portal_ai_conversations;
CREATE POLICY portal_ai_conversations_select_cliente
  ON public.portal_ai_conversations
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id = portal_ai_conversations.cliente_id
        AND pc.ativo = true
    )
  );

DROP POLICY IF EXISTS portal_ai_conversations_insert_cliente ON public.portal_ai_conversations;
CREATE POLICY portal_ai_conversations_insert_cliente
  ON public.portal_ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'cliente'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id = portal_ai_conversations.cliente_id
        AND pc.ativo = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.processos p
      WHERE p.id = portal_ai_conversations.processo_id
        AND p.cliente_id = portal_ai_conversations.cliente_id
        AND p.visivel_cliente = true
    )
  );

DROP POLICY IF EXISTS portal_ai_conversations_update_staff ON public.portal_ai_conversations;
CREATE POLICY portal_ai_conversations_update_staff
  ON public.portal_ai_conversations
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  )
  WITH CHECK (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
  );

CREATE OR REPLACE FUNCTION public.get_portal_aurora_cliente_contexto(p_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_processo record;
  v_andamentos jsonb := '[]'::jsonb;
  v_relatorios jsonb := '[]'::jsonb;
  v_comunicacoes jsonb := '[]'::jsonb;
  v_documentos jsonb := '[]'::jsonb;
  v_timeline jsonb := '[]'::jsonb;
BEGIN
  SELECT pc.cliente_id
    INTO v_cliente_id
  FROM public.portal_clientes pc
  WHERE pc.auth_user_id = auth.uid()
    AND pc.ativo = true
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('error', 'nao_autorizado');
  END IF;

  SELECT
    p.id,
    p.numero_processo,
    p.titulo,
    p.area_direito,
    p.status,
    p.fase,
    p.tribunal,
    p.comarca,
    p.vara,
    p.classe_processual,
    p.assunto,
    p.data_distribuicao
  INTO v_processo
  FROM public.processos p
  WHERE p.id = p_processo_id
    AND p.cliente_id = v_cliente_id
    AND p.visivel_cliente = true
  LIMIT 1;

  IF v_processo.id IS NULL THEN
    RETURN jsonb_build_object('error', 'processo_nao_encontrado');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'data_andamento', a.data_andamento,
        'tipo', a.tipo,
        'titulo', a.titulo,
        'origem', a.origem,
        'responsavel', a.responsavel,
        'criado_por_profile', a.criado_por_profile
      ) ORDER BY a.data_andamento DESC
    ),
    '[]'::jsonb
  )
  INTO v_andamentos
  FROM (
    SELECT
      pa.id,
      pa.data_andamento,
      pa.tipo,
      pa.titulo,
      pa.origem,
      NULL::jsonb AS responsavel,
      NULL::jsonb AS criado_por_profile
    FROM public.processo_andamentos pa
    WHERE pa.processo_id = p_processo_id
      AND pa.tipo <> 'observacao'
    ORDER BY pa.data_andamento DESC
    LIMIT 20
  ) a;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'titulo', r.titulo,
        'resumo_executivo', r.resumo_executivo,
        'periodo_inicio', r.periodo_inicio,
        'periodo_fim', r.periodo_fim,
        'published_at', r.published_at
      ) ORDER BY r.published_at DESC NULLS LAST, r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_relatorios
  FROM public.client_reports r
  WHERE r.processo_id = p_processo_id
    AND r.cliente_id = v_cliente_id
    AND r.status = 'publicado'
  LIMIT 20;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'autor_tipo', m.autor_tipo,
        'conteudo', m.conteudo,
        'tipo', m.tipo,
        'created_at', m.created_at
      ) ORDER BY m.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_comunicacoes
  FROM public.portal_mensagens m
  WHERE m.processo_id = p_processo_id
    AND m.cliente_id = v_cliente_id
    AND m.autor_tipo = 'escritorio'
  LIMIT 20;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'nome_arquivo', d.nome_arquivo,
        'tipo_documento', d.tipo_documento,
        'created_at', d.created_at
      ) ORDER BY d.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_documentos
  FROM public.documentos d
  WHERE d.processo_id = p_processo_id
    AND d.cliente_id = v_cliente_id
    AND d.liberado_cliente = true
  LIMIT 20;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY item->>'data' DESC),
    '[]'::jsonb
  )
  INTO v_timeline
  FROM (
    SELECT jsonb_build_object(
      'id', pa.id,
      'data', pa.data_andamento,
      'tipo', 'andamento',
      'texto', pa.titulo,
      'sub', pa.origem
    ) AS item
    FROM public.processo_andamentos pa
    WHERE pa.processo_id = p_processo_id
      AND pa.tipo <> 'observacao'
    UNION ALL
    SELECT jsonb_build_object(
      'id', r.id,
      'data', r.published_at,
      'tipo', 'relatorio',
      'texto', r.titulo,
      'sub', 'Relatório publicado'
    )
    FROM public.client_reports r
    WHERE r.processo_id = p_processo_id
      AND r.cliente_id = v_cliente_id
      AND r.status = 'publicado'
    UNION ALL
    SELECT jsonb_build_object(
      'id', m.id,
      'data', m.created_at,
      'tipo', 'mensagem',
      'texto', left(m.conteudo, 160),
      'sub', 'Comunicação do escritório'
    )
    FROM public.portal_mensagens m
    WHERE m.processo_id = p_processo_id
      AND m.cliente_id = v_cliente_id
      AND m.autor_tipo = 'escritorio'
    UNION ALL
    SELECT jsonb_build_object(
      'id', d.id,
      'data', d.created_at,
      'tipo', 'documento',
      'texto', d.nome_arquivo,
      'sub', d.tipo_documento
    )
    FROM public.documentos d
    WHERE d.processo_id = p_processo_id
      AND d.cliente_id = v_cliente_id
      AND d.liberado_cliente = true
  ) itens(item);

  RETURN jsonb_build_object(
    'cliente_id', v_cliente_id,
    'processo', to_jsonb(v_processo),
    'andamentos', v_andamentos,
    'relatorios', v_relatorios,
    'comunicacoes', v_comunicacoes,
    'documentos', v_documentos,
    'timeline', v_timeline,
    'resumo', jsonb_build_object(
      'andamentos', COALESCE(jsonb_array_length(v_andamentos), 0),
      'relatorios', COALESCE(jsonb_array_length(v_relatorios), 0),
      'comunicacoes', COALESCE(jsonb_array_length(v_comunicacoes), 0),
      'documentos', COALESCE(jsonb_array_length(v_documentos), 0),
      'timeline', COALESCE(jsonb_array_length(v_timeline), 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_aurora_cliente_contexto(uuid) TO authenticated;

notify pgrst, 'reload schema';
