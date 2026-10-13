-- 13/10/2026 (ajuste do pedido da Valéria): Célio vê Salários (folha de pagamento) e DESPESAS; SEM receitas
-- (Receita Partido/grade, Receitas Extras, A Receber, Lançamentos, Relatórios). Sobrescreve financeiro_celio_migration.sql
-- nas políticas de financeiro_lancamentos e grade_pagamento_clientes. Aplicada em produção.
drop policy if exists financeiro_lancamentos_select_role on public.financeiro_lancamentos;
create policy financeiro_lancamentos_select_role on public.financeiro_lancamentos for select to authenticated
  using (public.current_user_role() = any (array['gerente','socio']) or (public.financeiro_usuario_liberado() and tipo = 'despesa'));
drop policy if exists financeiro_lancamentos_insert_socio on public.financeiro_lancamentos;
create policy financeiro_lancamentos_insert_socio on public.financeiro_lancamentos for insert to authenticated
  with check (public.current_user_role() = 'socio' or (public.financeiro_usuario_liberado() and tipo = 'despesa'));
drop policy if exists financeiro_lancamentos_update_socio on public.financeiro_lancamentos;
create policy financeiro_lancamentos_update_socio on public.financeiro_lancamentos for update to authenticated
  using (public.current_user_role() = 'socio' or (public.financeiro_usuario_liberado() and tipo = 'despesa'))
  with check (public.current_user_role() = 'socio' or (public.financeiro_usuario_liberado() and tipo = 'despesa'));

drop policy if exists grade_pagamento_clientes_select on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_select on public.grade_pagamento_clientes for select to authenticated
  using (public.current_user_role() = any (array['gerente','socio']));
drop policy if exists grade_pagamento_clientes_insert on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_insert on public.grade_pagamento_clientes for insert to authenticated
  with check (public.current_user_role() = any (array['gerente','socio']));
drop policy if exists grade_pagamento_clientes_update on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_update on public.grade_pagamento_clientes for update to authenticated
  using (public.current_user_role() = any (array['gerente','socio']))
  with check (public.current_user_role() = any (array['gerente','socio']));

drop policy if exists folha_pagamento_socio on public.folha_pagamento;
create policy folha_pagamento_socio on public.folha_pagamento for all to authenticated
  using (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado())
  with check (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado());
drop policy if exists funcionarios_dados_pessoais_socio on public.funcionarios_dados_pessoais;
create policy funcionarios_dados_pessoais_socio on public.funcionarios_dados_pessoais for all to authenticated
  using (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado())
  with check (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado());
