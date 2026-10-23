-- Reuniões PEDV: atas das reuniões internas + tarefas viram cards do Kanban.
-- Aplicada em produção em 08/10/2026 (migrations reunioes_pedv e reunioes_pedv_atas_imutaveis).
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
-- Atas são registros fixos: sem política de UPDATE/DELETE + trava no banco (vale até para sócio/admin).
create or replace function public.reunioes_pedv_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Atas de reunião não podem ser apagadas.';
  end if;
  -- Único ajuste permitido: criado_por virar nulo se a pessoa for removida do sistema (ON DELETE SET NULL).
  if (new.id, new.titulo, new.data_reuniao, new.participantes, new.ata, new.created_at)
     is distinct from
     (old.id, old.titulo, old.data_reuniao, old.participantes, old.ata, old.created_at) then
    raise exception 'Atas de reunião não podem ser alteradas depois de salvas.';
  end if;
  return new;
end;
$$;

drop trigger if exists reunioes_pedv_imutavel_trg on public.reunioes_pedv;
create trigger reunioes_pedv_imutavel_trg
  before update or delete on public.reunioes_pedv
  for each row execute function public.reunioes_pedv_imutavel();

alter table public.kanban_tasks
  add column if not exists reuniao_id uuid references public.reunioes_pedv(id) on delete set null;
create index if not exists kanban_tasks_reuniao_idx on public.kanban_tasks (reuniao_id) where reuniao_id is not null;

-- 09/10/2026: o arquivo original da ata (Word/PDF) fica guardado e todos podem baixar.
alter table public.reunioes_pedv
  add column if not exists arquivo_path text,
  add column if not exists arquivo_nome text;
-- (o trigger reunioes_pedv_imutavel passou a incluir arquivo_path/arquivo_nome na comparação)
