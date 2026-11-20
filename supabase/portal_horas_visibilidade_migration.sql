-- ============================================================================
-- Portal do cliente — chave "mostrar horas" por cliente
-- ============================================================================
-- O que faz: 1 coluna nova em portal_acessos (mostrar_horas boolean NOT NULL DEFAULT true).
--   true  = o cliente vê a aba Horas e baixa o relatório de horas (comportamento atual de todos).
--   false = a aba some do menu, a página responde 404 e o PDF de horas é recusado.
-- O que NÃO faz: nenhum DROP, nenhuma mudança de policy/RLS; os clientes já liberados continuam vendo as horas.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

ALTER TABLE public.portal_acessos
  ADD COLUMN IF NOT EXISTS mostrar_horas boolean NOT NULL DEFAULT true;
