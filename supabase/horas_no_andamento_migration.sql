-- Horas no andamento do processo.
-- agenda_items.andamento_id: andamento com tempo gasto cria um item concluído na Agenda ligado a ele.
-- Política de INSERT em agenda_time_entries passa a incluir o estagiário (cada pessoa lança o seu tempo).
-- Aplicada em produção em 08/10/2026 (migration horas_no_andamento).
alter table public.agenda_items
  add column if not exists andamento_id uuid references public.processo_andamentos(id) on delete set null;
create unique index if not exists agenda_items_andamento_uq
  on public.agenda_items (andamento_id) where andamento_id is not null;

drop policy if exists agenda_time_entries_insert_staff on public.agenda_time_entries;
create policy agenda_time_entries_insert_staff on public.agenda_time_entries
  for insert to authenticated
  with check (
    public.current_user_role() in ('estagiario', 'administrativo', 'advogado', 'gerente', 'socio')
    and criado_por = auth.uid()
  );
