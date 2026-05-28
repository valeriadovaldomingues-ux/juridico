-- ============================================================
-- RLS hardening - tabelas sensiveis de prioridade alta
-- ============================================================
-- Objetivo:
--   1. remover policies amplas USING (true) / WITH CHECK (true)
--   2. recriar policies por operacao usando roles reais do sistema
--   3. manter o acesso do portal apenas a documentos liberados
--
-- Roles reais:
--   estagiario, comercial, administrativo, advogado, gerente, socio, cliente
-- ============================================================

-- Garante RLS ativo nas tabelas desta rodada.
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_gerados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_analises_publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- financeiro_lancamentos
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_select_role" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_insert_socio" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_update_socio" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_delete_socio" ON public.financeiro_lancamentos;

CREATE POLICY "financeiro_lancamentos_select_role"
  ON public.financeiro_lancamentos
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('gerente', 'socio'));

CREATE POLICY "financeiro_lancamentos_insert_socio"
  ON public.financeiro_lancamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "financeiro_lancamentos_update_socio"
  ON public.financeiro_lancamentos
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "financeiro_lancamentos_delete_socio"
  ON public.financeiro_lancamentos
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'socio');

-- ============================================================
-- profiles
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_management" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_socio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_socio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_socio" ON public.profiles;

CREATE POLICY "profiles_select_own_or_management"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() IN ('gerente', 'socio')
  );

CREATE POLICY "profiles_insert_socio"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "profiles_update_socio"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');

CREATE POLICY "profiles_delete_socio"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'socio');

-- ============================================================
-- documentos
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.documentos;
DROP POLICY IF EXISTS "staff_full_access_documentos" ON public.documentos;
DROP POLICY IF EXISTS "portal_cliente_documentos" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_staff" ON public.documentos;
DROP POLICY IF EXISTS "documentos_insert_staff" ON public.documentos;
DROP POLICY IF EXISTS "documentos_update_staff" ON public.documentos;
DROP POLICY IF EXISTS "documentos_delete_staff" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_cliente_liberado" ON public.documentos;

CREATE POLICY "documentos_select_staff"
  ON public.documentos
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "documentos_insert_staff"
  ON public.documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "documentos_update_staff"
  ON public.documentos
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "documentos_delete_staff"
  ON public.documentos
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "documentos_select_cliente_liberado"
  ON public.documentos
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'cliente'
    AND liberado_cliente = true
    AND EXISTS (
      SELECT 1
      FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id = documentos.cliente_id
        AND pc.ativo = true
    )
  );

-- ============================================================
-- doc_gerados
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.doc_gerados;
DROP POLICY IF EXISTS "staff_full_access_doc_gerados" ON public.doc_gerados;
DROP POLICY IF EXISTS "portal_cliente_doc_gerados" ON public.doc_gerados;
DROP POLICY IF EXISTS "doc_gerados_select_staff" ON public.doc_gerados;
DROP POLICY IF EXISTS "doc_gerados_insert_staff" ON public.doc_gerados;
DROP POLICY IF EXISTS "doc_gerados_update_staff" ON public.doc_gerados;
DROP POLICY IF EXISTS "doc_gerados_delete_staff" ON public.doc_gerados;
DROP POLICY IF EXISTS "doc_gerados_select_cliente_liberado" ON public.doc_gerados;

CREATE POLICY "doc_gerados_select_staff"
  ON public.doc_gerados
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "doc_gerados_insert_staff"
  ON public.doc_gerados
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "doc_gerados_update_staff"
  ON public.doc_gerados
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "doc_gerados_delete_staff"
  ON public.doc_gerados
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "doc_gerados_select_cliente_liberado"
  ON public.doc_gerados
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'cliente'
    AND liberado_cliente = true
    AND EXISTS (
      SELECT 1
      FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id = doc_gerados.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id = auth.uid()
        AND pc.ativo = true
    )
  );

-- ============================================================
-- ia_analises_publicacoes
-- ============================================================

DROP POLICY IF EXISTS "ia_analises_all_authenticated" ON public.ia_analises_publicacoes;
DROP POLICY IF EXISTS "ia_analises_publicacoes_select_role" ON public.ia_analises_publicacoes;
DROP POLICY IF EXISTS "ia_analises_publicacoes_insert_role" ON public.ia_analises_publicacoes;
DROP POLICY IF EXISTS "ia_analises_publicacoes_update_role" ON public.ia_analises_publicacoes;
DROP POLICY IF EXISTS "ia_analises_publicacoes_delete_role" ON public.ia_analises_publicacoes;

