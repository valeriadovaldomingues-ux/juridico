-- =============================================
-- Automações Inteligentes v2 — PEDV
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- ── 1. Adicionar automacao à origem do Kanban ──────────────────────────────────

ALTER TABLE public.kanban_tasks DROP CONSTRAINT IF EXISTS kanban_tasks_origem_check;
ALTER TABLE public.kanban_tasks
  ADD CONSTRAINT kanban_tasks_origem_check
    CHECK (origem IN ('manual', 'publicacao', 'agenda', 'processo', 'trello', 'automacao'));

-- ── 2. Tabela de regras de automação ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text,
  trigger_type        text        NOT NULL,
  trigger_conditions  jsonb       NOT NULL DEFAULT '{}',
  action_type         text        NOT NULL,
  action_payload      jsonb       NOT NULL DEFAULT '{}',
  is_active           boolean     NOT NULL DEFAULT true,
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automations TO authenticated;
DROP POLICY IF EXISTS "automations_admin" ON public.automations;
CREATE POLICY "automations_admin"
  ON public.automations FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 3. Adicionar automation_id ao histórico existente ─────────────────────────

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auto_runs_automation_entity
  ON public.automation_runs(automation_id, entity_id, executed_at DESC);

-- ── 4. Modelos de mensagem ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  template_type text        NOT NULL,
  content       text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_templates TO authenticated;
DROP POLICY IF EXISTS "message_templates_auth" ON public.message_templates;
CREATE POLICY "message_templates_auth"
  ON public.message_templates FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('gerente','socio')
  ));

-- ── 5. Índice extra em notifications ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- ── 6. Seed: automações padrão ────────────────────────────────────────────────

INSERT INTO public.automations (name, description, trigger_type, trigger_conditions, action_type, action_payload, is_active)
VALUES

('Lead parado',
 'Cria tarefa de follow-up quando um lead fica sem atualização por X dias.',
 'lead_parado',
 '{"days": 7}',
 'criar_tarefa',
 '{"task_priority": "alta", "notify_responsavel": true, "cooldown_hours": 168}',
 true),

('Proposta sem resposta',
 'Alerta quando uma proposta enviada fica sem resposta por X dias.',
 'proposta_sem_resposta',
 '{"days": 5}',
 'criar_tarefa',
 '{"task_priority": "alta", "notify_responsavel": true, "cooldown_hours": 120}',
 true),

('Cliente sem contato',
 'Lembra de entrar em contato com clientes sem interação recente.',
 'cliente_sem_contato',
 '{"days": 30}',
 'criar_tarefa',
 '{"task_priority": "media", "notify_roles": ["gerente","socio"], "cooldown_hours": 720}',
 true),

('Aniversário de cliente',
 'Notifica no dia do aniversário de um cliente.',
 'aniversario_cliente',
 '{}',
 'notificar',
 '{"notify_roles": ["gerente","socio","advogado","administrativo"], "cooldown_hours": 20}',
 true),

('Aniversário da equipe',
 'Avisa gestores no dia do aniversário de um colaborador.',
 'aniversario_equipe',
 '{}',
 'notificar',
 '{"notify_roles": ["gerente","socio"], "cooldown_hours": 20}',
 true),

('Tarefa vencida',
 'Notifica responsável e gestores quando uma tarefa do Kanban vence sem conclusão.',
 'tarefa_vencida',
 '{}',
 'notificar',
 '{"notify_responsavel": true, "notify_roles": ["gerente","socio"], "cooldown_hours": 24}',
 true),

('Tarefa vencendo hoje',
 'Alerta o responsável sobre tarefas que vencem hoje.',
 'tarefa_vencendo_hoje',
 '{}',
 'notificar',
 '{"notify_responsavel": true, "cooldown_hours": 22}',
 true),

('Usuário sem movimentação',
 'Alerta gestores quando colaborador fica X dias sem atualizar tarefas.',
 'usuario_sem_movimentacao',
 '{"days": 3}',
 'notificar',
 '{"notify_roles": ["gerente","socio"], "cooldown_hours": 72}',
 true),

('Usuário sem timesheet',
 'Alerta gestores quando colaborador não lança horas no dia. (Requer módulo Timesheet)',
 'usuario_sem_timesheet',
 '{"hora_limite": "18:00"}',
 'notificar',
 '{"notify_roles": ["gerente","socio"], "cooldown_hours": 20}',
 false)

ON CONFLICT DO NOTHING;

-- ── 7. Seed: modelos de mensagem ──────────────────────────────────────────────

INSERT INTO public.message_templates (name, template_type, content, is_active)
VALUES

('Follow-up comercial',
 'lead_parado',
 'Olá, [nome]! Passando para ver se você teve a oportunidade de pensar em como podemos ajudar. Estou à disposição para qualquer dúvida. Abraços, [responsavel]',
 true),

('Proposta sem resposta',
 'proposta_sem_resposta',
 'Olá, [nome]! Passando para saber se conseguiu analisar a proposta que enviamos. Podemos ajustar o que for necessário. Abraços, [responsavel]',
 true),

('Cliente sem contato',
 'cliente_sem_contato',
 'Olá, [nome]! Faz algum tempo que não nos falamos. Gostaríamos de saber se há algo em que possamos ajudar. Abraços, [responsavel]',
 true),

('Parabéns — aniversário cliente',
 'aniversario_cliente',
 'Olá, [nome]! Desejamos a você um feliz aniversário! Que o novo ano seja repleto de conquistas. Com carinho, [responsavel]',
 true),

('Lembrete de prazo',
 'tarefa_vencendo_hoje',
 'Lembrete: o prazo para "[processo]" vence hoje, [data]. Por favor, confirme se está tudo encaminhado. [responsavel]',
 true)

ON CONFLICT DO NOTHING;
