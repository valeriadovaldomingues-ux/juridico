-- 13/10/2026: andamentos do escritório nos processos do INPI + contagem de prorrogações (decênios) já concedidas.
-- Vigência = 10 anos da concessão + 10 anos por prorrogação deferida (confere com a tela do INPI).
alter table public.inpi_processos
  add column if not exists prorrogacoes smallint not null default 0 check (prorrogacoes >= 0);

create table if not exists public.inpi_andamentos (
  id               uuid primary key default gen_random_uuid(),
  inpi_processo_id uuid not null references public.inpi_processos(id) on delete cascade,
  data_andamento   date not null,
  tipo             text not null check (tipo in ('peticao', 'exigencia', 'taxa', 'cliente', 'prorrogacao', 'observacao', 'outro')),
  titulo           text not null,
  descricao        text,
  protocolo        text,
  prorrogacao_deferida boolean not null default false,
  responsavel_id   uuid references public.profiles(id) on delete set null,
  responsavel_nome text,
  criado_por       uuid references public.profiles(id) on delete set null,
  criado_por_nome  text,
  created_at       timestamptz not null default now()
);
create index if not exists inpi_andamentos_processo_idx on public.inpi_andamentos (inpi_processo_id, data_andamento desc);
alter table public.inpi_andamentos enable row level security;
create policy inpi_andamentos_select_staff on public.inpi_andamentos
  for select to authenticated
  using (public.current_user_role() in ('estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'));
create policy inpi_andamentos_insert_staff on public.inpi_andamentos
  for insert to authenticated
  with check (public.current_user_role() in ('administrativo', 'advogado', 'gerente', 'socio') and criado_por = auth.uid());
create policy inpi_andamentos_delete_socio on public.inpi_andamentos
  for delete to authenticated
  using (public.current_user_role() = 'socio');
