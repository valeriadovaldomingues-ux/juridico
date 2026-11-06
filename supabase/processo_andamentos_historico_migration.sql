-- ============================================================
-- Histórico de alterações dos andamentos do processo
-- ============================================================
-- Cada edição de andamento grava o antes e o depois (quem, quando). Aditiva e idempotente; só o service role acessa
-- (RLS ligado, sem políticas). Sem FK para o andamento de propósito: o registro sobrevive mesmo se ele for excluído.

CREATE TABLE IF NOT EXISTS public.processo_andamentos_historico (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  andamento_id  uuid NOT NULL,
  processo_id   uuid NOT NULL,
  acao          text NOT NULL CHECK (acao IN ('edicao', 'exclusao')),
  antes         jsonb NOT NULL,
  depois        jsonb,
  feito_por     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  feito_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processo_andamentos_historico_andamento_idx ON public.processo_andamentos_historico (andamento_id, feito_em DESC);
CREATE INDEX IF NOT EXISTS processo_andamentos_historico_processo_idx ON public.processo_andamentos_historico (processo_id);

ALTER TABLE public.processo_andamentos_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processo_andamentos_historico FROM anon, authenticated;
