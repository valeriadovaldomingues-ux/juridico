-- =============================================
-- Módulo Kanban — PEDV
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.kanban_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  descricao   text,
  status      text        NOT NULL DEFAULT 'a_fazer'
                          CHECK (status IN ('a_fazer', 'fazendo', 'concluido')),
  data        date,
  responsavel text,
  tipo        text        NOT NULL DEFAULT 'tarefa'
                          CHECK (tipo IN ('tarefa', 'prazo', 'audiencia', 'reuniao', 'outro')),
  processo_id uuid        REFERENCES public.processos(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access"
  ON public.kanban_tasks FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kanban_status   ON public.kanban_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kanban_processo  ON public.kanban_tasks(processo_id);
CREATE INDEX IF NOT EXISTS idx_kanban_created  ON public.kanban_tasks(created_at);
