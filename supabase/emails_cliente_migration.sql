-- Histórico de e-mails enviados aos clientes pelo sistema (PEDV Cliente). Aplicada em produção em 13/10/2026.
-- O rascunho não é guardado: é refeito a partir dos dados da ata/agenda.
create table if not exists public.emails_cliente (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('ata', 'audiencia', 'lembrete', 'andamento')),
  processo_id     uuid references public.processos(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  ata_id          uuid references public.atas_audiencia(id) on delete set null,
  agenda_item_id  uuid references public.agenda_items(id) on delete set null,
  para            text[] not null,
  cc              text[] not null default '{}',
  assunto         text not null,
  corpo           text not null,
  anexos          jsonb not null default '[]'::jsonb,
  status          text not null check (status in ('enviado', 'erro')),
  erro            text,
  message_id      text,
  enviado_por     uuid references public.profiles(id) on delete set null,
  enviado_em      timestamptz not null default now()
);
create index if not exists emails_cliente_processo_idx on public.emails_cliente (processo_id, enviado_em desc);
create index if not exists emails_cliente_ata_idx on public.emails_cliente (ata_id) where ata_id is not null;
alter table public.emails_cliente enable row level security;
create policy emails_cliente_select_staff on public.emails_cliente
  for select to authenticated
  using (public.current_user_role() in ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio'));
create policy emails_cliente_insert_staff on public.emails_cliente
  for insert to authenticated
  with check (public.current_user_role() in ('administrativo', 'advogado', 'gerente', 'socio') and enviado_por = auth.uid());
