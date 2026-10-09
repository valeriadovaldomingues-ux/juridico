-- Reuniões PEDV: atas das reuniões internas + tarefas viram cards do Kanban.
-- Aplicada em produção em 08/10/2026 (migration reunioes_pedv).
create table if not exists public.reunioes_pedv (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  data_reuniao  date not null,
  participantes text[] not null default '{}',
  ata           text not null,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists reunioes_pedv_data_idx on public.reunioes_pedv (data_reuniao desc);
alter table public.reunioes_pedv enable row level security;

create policy reunioes_pedv_select_staff on public.reunioes_pedv
  for select to authenticated
  using (public.current_user_role() in ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio'));
create policy reunioes_pedv_insert_staff on public.reunioes_pedv
  for insert to authenticated
  with check (public.current_user_role() in ('administrativo', 'advogado', 'gerente', 'socio') and criado_por = auth.uid());
create policy reunioes_pedv_update_staff on public.reunioes_pedv
  for update to authenticated
  using (public.current_user_role() in ('gerente', 'socio') or criado_por = auth.uid())
  with check (public.current_user_role() in ('gerente', 'socio') or criado_por = auth.uid());
create policy reunioes_pedv_delete_socio on public.reunioes_pedv
  for delete to authenticated
  using (public.current_user_role() in ('gerente', 'socio'));

alter table public.kanban_tasks
  add column if not exists reuniao_id uuid references public.reunioes_pedv(id) on delete set null;
create index if not exists kanban_tasks_reuniao_idx on public.kanban_tasks (reuniao_id) where reuniao_id is not null;
