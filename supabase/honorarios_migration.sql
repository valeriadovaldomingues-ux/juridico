-- =============================================
-- Controle de Honorários — PEDV
-- Financeiro > Controle de Honorários.
-- Config recorrente por cliente + registro mensal com carry-over + fechamento.
-- Acesso: apenas 'socio' (espelha a trava de /financeiro).
-- Execute no Supabase Dashboard → SQL Editor → New Query.
-- Migration puramente aditiva (apenas CREATE de tabelas novas).
-- =============================================

-- ─── Função utilitária de updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.honorarios_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================
-- 1. honorarios_contratos — config recorrente por cliente
-- =============================================
CREATE TABLE IF NOT EXISTS public.honorarios_contratos (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid          NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor_mensal   numeric(15,2) NOT NULL CHECK (valor_mensal >= 0),
  dia_vencimento smallint      NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
  isento         boolean       NOT NULL DEFAULT false,
  status         text          NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'suspenso', 'encerrado')),
  data_inicio    date          NOT NULL DEFAULT CURRENT_DATE,
  data_fim       date,
  observacoes    text,
  criado_por     uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.honorarios_contratos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.honorarios_contratos TO authenticated;

-- No máximo um contrato ativo por cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_honorarios_contratos_cliente_ativo
  ON public.honorarios_contratos(cliente_id)
  WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_honorarios_contratos_cliente_id
  ON public.honorarios_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_honorarios_contratos_status
  ON public.honorarios_contratos(status);

DROP POLICY IF EXISTS "honorarios_contratos_select_socio" ON public.honorarios_contratos;
DROP POLICY IF EXISTS "honorarios_contratos_insert_socio" ON public.honorarios_contratos;
DROP POLICY IF EXISTS "honorarios_contratos_update_socio" ON public.honorarios_contratos;
DROP POLICY IF EXISTS "honorarios_contratos_delete_socio" ON public.honorarios_contratos;

