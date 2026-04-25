-- ─── Tabela de Feriados ────────────────────────────────────────────────────────
-- Execute no SQL Editor do Supabase antes de usar o cálculo de prazo útil.
--
-- A tabela aceita feriados nacionais (uf IS NULL, tribunal IS NULL),
-- estaduais (uf preenchida) e por tribunal (tribunal preenchido).
-- O sistema filtra por: tribunal específico > UF > nacionais.

create table if not exists feriados (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  descricao   text not null,
  uf          char(2),          -- null = feriado nacional
  tribunal    text,             -- null = não restrito a tribunal
  created_at  timestamptz not null default now(),

  unique (data, coalesce(uf, ''), coalesce(tribunal, ''))
);

-- Índice para buscas por data
create index if not exists feriados_data_idx on feriados (data);

-- RLS: somente leitura para usuários autenticados
alter table feriados enable row level security;

create policy "feriados_select" on feriados
  for select to authenticated using (true);

-- ─── Feriados nacionais 2025 ──────────────────────────────────────────────────

insert into feriados (data, descricao) values
  ('2025-01-01', 'Confraternização Universal'),
  ('2025-04-18', 'Sexta-feira Santa'),
  ('2025-04-20', 'Páscoa'),
  ('2025-04-21', 'Tiradentes'),
  ('2025-05-01', 'Dia do Trabalho'),
  ('2025-06-19', 'Corpus Christi'),
  ('2025-09-07', 'Independência do Brasil'),
  ('2025-10-12', 'Nossa Sra. Aparecida'),
  ('2025-11-02', 'Finados'),
  ('2025-11-15', 'Proclamação da República'),
  ('2025-11-20', 'Dia da Consciência Negra'),
  ('2025-12-25', 'Natal')
on conflict do nothing;

-- ─── Feriados nacionais 2026 ──────────────────────────────────────────────────

insert into feriados (data, descricao) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-05', 'Páscoa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Sra. Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Dia da Consciência Negra'),
  ('2026-12-25', 'Natal')
on conflict do nothing;

-- ─── Exemplos de feriados estaduais (MG) — descomente se necessário ──────────

-- insert into feriados (data, descricao, uf) values
--   ('2026-04-23', 'Data magna MG — São Jorge', 'MG')
-- on conflict do nothing;
