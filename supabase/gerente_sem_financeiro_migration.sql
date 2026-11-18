-- 18/11/2026 (pedido da Valéria): o financeiro inteiro é só dos sócios (Valéria e Cristiano); o gerente não vê nada. O código já barrava as telas (/financeiro é só do
-- sócio); esta migração fecha o mesmo no banco, para não sobrar leitura por acesso direto. Passa a valer só para o sócio
-- (mais o Célio, liberado por usuário, apenas despesas e salários, como já era). Para desfazer: recriar as políticas com 'gerente'.

drop policy if exists financeiro_lancamentos_select_role on public.financeiro_lancamentos;
create policy financeiro_lancamentos_select_role on public.financeiro_lancamentos for select to authenticated
  using (public.current_user_role() = 'socio' or (public.financeiro_usuario_liberado() and tipo = 'despesa'));

-- Receita Partido (grade de pagamento)
drop policy if exists grade_pagamento_clientes_select on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_select on public.grade_pagamento_clientes for select to authenticated
  using (public.current_user_role() = 'socio');
drop policy if exists grade_pagamento_clientes_insert on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_insert on public.grade_pagamento_clientes for insert to authenticated
  with check (public.current_user_role() = 'socio');
drop policy if exists grade_pagamento_clientes_update on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_update on public.grade_pagamento_clientes for update to authenticated
  using (public.current_user_role() = 'socio') with check (public.current_user_role() = 'socio');
drop policy if exists grade_pagamento_clientes_delete on public.grade_pagamento_clientes;
create policy grade_pagamento_clientes_delete on public.grade_pagamento_clientes for delete to authenticated
  using (public.current_user_role() = 'socio');

drop policy if exists grade_pagamento_meses_select on public.grade_pagamento_meses;
create policy grade_pagamento_meses_select on public.grade_pagamento_meses for select to authenticated
  using (public.current_user_role() = 'socio');
drop policy if exists grade_pagamento_meses_insert on public.grade_pagamento_meses;
create policy grade_pagamento_meses_insert on public.grade_pagamento_meses for insert to authenticated
  with check (public.current_user_role() = 'socio');
drop policy if exists grade_pagamento_meses_update on public.grade_pagamento_meses;
create policy grade_pagamento_meses_update on public.grade_pagamento_meses for update to authenticated
  using (public.current_user_role() = 'socio') with check (public.current_user_role() = 'socio');

-- Cobranças (Inter): histórico e eventos passam a ser só do sócio, como a própria tabela cobrancas já era.
drop policy if exists cobranca_eventos_select_financeiro on public.cobranca_eventos;
create policy cobranca_eventos_select_financeiro on public.cobranca_eventos for select to authenticated
  using (public.current_user_role() = 'socio');
drop policy if exists cobranca_logs_select_financeiro on public.cobranca_logs;
create policy cobranca_logs_select_financeiro on public.cobranca_logs for select to authenticated
  using (public.current_user_role() = 'socio');