CREATE POLICY "honorarios_contratos_select_socio"
  ON public.honorarios_contratos FOR SELECT TO authenticated
  USING (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_contratos_insert_socio"
  ON public.honorarios_contratos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_contratos_update_socio"
  ON public.honorarios_contratos FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_contratos_delete_socio"
  ON public.honorarios_contratos FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');

DROP TRIGGER IF EXISTS trg_honorarios_contratos_updated_at ON public.honorarios_contratos;
CREATE TRIGGER trg_honorarios_contratos_updated_at
  BEFORE UPDATE ON public.honorarios_contratos
  FOR EACH ROW EXECUTE FUNCTION public.honorarios_set_updated_at();

-- =============================================
-- 2. honorarios_mensais — registro mês × cliente (tabela principal)
-- =============================================
CREATE TABLE IF NOT EXISTS public.honorarios_mensais (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia               date          NOT NULL,  -- sempre o dia 01 do mês de referência
  cliente_id                uuid          NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id               uuid          REFERENCES public.honorarios_contratos(id) ON DELETE SET NULL,
  valor_devido              numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_devido >= 0),
  saldo_anterior            numeric(15,2) NOT NULL DEFAULT 0,
  valor_pago                numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  saldo_pendente            numeric(15,2) GENERATED ALWAYS AS
                              (valor_devido + saldo_anterior - valor_pago) STORED,
  vencimento                date,
  status                    text          NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pago', 'pendente', 'parcial', 'em_atraso', 'isento')),
  data_pagamento            date,
  forma_pagamento           text,
  observacoes               text,
  responsavel_lancamento_id uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Recorrente (do contrato) ou avulso (honorário extra/isolado parcelado).
  tipo                      text          NOT NULL DEFAULT 'recorrente'
                              CHECK (tipo IN ('recorrente', 'extra')),
  extra_id                  uuid,         -- FK p/ honorarios_extras (adicionada abaixo)
  parcela_num               smallint,
  parcela_total             smallint,
  -- Cancelamento (sem exclusão definitiva) + arquivamento.
  cancelado                 boolean       NOT NULL DEFAULT false,
  cancelado_em              timestamptz,
  cancelado_por             uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  arquivado                 boolean       NOT NULL DEFAULT false,
  criado_por                uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

-- Um único registro RECORRENTE por cliente/competência (extras podem coexistir).
CREATE UNIQUE INDEX IF NOT EXISTS uq_honorarios_mensais_recorrente
  ON public.honorarios_mensais(cliente_id, competencia)
  WHERE tipo = 'recorrente';

ALTER TABLE public.honorarios_mensais ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.honorarios_mensais TO authenticated;

CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_competencia
  ON public.honorarios_mensais(competencia);
CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_cliente_competencia
  ON public.honorarios_mensais(cliente_id, competencia);
CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_status
  ON public.honorarios_mensais(status);
CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_arquivado
  ON public.honorarios_mensais(arquivado);
CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_extra_id
  ON public.honorarios_mensais(extra_id);
CREATE INDEX IF NOT EXISTS idx_honorarios_mensais_cancelado
  ON public.honorarios_mensais(cancelado);

DROP POLICY IF EXISTS "honorarios_mensais_select_socio" ON public.honorarios_mensais;
DROP POLICY IF EXISTS "honorarios_mensais_insert_socio" ON public.honorarios_mensais;
DROP POLICY IF EXISTS "honorarios_mensais_update_socio" ON public.honorarios_mensais;
DROP POLICY IF EXISTS "honorarios_mensais_delete_socio" ON public.honorarios_mensais;

CREATE POLICY "honorarios_mensais_select_socio"
  ON public.honorarios_mensais FOR SELECT TO authenticated
  USING (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_mensais_insert_socio"
  ON public.honorarios_mensais FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_mensais_update_socio"
  ON public.honorarios_mensais FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_mensais_delete_socio"
  ON public.honorarios_mensais FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');

DROP TRIGGER IF EXISTS trg_honorarios_mensais_updated_at ON public.honorarios_mensais;
CREATE TRIGGER trg_honorarios_mensais_updated_at
  BEFORE UPDATE ON public.honorarios_mensais
  FOR EACH ROW EXECUTE FUNCTION public.honorarios_set_updated_at();

-- =============================================
-- 3. honorarios_fechamentos — consolidação/auditoria do "Fechar mês"
-- =============================================
CREATE TABLE IF NOT EXISTS public.honorarios_fechamentos (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia     date          NOT NULL UNIQUE,  -- dia 01 do mês fechado
  fechado_em      timestamptz   NOT NULL DEFAULT now(),
  fechado_por     uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_previsto  numeric(15,2) NOT NULL DEFAULT 0,
  total_recebido  numeric(15,2) NOT NULL DEFAULT 0,
  total_pendente  numeric(15,2) NOT NULL DEFAULT 0,
  observacoes     text
);

ALTER TABLE public.honorarios_fechamentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.honorarios_fechamentos TO authenticated;

DROP POLICY IF EXISTS "honorarios_fechamentos_select_socio" ON public.honorarios_fechamentos;
DROP POLICY IF EXISTS "honorarios_fechamentos_insert_socio" ON public.honorarios_fechamentos;
DROP POLICY IF EXISTS "honorarios_fechamentos_update_socio" ON public.honorarios_fechamentos;
DROP POLICY IF EXISTS "honorarios_fechamentos_delete_socio" ON public.honorarios_fechamentos;

CREATE POLICY "honorarios_fechamentos_select_socio"
  ON public.honorarios_fechamentos FOR SELECT TO authenticated
  USING (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_fechamentos_insert_socio"
  ON public.honorarios_fechamentos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_fechamentos_update_socio"
  ON public.honorarios_fechamentos FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_fechamentos_delete_socio"
  ON public.honorarios_fechamentos FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');

-- =============================================
-- 4. honorarios_extras — honorários avulsos/isolados (com parcelas)
-- =============================================
CREATE TABLE IF NOT EXISTS public.honorarios_extras (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           uuid          NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  descricao            text          NOT NULL,
  valor_total          numeric(15,2) NOT NULL CHECK (valor_total >= 0),
  num_parcelas         smallint      NOT NULL DEFAULT 1 CHECK (num_parcelas BETWEEN 1 AND 60),
  forma_pagamento      text,
  primeira_competencia date          NOT NULL,  -- dia 01 do 1º mês
  status               text          NOT NULL DEFAULT 'ativo'
                         CHECK (status IN ('ativo', 'cancelado')),
  observacoes          text,
  criado_por           uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.honorarios_extras ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.honorarios_extras TO authenticated;

-- FK de honorarios_mensais.extra_id (a tabela já existe acima).
ALTER TABLE public.honorarios_mensais
  DROP CONSTRAINT IF EXISTS fk_honorarios_mensais_extra;
ALTER TABLE public.honorarios_mensais
  ADD CONSTRAINT fk_honorarios_mensais_extra
  FOREIGN KEY (extra_id) REFERENCES public.honorarios_extras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_honorarios_extras_cliente_id
  ON public.honorarios_extras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_honorarios_extras_status
  ON public.honorarios_extras(status);

DROP POLICY IF EXISTS "honorarios_extras_select_socio" ON public.honorarios_extras;
DROP POLICY IF EXISTS "honorarios_extras_insert_socio" ON public.honorarios_extras;
DROP POLICY IF EXISTS "honorarios_extras_update_socio" ON public.honorarios_extras;
DROP POLICY IF EXISTS "honorarios_extras_delete_socio" ON public.honorarios_extras;

CREATE POLICY "honorarios_extras_select_socio"
  ON public.honorarios_extras FOR SELECT TO authenticated
  USING (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_extras_insert_socio"
  ON public.honorarios_extras FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_extras_update_socio"
  ON public.honorarios_extras FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'socio')
  WITH CHECK (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_extras_delete_socio"
  ON public.honorarios_extras FOR DELETE TO authenticated
  USING (public.current_user_role() = 'socio');

DROP TRIGGER IF EXISTS trg_honorarios_extras_updated_at ON public.honorarios_extras;
CREATE TRIGGER trg_honorarios_extras_updated_at
  BEFORE UPDATE ON public.honorarios_extras
  FOR EACH ROW EXECUTE FUNCTION public.honorarios_set_updated_at();

-- =============================================
-- 5. honorarios_logs — auditoria (sem exclusão definitiva de lançamentos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.honorarios_logs (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id     uuid          REFERENCES public.honorarios_mensais(id) ON DELETE SET NULL,
  extra_id        uuid          REFERENCES public.honorarios_extras(id) ON DELETE SET NULL,
  acao            text          NOT NULL
                    CHECK (acao IN ('criado', 'editado', 'pago', 'cancelado', 'arquivado', 'fechamento')),
  detalhes        jsonb         NOT NULL DEFAULT '{}'::jsonb,
  valor_anterior  numeric(15,2),
  status_anterior text,
  executado_por   uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.honorarios_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE public.honorarios_logs TO authenticated;

CREATE INDEX IF NOT EXISTS idx_honorarios_logs_registro_id
  ON public.honorarios_logs(registro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_honorarios_logs_extra_id
  ON public.honorarios_logs(extra_id, created_at DESC);

DROP POLICY IF EXISTS "honorarios_logs_select_socio" ON public.honorarios_logs;
DROP POLICY IF EXISTS "honorarios_logs_insert_socio" ON public.honorarios_logs;

CREATE POLICY "honorarios_logs_select_socio"
  ON public.honorarios_logs FOR SELECT TO authenticated
  USING (public.current_user_role() = 'socio');
CREATE POLICY "honorarios_logs_insert_socio"
  ON public.honorarios_logs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'socio');
