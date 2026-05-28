-- ============================================================
-- Corrige ambiguidade da RPC get_produtividade_colaboradores
-- Mantem apenas a assinatura oficial com timestamptz.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_produtividade_colaboradores(date, date);

CREATE OR REPLACE FUNCTION public.get_produtividade_colaboradores(
  p_inicio timestamp with time zone,
  p_fim    timestamp with time zone
)
RETURNS TABLE (
  profile_id  uuid,
  nome        text,
  role        text,
  total       bigint,
  no_prazo    bigint,
  adiantado   bigint,
  atrasado    bigint,
  sem_prazo   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS profile_id,
    p.nome,
    p.role::text,
    COUNT(*) AS total,
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date <= kt.data::date
    ) AS no_prazo,
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date < kt.data::date
    ) AS adiantado,
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date > kt.data::date
    ) AS atrasado,
    COUNT(*) FILTER (
      WHERE kt.data IS NULL
    ) AS sem_prazo
  FROM public.profiles p
  INNER JOIN public.kanban_tasks kt
    ON  kt.responsavel_id = p.id
    AND kt.status         = 'concluido'
    AND kt.concluido_em  IS NOT NULL
    AND kt.concluido_em  >= p_inicio
    AND kt.concluido_em   < p_fim
  WHERE p.ativo = true
  GROUP BY p.id, p.nome, p.role
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_produtividade_colaboradores(timestamp with time zone, timestamp with time zone)
  TO authenticated;
