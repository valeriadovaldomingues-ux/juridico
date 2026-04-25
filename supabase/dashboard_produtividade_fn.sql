-- =============================================
-- Função: produtividade de colaboradores
-- Agrega kanban_tasks concluídas por responsável num intervalo de datas.
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

CREATE OR REPLACE FUNCTION get_produtividade_colaboradores(
  p_inicio timestamptz,
  p_fim    timestamptz
)
RETURNS TABLE (
  profile_id  uuid,
  nome        text,
  role        text,
  total       bigint,   -- tarefas concluídas no período
  no_prazo    bigint,   -- concluido_em::date <= data::date (quando data existe)
  adiantado   bigint,   -- concluido_em::date <  data::date
  atrasado    bigint,   -- concluido_em::date >  data::date
  sem_prazo   bigint    -- data IS NULL (sem prazo definido)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                                          AS profile_id,
    p.nome,
    p.role::text,
    COUNT(*)                                                      AS total,

    -- concluído antes ou exatamente no prazo
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date <= kt.data::date
    )                                                             AS no_prazo,

    -- concluído antes do prazo (adiantado, subconjunto de no_prazo)
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date < kt.data::date
    )                                                             AS adiantado,

    -- concluído após o prazo
    COUNT(*) FILTER (
      WHERE kt.data IS NOT NULL
        AND kt.concluido_em::date > kt.data::date
    )                                                             AS atrasado,

    -- sem prazo cadastrado
    COUNT(*) FILTER (
      WHERE kt.data IS NULL
    )                                                             AS sem_prazo

  FROM profiles p
  INNER JOIN kanban_tasks kt
    ON  kt.responsavel_id = p.id
    AND kt.status         = 'concluido'
    AND kt.concluido_em  IS NOT NULL
    AND kt.concluido_em  >= p_inicio
    AND kt.concluido_em   < p_fim

  WHERE p.ativo = true

  GROUP BY p.id, p.nome, p.role
  ORDER BY total DESC;
$$;

-- Permissão para o role authenticated (usado via service key ou anon key autenticado)
GRANT EXECUTE ON FUNCTION get_produtividade_colaboradores(timestamptz, timestamptz)
  TO authenticated;
