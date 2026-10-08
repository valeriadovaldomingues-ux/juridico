-- Posição de cada lista no Trello (preenchida pela sincronização): permite mostrar as
-- colunas do Kanban na ordem do Trello, inclusive listas vazias (ex.: CONCLUÍDOS).
-- Aplicada em produção em 08/10/2026 (migration trello_list_mappings_posicao), com backfill.
alter table public.trello_list_mappings add column if not exists posicao double precision;
