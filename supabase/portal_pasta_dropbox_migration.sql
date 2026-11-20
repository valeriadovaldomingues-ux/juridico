-- ============================================================================
-- Portal do cliente — link da pasta do Dropbox de cada cliente
-- ============================================================================
-- O que faz: 1 coluna nova (nullable) em portal_acessos: pasta_dropbox_url.
--   O sócio cola, na ficha do cliente, o link compartilhado da pasta dele no Dropbox; o portal mostra o botão
--   "Abrir minha pasta" só para o próprio cliente logado.
-- O que NÃO faz: nenhum DROP, nenhuma mudança em tabela/policy existente. Sem coluna = o portal simplesmente não
--   mostra o cartão (o código tolera a ausência).
-- Segurança: portal_acessos já tem RLS ligado, sem policy e sem grant para anon/authenticated — só o servidor lê/grava.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

ALTER TABLE public.portal_acessos
  ADD COLUMN IF NOT EXISTS pasta_dropbox_url text;
