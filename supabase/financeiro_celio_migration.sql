-- 13/10/2026 (pedido da Valéria): Célio passa a ter a aba Financeiro (receitas + despesas + grade de pagamento:
-- ver e lançar/editar). SEM: apagar lançamentos, salários/folha e cobranças. Antes: só despesas. Aplicada em produção.
create or replace function public.financeiro_usuario_liberado()
returns boolean language sql stable set search_path = public
as $$ select auth.uid() = any (array['3baf1f52-4950-4a1e-937a-126ce0fa1e34']::uuid[]) $$;  -- Célio Costa
grant execute on function public.financeiro_usuario_liberado() to authenticated;

drop policy if exists financeiro_lancamentos_select_role on public.financeiro_lancamentos;
create policy financeiro_lancamentos_select_role on public.financeiro_lancamentos for select to authenticated
  using (public.current_user_role() = any (array['gerente','socio']) or public.financeiro_usuario_liberado());
drop policy if exists financeiro_lancamentos_insert_socio on public.financeiro_lancamentos;
create policy financeiro_lancamentos_insert_socio on public.financeiro_lancamentos for insert to authenticated
  with check (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado());
drop policy if exists financeiro_lancamentos_update_socio on public.financeiro_lancamentos;
create policy financeiro_lancamentos_update_socio on public.financeiro_lancamentos for update to authenticated
  using (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado())
  with check (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado());

drop policy if exists grade_pagamento_clientes_select on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_select on public.grade_pagamento_clientes for select to authenticated
  using (public.current_user_role() = any (array['gerente','socio']) or public.financeiro_usuario_liberado());
drop policy if exists grade_pagamento_clientes_write on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_insert on public.grade_pagamento_clientes for insert to authenticated
  with check (public.current_user_role() = any (array['gerente','socio']) or public.financeiro_usuario_liberado());
create policy grade_pagamento_clientes_update on public.grade_pagamento_clientes for update to authenticated
  using (public.current_user_role() = any (array['gerente','socio']) or public.financeiro_usuario_liberado())
  with check (public.current_user_role() = any (array['gerente','socio']) or public.financeiro_usuario_liberado());
create policy grade_pagamento_clientes_delete on public.grade_pagamento_clientes for delete to authenticated
  using (public.current_user_role() = any (array['gerente','socio']));
