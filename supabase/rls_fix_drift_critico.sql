-- ============================================================================
-- rls_fix_drift_critico.sql
-- ============================================================================
-- CONTEXTO
--   Auditoria (via SELECT em pg_policies) confirmou que estas tabelas estão em
--   produção com policy "Authenticated full access" USING (true) / "allow all",
--   ou seja: QUALQUER usuário autenticado — inclusive um 'cliente' do portal,
--   que possui sessão Supabase e a anon key (pública) — pode ler/gravar/apagar
--   todos os registros via PostgREST direto, ignorando as rotas de API.
--
--   Causa provável: a migration `portal_rls_migration.sql` NÃO foi aplicada neste
--   banco, embora `rls_hardening_prioridade_alta.sql` tenha sido. Este arquivo:
--     (a) fecha os 4 alvos críticos ABERTOS (clientes, processos, partes, prazos);
--     (b) corrige o BUG DO PORTAL: adiciona a policy de leitura do cliente em
--         documentos/doc_gerados. Essas duas já foram endurecidas para staff
--         (rls_hardening), mas a policy do cliente nunca foi criada → hoje o
--         portal mostra ZERO documentos ao cliente. Aqui a adição é NÃO-destrutiva
--         (não tocamos nas policies de staff já aplicadas).
--   As demais tabelas `USING(true)` (leads, propostas_comerciais, kanban_tasks,
--   pessoas, monitoramento_*, etc.) ficam para uma segunda rodada.
--
--   Padrão idêntico ao já usado no repositório:
--     • staff: current_user_role() IN (...roles internos...)   — FOR ALL
--     • portal: role 'cliente' + vínculo em portal_clientes    — FOR SELECT
--   Flags de visibilidade (visivel_cliente / liberado_cliente) têm DEFAULT false
--   → nada é exposto ao cliente até o escritório liberar explicitamente.
--
--   Idempotente (DROP POLICY IF EXISTS antes de cada CREATE). NÃO altera dados.
--   Requer a função public.current_user_role() (auth_setup.sql / profiles_rls).
--
--   >>> ANTES DE APLICAR: teste em staging. As policies dependem de
--   >>> current_user_role()/auth.uid(); confirme que o staff continua vendo tudo
--   >>> e que o cliente vê apenas o próprio escopo (valida o comportamento do
--   >>> @supabase/ssr propagando o JWT ao PostgREST).
-- ============================================================================

BEGIN;

-- Garante RLS ativo (idempotente).
ALTER TABLE public.clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partes_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos          ENABLE ROW LEVEL SECURITY;
-- NOTA: trello_integrations foi removido deste fix — a integração Trello está
-- sendo descontinuada (tabela será dropada). Ver plano de remoção do Trello.

-- ─── 1. processos ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated full access"   ON public.processos;
DROP POLICY IF EXISTS "staff_full_access_processos" ON public.processos;
DROP POLICY IF EXISTS "portal_cliente_processos"    ON public.processos;

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

-- ─── 2. partes_processo ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated full access" ON public.partes_processo;
DROP POLICY IF EXISTS "staff_full_access_partes"  ON public.partes_processo;
DROP POLICY IF EXISTS "portal_cliente_partes"     ON public.partes_processo;

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

-- ─── 3. prazos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated full access" ON public.prazos;
DROP POLICY IF EXISTS "staff_full_access_prazos"  ON public.prazos;
DROP POLICY IF EXISTS "portal_cliente_prazos"     ON public.prazos;

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
    AND EXISTS (
      SELECT 1 FROM public.processos p
      INNER JOIN public.portal_clientes pc ON pc.cliente_id = p.cliente_id
      WHERE p.id              = prazos.processo_id
        AND p.visivel_cliente = true
        AND pc.auth_user_id   = auth.uid()
        AND pc.ativo          = true
    )
  );

-- ─── 4. clientes ────────────────────────────────────────────────────────────
-- Cliente vê apenas o próprio registro cadastral (clientes.id == seu vínculo).
DROP POLICY IF EXISTS "Authenticated full access" ON public.clientes;
DROP POLICY IF EXISTS "staff_full_access_clientes" ON public.clientes;
DROP POLICY IF EXISTS "portal_cliente_clientes"    ON public.clientes;

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

-- ─── 5. documentos + doc_gerados — BUG DO PORTAL (adição NÃO-destrutiva) ─────
-- Estas tabelas JÁ têm policies de staff aplicadas (rls_hardening, por operação,
-- roles administrativo/advogado/gerente/socio). NÃO as tocamos aqui. Apenas
-- adicionamos a policy de LEITURA do cliente que faltou — sem ela, a rota
-- /api/portal/documentos (que lê com a sessão do cliente, sujeita a RLS) retorna
-- ZERO linhas mesmo com liberado_cliente = true.

DROP POLICY IF EXISTS "portal_cliente_documentos" ON public.documentos;
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

DROP POLICY IF EXISTS "portal_cliente_doc_gerados" ON public.doc_gerados;
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

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (rode após aplicar — deve retornar 0 linhas para estas tabelas)
-- ============================================================================
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('clientes','processos','partes_processo','prazos')
--   AND qual = 'true';
--
-- E conferir que cada tabela tem as policies esperadas:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('clientes','processos','partes_processo','prazos')
-- ORDER BY tablename, policyname;
--
-- Bug do portal: confirmar que as policies de leitura do cliente existem
-- (deve retornar 2 linhas):
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname IN ('portal_cliente_documentos','portal_cliente_doc_gerados');
-- ============================================================================