CREATE POLICY "ia_analises_publicacoes_select_role"
  ON public.ia_analises_publicacoes
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY "ia_analises_publicacoes_insert_role"
  ON public.ia_analises_publicacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY "ia_analises_publicacoes_update_role"
  ON public.ia_analises_publicacoes
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('advogado', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

CREATE POLICY "ia_analises_publicacoes_delete_role"
  ON public.ia_analises_publicacoes
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('advogado', 'gerente', 'socio'));

-- ============================================================
-- agenda_import_jobs
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access on import jobs" ON public.agenda_import_jobs;
DROP POLICY IF EXISTS "agenda_import_jobs_select_staff" ON public.agenda_import_jobs;
DROP POLICY IF EXISTS "agenda_import_jobs_insert_maintainers" ON public.agenda_import_jobs;
DROP POLICY IF EXISTS "agenda_import_jobs_update_maintainers" ON public.agenda_import_jobs;
DROP POLICY IF EXISTS "agenda_import_jobs_delete_maintainers" ON public.agenda_import_jobs;

CREATE POLICY "agenda_import_jobs_select_staff"
  ON public.agenda_import_jobs
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "agenda_import_jobs_insert_maintainers"
  ON public.agenda_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "agenda_import_jobs_update_maintainers"
  ON public.agenda_import_jobs
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "agenda_import_jobs_delete_maintainers"
  ON public.agenda_import_jobs
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

-- ============================================================
-- agenda_import_rows
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access on import rows" ON public.agenda_import_rows;
DROP POLICY IF EXISTS "agenda_import_rows_select_staff" ON public.agenda_import_rows;
DROP POLICY IF EXISTS "agenda_import_rows_insert_maintainers" ON public.agenda_import_rows;
DROP POLICY IF EXISTS "agenda_import_rows_update_maintainers" ON public.agenda_import_rows;
DROP POLICY IF EXISTS "agenda_import_rows_delete_maintainers" ON public.agenda_import_rows;

CREATE POLICY "agenda_import_rows_select_staff"
  ON public.agenda_import_rows
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "agenda_import_rows_insert_maintainers"
  ON public.agenda_import_rows
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "agenda_import_rows_update_maintainers"
  ON public.agenda_import_rows
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "agenda_import_rows_delete_maintainers"
  ON public.agenda_import_rows
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

-- ============================================================
-- calendar_events
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access on calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_select_staff" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert_maintainers" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_update_maintainers" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete_maintainers" ON public.calendar_events;

CREATE POLICY "calendar_events_select_staff"
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "calendar_events_insert_maintainers"
  ON public.calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "calendar_events_update_maintainers"
  ON public.calendar_events
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'))
  WITH CHECK (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

CREATE POLICY "calendar_events_delete_maintainers"
  ON public.calendar_events
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('administrativo', 'gerente', 'socio'));

-- ============================================================
-- contact_interactions
-- ============================================================

DROP POLICY IF EXISTS "Authenticated full access on contact_interactions" ON public.contact_interactions;
DROP POLICY IF EXISTS "staff_full_access_interactions" ON public.contact_interactions;
DROP POLICY IF EXISTS "contact_interactions_select_staff" ON public.contact_interactions;
DROP POLICY IF EXISTS "contact_interactions_insert_staff" ON public.contact_interactions;
DROP POLICY IF EXISTS "contact_interactions_update_owner_or_management" ON public.contact_interactions;
DROP POLICY IF EXISTS "contact_interactions_delete_owner_or_management" ON public.contact_interactions;

CREATE POLICY "contact_interactions_select_staff"
  ON public.contact_interactions
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio'));

CREATE POLICY "contact_interactions_insert_staff"
  ON public.contact_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
    AND usuario_id = auth.uid()
  );

CREATE POLICY "contact_interactions_update_owner_or_management"
  ON public.contact_interactions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
    AND (usuario_id = auth.uid() OR public.current_user_role() IN ('gerente', 'socio'))
  )
  WITH CHECK (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
    AND (usuario_id = auth.uid() OR public.current_user_role() IN ('gerente', 'socio'))
  );

CREATE POLICY "contact_interactions_delete_owner_or_management"
  ON public.contact_interactions
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() IN ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
    AND (usuario_id = auth.uid() OR public.current_user_role() IN ('gerente', 'socio'))
  );
