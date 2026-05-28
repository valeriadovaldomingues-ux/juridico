-- =============================================
-- Agenda Time Entries — PEDV
-- Registro de horas trabalhadas e cobrança por item da agenda.
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.agenda_time_entries (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id           uuid        NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  cliente_id               uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id              uuid        REFERENCES public.processos(id) ON DELETE SET NULL,
  inicio_em                timestamptz NOT NULL,
  fim_em                   timestamptz,
  duracao_calculada_minutos integer,
  duracao_manual_minutos    integer,
  usa_duracao_manual       boolean     NOT NULL DEFAULT false,
  descricao_atividade      text        NOT NULL DEFAULT '',
  cobravel                 boolean     NOT NULL DEFAULT true,
  valor_hora               numeric(12,2),
  valor_total              numeric(12,2),
  observacoes              text,
  status_cobranca          text        NOT NULL DEFAULT 'pendente'
                             CHECK (status_cobranca IN ('pendente', 'faturado', 'nao_faturavel')),
  financeiro_lancamento_id uuid        REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  criado_por               uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_time_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agenda_time_entries TO authenticated;

DROP POLICY IF EXISTS "agenda_time_entries_select_staff" ON public.agenda_time_entries;
DROP POLICY IF EXISTS "agenda_time_entries_insert_staff" ON public.agenda_time_entries;
DROP POLICY IF EXISTS "agenda_time_entries_update_staff" ON public.agenda_time_entries;
DROP POLICY IF EXISTS "agenda_time_entries_delete_staff" ON public.agenda_time_entries;
DROP POLICY IF EXISTS "Authenticated full access" ON public.agenda_time_entries;

CREATE POLICY "agenda_time_entries_select_staff"
  ON public.agenda_time_entries
  FOR SELECT TO authenticated
  USING (
    current_user_role() IN (
      'estagiario', 'administrativo', 'advogado', 'gerente', 'socio'
    )
  );

CREATE POLICY "agenda_time_entries_insert_staff"
  ON public.agenda_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() IN (
      'administrativo', 'advogado', 'gerente', 'socio'
    )
    AND criado_por = auth.uid()
  );

CREATE POLICY "agenda_time_entries_update_staff"
  ON public.agenda_time_entries
  FOR UPDATE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'gerente', 'socio')
    OR (
      current_user_role() = 'advogado'
      AND criado_por = auth.uid()
    )
  )
  WITH CHECK (
    current_user_role() IN ('administrativo', 'gerente', 'socio')
    OR (
      current_user_role() = 'advogado'
      AND criado_por = auth.uid()
    )
  );

CREATE POLICY "agenda_time_entries_delete_staff"
  ON public.agenda_time_entries
  FOR DELETE TO authenticated
  USING (
    current_user_role() IN ('administrativo', 'gerente', 'socio')
    OR (
      current_user_role() = 'advogado'
      AND criado_por = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_agenda_item_id
  ON public.agenda_time_entries(agenda_item_id);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_cliente_id
  ON public.agenda_time_entries(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_processo_id
  ON public.agenda_time_entries(processo_id);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_inicio_em
  ON public.agenda_time_entries(inicio_em DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_criado_por
  ON public.agenda_time_entries(criado_por);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_status_cobranca
  ON public.agenda_time_entries(status_cobranca);
CREATE INDEX IF NOT EXISTS idx_agenda_time_entries_financeiro_lancamento_id
  ON public.agenda_time_entries(financeiro_lancamento_id);

CREATE OR REPLACE FUNCTION public.set_agenda_time_entries_derived_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  effective_minutes integer;
BEGIN
  NEW.updated_at = now();

  IF NEW.inicio_em IS NOT NULL AND NEW.fim_em IS NOT NULL THEN
    NEW.duracao_calculada_minutos := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (NEW.fim_em - NEW.inicio_em)) / 60)::integer
    );
  ELSE
    NEW.duracao_calculada_minutos := NULL;
  END IF;

  IF NEW.usa_duracao_manual AND NEW.duracao_manual_minutos IS NOT NULL THEN
    effective_minutes := GREATEST(0, NEW.duracao_manual_minutos);
  ELSE
    effective_minutes := NEW.duracao_calculada_minutos;
  END IF;

  IF NEW.cobravel IS NOT TRUE OR NEW.status_cobranca = 'nao_faturavel' THEN
    NEW.cobravel := false;
    NEW.status_cobranca := 'nao_faturavel';
    NEW.valor_total := NULL;
  ELSIF NEW.valor_hora IS NOT NULL AND effective_minutes IS NOT NULL THEN
    NEW.status_cobranca := COALESCE(NEW.status_cobranca, 'pendente');
    NEW.valor_total := ROUND(((effective_minutes::numeric / 60) * NEW.valor_hora)::numeric, 2);
  ELSE
    NEW.valor_total := NULL;
    IF NEW.status_cobranca IS NULL THEN
      NEW.status_cobranca := 'pendente';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_time_entries_derived_fields ON public.agenda_time_entries;
CREATE TRIGGER trg_agenda_time_entries_derived_fields
  BEFORE INSERT OR UPDATE ON public.agenda_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agenda_time_entries_derived_fields();

