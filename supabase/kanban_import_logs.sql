-- =============================================
-- Kanban Import Logs
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================

create table if not exists public.kanban_import_logs (
  id              uuid        primary key default gen_random_uuid(),
  import_batch_id text        not null,
  usuario_id      uuid        references public.profiles(id) on delete set null,
  arquivo_nome    text        not null default 'desconhecido',
  total_linhas    int         not null default 0,
  importados      int         not null default 0,
  atualizados     int         not null default 0,
  ignorados       int         not null default 0,
  rejeitados      int         not null default 0,
  erros           int         not null default 0,
  detalhes        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists kanban_import_logs_usuario_idx
  on public.kanban_import_logs(usuario_id);

create index if not exists kanban_import_logs_batch_idx
  on public.kanban_import_logs(import_batch_id);

create index if not exists kanban_import_logs_created_idx
  on public.kanban_import_logs(created_at desc);

alter table public.kanban_import_logs enable row level security;

-- Apenas gerente e sócio podem ler os logs
create policy "gerente_socio_can_read_import_logs"
  on public.kanban_import_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('gerente', 'socio')
        and profiles.ativo = true
    )
  );

-- Apenas gerente e sócio podem inserir (API já valida, mas dupla proteção)
create policy "gerente_socio_can_insert_import_logs"
  on public.kanban_import_logs for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('gerente', 'socio')
        and profiles.ativo = true
    )
  );
