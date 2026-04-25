-- =====================================================================
-- MIGRATION: Corrigir responsavel_id inválidos em kanban_tasks
-- Origem do problema: componente legado criou tarefas com UUIDs fake
-- de teste. Esses IDs não correspondem a usuários reais do sistema.
--
-- SEGURO para rodar em produção:
--   - Usa transação com ROLLBACK automático em caso de erro
--   - Apenas zera responsavel_id, nunca apaga tarefas
--   - Inclui contagem antes/depois para auditoria
-- =====================================================================

BEGIN;

-- ── 1. Auditoria antes ────────────────────────────────────────────────────────

DO $$
DECLARE
  n_fake    integer;
  n_orphan  integer;
BEGIN
  SELECT COUNT(*) INTO n_fake
  FROM public.kanban_tasks
  WHERE responsavel_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  );

  SELECT COUNT(*) INTO n_orphan
  FROM public.kanban_tasks kt
  WHERE kt.responsavel_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = kt.responsavel_id
    );

  RAISE NOTICE '>>> ANTES: % tarefas com UUID placeholder, % tarefas com responsavel_id órfão (sem profile correspondente)',
    n_fake, n_orphan;
END $$;

-- ── 2. Zerar UUIDs placeholder conhecidos ─────────────────────────────────────

UPDATE public.kanban_tasks
SET
  responsavel_id = NULL,
  updated_at     = now()
WHERE responsavel_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- ── 3. Zerar qualquer responsavel_id que aponte para perfil inexistente ────────
--    Seguro: FK com ON DELETE SET NULL garante consistência futura,
--    mas registros inseridos via service_role podem ter burlado a constraint.

UPDATE public.kanban_tasks kt
SET
  responsavel_id = NULL,
  updated_at     = now()
WHERE kt.responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = kt.responsavel_id
  );

-- ── 4. Auditoria depois ───────────────────────────────────────────────────────

DO $$
DECLARE
  n_sem_resp        integer;
  n_com_resp        integer;
  n_trello_sem_resp integer;
BEGIN
  SELECT COUNT(*) INTO n_sem_resp
  FROM public.kanban_tasks
  WHERE responsavel_id IS NULL;

  SELECT COUNT(*) INTO n_com_resp
  FROM public.kanban_tasks
  WHERE responsavel_id IS NOT NULL;

  SELECT COUNT(*) INTO n_trello_sem_resp
  FROM public.kanban_tasks
  WHERE origem = 'trello' AND responsavel_id IS NULL;

  RAISE NOTICE '>>> DEPOIS: % tarefas SEM responsável, % COM responsável válido',
    n_sem_resp, n_com_resp;
  RAISE NOTICE '>>> Trello sem responsável (aguardam mapeamento): %',
    n_trello_sem_resp;
END $$;

-- ── 5. Índice para acelerar filtragem por responsavel_id ──────────────────────
--    Melhora performance da aba "Responsáveis" do Kanban

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_responsavel_id
  ON public.kanban_tasks(responsavel_id)
  WHERE responsavel_id IS NOT NULL;

COMMIT;

-- =====================================================================
-- PRÓXIMOS PASSOS (manual, após rodar este script):
--
-- 1. Acesse /integracoes/trello
-- 2. Na aba "Membros", mapeie cada membro do Trello para um usuário
--    do sistema.
-- 3. Clique em "Sincronizar agora" — o sync irá preencher o
--    responsavel_id das tarefas Trello conforme o mapeamento.
-- 4. As tarefas sem mapping continuarão como "Sem responsável" e
--    aparecerão na seção correspondente no Kanban.
-- =====================================================================
