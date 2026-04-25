-- =============================================
-- Módulo Agenda Jurídica — PEDV
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.agenda_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  descricao   text,
  tipo        text        NOT NULL DEFAULT 'tarefa'
                          CHECK (tipo IN ('tarefa', 'evento', 'prazo', 'audiencia')),
  status      text        NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  data_inicio date        NOT NULL,
  hora_inicio time,
  data_fim    date,
  hora_fim    time,
  prazo_final date,
  prioridade  text        NOT NULL DEFAULT 'media'
                          CHECK (prioridade IN ('baixa', 'media', 'alta')),
  processo_id uuid        REFERENCES public.processos(id)  ON DELETE SET NULL,
  cliente_id  uuid        REFERENCES public.clientes(id)   ON DELETE SET NULL,
  responsavel text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access"
  ON public.agenda_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agenda_data    ON public.agenda_items(data_inicio);
CREATE INDEX IF NOT EXISTS idx_agenda_tipo    ON public.agenda_items(tipo);
CREATE INDEX IF NOT EXISTS idx_agenda_status  ON public.agenda_items(status);
CREATE INDEX IF NOT EXISTS idx_agenda_proc    ON public.agenda_items(processo_id);
CREATE INDEX IF NOT EXISTS idx_agenda_cliente ON public.agenda_items(cliente_id);
