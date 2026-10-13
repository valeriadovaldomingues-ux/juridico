-- 13/10/2026: rastreio de importações e conta contábil nas despesas. Aplicada em produção.
-- Importação feita nesse dia: 243 despesas de jan–set/2026 da "Planilha de lançamentos contábeis MODELO – 2026"
-- (origem = 'planilha-contabil-2026'; soma por mês confere com o relatório do contador). Para desfazer:
--   delete from public.financeiro_lancamentos where origem = 'planilha-contabil-2026';
alter table public.financeiro_lancamentos
  add column if not exists origem text,
  add column if not exists conta_contabil text;
create index if not exists financeiro_lancamentos_origem_idx on public.financeiro_lancamentos (origem) where origem is not null;
