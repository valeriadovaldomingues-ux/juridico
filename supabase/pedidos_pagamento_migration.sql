-- 13/10/2026 — Pedidos a pagar (OK do sócio vira despesa) + forma de pagamento nas despesas. Aplicada em produção.
create table if not exists public.pedidos_pagamento (
  id uuid primary key default gen_random_uuid(),
  descricao text not null, fornecedor text, categoria text not null default 'Geral', centro_custo text,
  valor numeric(12,2) not null check (valor > 0), vencimento date not null, observacoes text,
  status text not null default 'aguardando_ok' check (status in ('aguardando_ok','aprovado','recusado')),
  solicitado_por uuid references public.profiles(id) on delete set null, solicitado_por_nome text,
  solicitado_em timestamptz not null default now(),
  decidido_por uuid references public.profiles(id) on delete set null, decidido_por_nome text, decidido_em timestamptz,
  motivo_recusa text,
  lancamento_id uuid references public.financeiro_lancamentos(id) on delete set null,
  forma_pagamento text check (forma_pagamento in ('credito','debito','debito_conta','boleto','pix','transferencia','dinheiro')),
  parcelas_total smallint check (parcelas_total between 1 and 60),
  parcela_atual smallint check (parcela_atual >= 1),
  constraint pedidos_pagamento_parcela_ok check (parcela_atual is null or (parcelas_total is not null and parcela_atual <= parcelas_total))
);
create index if not exists pedidos_pagamento_status_idx on public.pedidos_pagamento (status, vencimento);
alter table public.pedidos_pagamento enable row level security;
-- Só Cristiano e Valéria (sócios) e Célio (liberado) veem e cadastram; só sócio decide; ninguém apaga.
create policy pedidos_pagamento_select on public.pedidos_pagamento for select to authenticated
  using (public.current_user_role() = 'socio' or public.financeiro_usuario_liberado());
create policy pedidos_pagamento_insert on public.pedidos_pagamento for insert to authenticated
  with check ((public.current_user_role() = 'socio' or public.financeiro_usuario_liberado()) and solicitado_por = auth.uid());
create policy pedidos_pagamento_update_socio on public.pedidos_pagamento for update to authenticated
  using (public.current_user_role() = 'socio') with check (public.current_user_role() = 'socio');

alter table public.financeiro_lancamentos
  add column if not exists forma_pagamento text check (forma_pagamento in ('credito','debito','debito_conta','boleto','pix','transferencia','dinheiro')),
  add column if not exists parcelas_total smallint check (parcelas_total between 1 and 60),
  add column if not exists parcela_atual smallint check (parcela_atual >= 1),
  add column if not exists parcelamento_id uuid;
alter table public.financeiro_lancamentos add constraint financeiro_lancamentos_parcela_ok
  check (parcela_atual is null or (parcelas_total is not null and parcela_atual <= parcelas_total));
create index if not exists financeiro_lancamentos_parcelamento_idx on public.financeiro_lancamentos (parcelamento_id) where parcelamento_id is not null;
