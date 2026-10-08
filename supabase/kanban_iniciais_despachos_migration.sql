-- Iniciais e Despachos no Kanban
--
-- categoria  : marca o card como 'inicial' (petição inicial repassada a alguém) ou
--              'despacho' (processo a despachar com o juiz). NULL = tarefa comum.
-- criado_por : quem cadastrou (ex.: o Cristiano ao repassar uma inicial).
--
-- Aplicada em produção em 08/10/2026 (migration kanban_tasks_categoria_inicial_despacho).

alter table public.kanban_tasks
  add column if not exists categoria text check (categoria in ('inicial', 'despacho')),
  add column if not exists criado_por uuid references public.profiles(id) on delete set null;

create index if not exists kanban_tasks_categoria_idx
  on public.kanban_tasks (categoria) where categoria is not null;
