-- Atas de audiência (PEDV Cliente, fase 1): a ata entra no processo, a IA separa as
-- obrigações do cliente e as tarefas do escritório; tudo vai para a Agenda/Kanban.
-- obrigacoes_cliente alimentará o e-mail ao cliente (fase 2).
create table if not exists public.atas_audiencia (
  id                  uuid primary key default gen_random_uuid(),
  processo_id         uuid not null references public.processos(id) on delete cascade,
  andamento_id        uuid references public.processo_andamentos(id) on delete set null,
  data_audiencia      date not null,
  texto               text not null,
  resumo              text,
  arquivo_path        text,
  arquivo_nome        text,
  obrigacoes_cliente  jsonb not null default '[]'::jsonb,
  criado_por          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists atas_audiencia_processo_idx on public.atas_audiencia (processo_id, data_audiencia desc);
alter table public.atas_audiencia enable row level security;

create policy atas_audiencia_select_staff on public.atas_audiencia
  for select to authenticated
  using (public.current_user_role() in ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio'));
create policy atas_audiencia_insert_staff on public.atas_audiencia
  for insert to authenticated
  with check (public.current_user_role() in ('administrativo', 'advogado', 'gerente', 'socio') and criado_por = auth.uid());

alter table public.agenda_items
  add column if not exists ata_id uuid references public.atas_audiencia(id) on delete set null;
create index if not exists agenda_items_ata_idx on public.agenda_items (ata_id) where ata_id is not null;
