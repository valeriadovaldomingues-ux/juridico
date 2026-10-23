-- 14/10/2026 (pedido da Valéria): Receita Partido mês a mês — ver meses passados, futuros e o ano inteiro.
-- Um registro por cliente da grade e por mês. Sem registro = vale o valor mensal da grade e o status "pendente"
-- (mês atual/futuro) ou "sem registro" (meses passados). O mês atual nasce dos dados que já existiam na grade.
create table if not exists public.grade_pagamento_meses (
  id           uuid primary key default gen_random_uuid(),
  grade_id     uuid not null references public.grade_pagamento_clientes(id) on delete cascade,
  mes          date not null check (extract(day from mes) = 1),
  valor        numeric(12,2),
  status       text not null default 'pendente' check (status in ('pendente', 'pago', 'vencido')),
  observacoes  text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null,
  unique (grade_id, mes)
);
create index if not exists grade_pagamento_meses_mes_idx on public.grade_pagamento_meses (mes);

alter table public.grade_pagamento_meses enable row level security;
create policy grade_pagamento_meses_select on public.grade_pagamento_meses for select to authenticated
  using (public.current_user_role() = any (array['gerente','socio']));
create policy grade_pagamento_meses_insert on public.grade_pagamento_meses for insert to authenticated
  with check (public.current_user_role() = any (array['gerente','socio']));
create policy grade_pagamento_meses_update on public.grade_pagamento_meses for update to authenticated
  using (public.current_user_role() = any (array['gerente','socio']))
  with check (public.current_user_role() = any (array['gerente','socio']));
create policy grade_pagamento_meses_delete on public.grade_pagamento_meses for delete to authenticated
  using (public.current_user_role() = 'socio');

-- Mês atual (outubro/2026) herda o valor e o status que a grade já tinha.
insert into public.grade_pagamento_meses (grade_id, mes, valor, status)
select id, date '2026-10-01', valor_mensal, status from public.grade_pagamento_clientes
on conflict (grade_id, mes) do nothing;
