-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 6: evolução das RLS policies
--
-- Estratégia de segurança:
--   • Tabelas internas: substituir "Authenticated full access" por policy
--     que lista explicitamente os roles internos — exclui 'cliente'
--   • Tabelas do portal: adicionar policy de escopo para role 'cliente'
--   • contact_interactions: bloquear completamente para 'cliente' (CRM interno)
--
-- Usa current_user_role() definida em auth_setup.sql (SECURITY DEFINER).
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
-- =============================================

-- ─── MACRO auxiliar de roles internos ────────────────────────────────────────
-- Todos os policies de staff usam esta lista explícita.
-- 'cliente' está AUSENTE intencionalmente.

-- ─── 1. processos ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.processos;
DROP POLICY IF EXISTS "staff_full_access_processos"  ON public.processos;
DROP POLICY IF EXISTS "portal_cliente_processos"     ON public.processos;

CREATE POLICY "staff_full_access_processos"
  ON public.processos FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_processos"
  ON public.processos FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND visivel_cliente  = true
    AND EXISTS (
      SELECT 1 FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id   = processos.cliente_id
        AND pc.ativo        = true
    )
  );

-- ─── 2. partes_processo ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.partes_processo;
DROP POLICY IF EXISTS "staff_full_access_partes"     ON public.partes_processo;
DROP POLICY IF EXISTS "portal_cliente_partes"        ON public.partes_processo;

CREATE POLICY "staff_full_access_partes"
  ON public.partes_processo FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_partes"
  ON public.partes_processo FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = partes_processo.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── 3. agenda_items ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.agenda_items;
DROP POLICY IF EXISTS "staff_full_access_agenda"     ON public.agenda_items;
DROP POLICY IF EXISTS "portal_cliente_agenda"        ON public.agenda_items;

CREATE POLICY "staff_full_access_agenda"
  ON public.agenda_items FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_agenda"
  ON public.agenda_items FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND visivel_cliente  = true
    AND processo_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = agenda_items.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── 4. prazos ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.prazos;
DROP POLICY IF EXISTS "staff_full_access_prazos"     ON public.prazos;
DROP POLICY IF EXISTS "portal_cliente_prazos"        ON public.prazos;

CREATE POLICY "staff_full_access_prazos"
  ON public.prazos FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_prazos"
  ON public.prazos FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND visivel_cliente  = true
    AND processo_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = prazos.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── 5. doc_gerados ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.doc_gerados;
DROP POLICY IF EXISTS "staff_full_access_doc_gerados" ON public.doc_gerados;
DROP POLICY IF EXISTS "portal_cliente_doc_gerados"   ON public.doc_gerados;

CREATE POLICY "staff_full_access_doc_gerados"
  ON public.doc_gerados FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_doc_gerados"
  ON public.doc_gerados FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND liberado_cliente  = true
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = doc_gerados.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── 6. documentos ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access"    ON public.documentos;
DROP POLICY IF EXISTS "staff_full_access_documentos" ON public.documentos;
DROP POLICY IF EXISTS "portal_cliente_documentos"    ON public.documentos;

CREATE POLICY "staff_full_access_documentos"
  ON public.documentos FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_documentos"
  ON public.documentos FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND liberado_cliente  = true
    AND EXISTS (
      SELECT 1 FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id   = documentos.cliente_id
        AND pc.ativo        = true
    )
  );

-- ─── 7. clientes ─────────────────────────────────────────────────────────────
-- Cliente vê apenas o próprio registro de dados cadastrais

DROP POLICY IF EXISTS "Authenticated full access"    ON public.clientes;
DROP POLICY IF EXISTS "staff_full_access_clientes"   ON public.clientes;
DROP POLICY IF EXISTS "portal_cliente_clientes"      ON public.clientes;

CREATE POLICY "staff_full_access_clientes"
  ON public.clientes FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.portal_clientes pc
      WHERE pc.auth_user_id = auth.uid()
        AND pc.cliente_id   = clientes.id
        AND pc.ativo        = true
    )
  );

-- ─── 8. contact_interactions — BLOQUEADO para 'cliente' ──────────────────────
-- Contém notas internas do CRM (ex: "cliente ligou"). Nunca expor ao portal.

DROP POLICY IF EXISTS "Authenticated full access on contact_interactions" ON public.contact_interactions;
DROP POLICY IF EXISTS "staff_full_access_interactions"                     ON public.contact_interactions;

CREATE POLICY "staff_full_access_interactions"
  ON public.contact_interactions FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );
-- Nenhuma policy criada para 'cliente' — acesso negado por padrão.

-- ─── 9. publicacoes ──────────────────────────────────────────────────────────
-- Cliente vê publicações dos seus processos visíveis (sem flag extra — todas visíveis)

DROP POLICY IF EXISTS "Authenticated full access"    ON public.publicacoes;
DROP POLICY IF EXISTS "staff_full_access_publicacoes" ON public.publicacoes;
DROP POLICY IF EXISTS "portal_cliente_publicacoes"   ON public.publicacoes;

CREATE POLICY "staff_full_access_publicacoes"
  ON public.publicacoes FOR ALL TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'comercial', 'administrativo',
      'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "portal_cliente_publicacoes"
  ON public.publicacoes FOR SELECT TO authenticated
  USING (
    current_user_role() = 'cliente'
    AND processo_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = publicacoes.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── Confirmação ─────────────────────────────────────────────────────────────

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'processos','partes_processo','agenda_items','prazos',
  'doc_gerados','documentos','clientes',
  'contact_interactions','publicacoes'
)
ORDER BY tablename, cmd, policyname;
