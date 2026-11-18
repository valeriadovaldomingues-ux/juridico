-- 18/11/2026 (pedido da Valéria): "Despesas pessoais sócios". Tabela PRÓPRIA (não é financeiro_lancamentos), para
-- nunca entrar nos totais, relatórios nem painéis de despesas do escritório. Só sócio lê, cria, edita e apaga:
-- Célio (liberado por usuário no Financeiro), gerente e demais papéis não enxergam nem por acesso direto ao banco.
-- Para desfazer: drop table public.despesas_pessoais_socios;
create table if not exists public.despesas_pessoais_socios (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid references public.profiles(id) on delete set null,   -- de qual sócio é a despesa (opcional)
  descricao text not null check (length(btrim(descricao)) > 0),
  categoria text not null default 'Geral',
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  pagamento_em date,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  observacoes text,
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists despesas_pessoais_socios_venc_idx on public.despesas_pessoais_socios (vencimento desc);
alter table public.despesas_pessoais_socios enable row level security;
create policy despesas_pessoais_socios_socio on public.despesas_pessoais_socios for all to authenticated
  using (public.current_user_role() = 'socio') with check (public.current_user_role() = 'socio');
