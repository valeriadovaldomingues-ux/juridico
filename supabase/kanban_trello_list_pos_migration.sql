-- Posição da lista do Trello em cada card sincronizado, para o quadro do escritório
-- seguir a mesma ordem de colunas do Trello. A sincronização mantém o valor.
-- Aplicada em produção em 08/10/2026 (migration kanban_tasks_trello_list_pos), com
-- backfill dos cards existentes a partir das posições do quadro "Escritório - Todos colaboradores".
alter table public.kanban_tasks add column if not exists trello_list_pos double precision;
