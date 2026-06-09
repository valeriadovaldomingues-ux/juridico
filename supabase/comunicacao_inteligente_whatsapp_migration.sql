ALTER TABLE public.comunicacoes_inteligentes DROP CONSTRAINT IF EXISTS comunicacoes_inteligentes_status_check;
ALTER TABLE public.comunicacoes_inteligentes
  ADD CONSTRAINT comunicacoes_inteligentes_status_check
  CHECK (status IN ('pendente_aprovacao', 'em_edicao', 'aprovada', 'enviada', 'enviada_manual_whatsapp', 'descartada'));

ALTER TABLE public.comunicacoes_inteligentes_logs DROP CONSTRAINT IF EXISTS comunicacoes_inteligentes_logs_acao_check;
ALTER TABLE public.comunicacoes_inteligentes_logs
  ADD CONSTRAINT comunicacoes_inteligentes_logs_acao_check
  CHECK (acao IN ('gerada', 'editada', 'aprovada', 'enviada', 'enviada_manual_whatsapp', 'whatsapp_iniciado', 'whatsapp_confirmado', 'descartada'));
