-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  message     text        NOT NULL,
  type        text        NOT NULL DEFAULT 'info'
              CHECK (type IN ('info', 'warning', 'critical', 'success')),
  is_read     boolean     NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- Automation runs log (to avoid duplicate executions)
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       uuid        NOT NULL,
  action_type     text        NOT NULL,
  status          text        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','skipped','error')),
  message         text,
  created_task_id uuid,
  executed_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gerentes e socios veem automation_runs"
  ON public.automation_runs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio','administrativo')
  ));
CREATE POLICY "System inserts automation_runs"
  ON public.automation_runs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_auto_runs_rule_entity ON public.automation_runs(rule_type, entity_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_runs_executed ON public.automation_runs(executed_at DESC);
