-- ─────────────────────────────────────────────────────────────────────────────
-- redistribute_trello_responsaveis.sql
--
-- Redistribui o campo responsavel_id nas tarefas importadas do Trello,
-- cruzando trello_member_id com trello_member_mappings.
--
-- PRÉ-REQUISITO: Execute kanban_trello_member_id.sql e depois rode o sync
-- em /integracoes/trello → "Sincronizar" para popular trello_member_id nas tarefas.
--
-- Depois desse sync, execute este script para redistribuir responsáveis.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. Diagnóstico inicial ────────────────────────────────────────────────────

DO $$
DECLARE
  v_total         bigint;
  v_com_member_id bigint;
  v_sem_member_id bigint;
  v_com_resp      bigint;
  v_sem_resp      bigint;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE trello_member_id IS NOT NULL),
    COUNT(*) FILTER (WHERE trello_member_id IS NULL),
    COUNT(*) FILTER (WHERE responsavel_id   IS NOT NULL),
    COUNT(*) FILTER (WHERE responsavel_id   IS NULL)
  INTO v_total, v_com_member_id, v_sem_member_id, v_com_resp, v_sem_resp
  FROM public.kanban_tasks
  WHERE origem = 'trello';

  RAISE NOTICE '=== ANTES DA REDISTRIBUIÇÃO ===';
  RAISE NOTICE 'Total de tarefas Trello  : %', v_total;
  RAISE NOTICE 'Com trello_member_id     : %', v_com_member_id;
  RAISE NOTICE 'Sem trello_member_id     : % (precisam de um novo sync para popular)', v_sem_member_id;
  RAISE NOTICE 'Com responsavel_id atual : %', v_com_resp;
  RAISE NOTICE 'Sem responsavel_id atual : %', v_sem_resp;
END $$;

-- ── 1. Atribuir responsável onde há mapping válido ────────────────────────────
-- Atualiza apenas as tarefas cujo responsavel_id está diferente do mapeado.

UPDATE public.kanban_tasks kt
SET
  responsavel_id = mm.profile_id,
  updated_at     = now()
FROM public.trello_member_mappings mm
WHERE kt.trello_member_id = mm.trello_member_id
  AND mm.profile_id IS NOT NULL
  AND kt.origem = 'trello'
  AND (kt.responsavel_id IS DISTINCT FROM mm.profile_id);

-- ── 2. Limpar responsável onde NÃO há mapping ─────────────────────────────────
-- Remove responsável manualmente atribuído quando o membro do Trello
-- não tem profile mapeado — garante que nunca fica atribuído à pessoa errada.

UPDATE public.kanban_tasks kt
SET
  responsavel_id = NULL,
  updated_at     = now()
WHERE kt.origem = 'trello'
  AND kt.trello_member_id IS NOT NULL
  AND kt.responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trello_member_mappings mm
    WHERE mm.trello_member_id = kt.trello_member_id
      AND mm.profile_id IS NOT NULL
  );

-- ── 3. Diagnóstico final ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_com_resp    bigint;
  v_sem_resp    bigint;
  v_sem_mapping bigint;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE responsavel_id IS NOT NULL),
    COUNT(*) FILTER (WHERE responsavel_id IS NULL),
    COUNT(*) FILTER (
      WHERE trello_member_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.trello_member_mappings mm
          WHERE mm.trello_member_id = kanban_tasks.trello_member_id
            AND mm.profile_id IS NOT NULL
        )
    )
  INTO v_com_resp, v_sem_resp, v_sem_mapping
  FROM public.kanban_tasks
  WHERE origem = 'trello';

  RAISE NOTICE '=== APÓS A REDISTRIBUIÇÃO ===';
  RAISE NOTICE 'Com responsável atribuído    : %', v_com_resp;
  RAISE NOTICE 'Sem responsável (sem mapping): %', v_sem_resp;
  RAISE NOTICE 'Com membro Trello sem mapping: %', v_sem_mapping;
END $$;

-- ── 4. Membros Trello ainda sem mapping (configure em /integracoes/trello) ────

SELECT
  kt.trello_member_id,
  MAX(mm.trello_full_name) AS nome_trello,
  MAX(mm.trello_username)  AS username_trello,
  COUNT(*)                 AS qtd_tarefas
FROM public.kanban_tasks kt
LEFT JOIN public.trello_member_mappings mm
  ON mm.trello_member_id = kt.trello_member_id
WHERE kt.origem = 'trello'
  AND kt.trello_member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trello_member_mappings mm2
    WHERE mm2.trello_member_id = kt.trello_member_id
      AND mm2.profile_id IS NOT NULL
  )
GROUP BY kt.trello_member_id
ORDER BY qtd_tarefas DESC;

COMMIT;
