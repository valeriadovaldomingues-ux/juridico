-- Advogado responsável é SEMPRE a Valéria; "quem cuida do caso" guarda quem toca o processo (já aplicada em produção).
alter table public.processos add column if not exists advogado_caso_id uuid references public.profiles(id) on delete set null;
create index if not exists processos_advogado_caso_idx on public.processos (advogado_caso_id) where advogado_caso_id is not null;
alter table public.processos alter column advogado_responsavel_id set default 'a7eccddf-443a-408d-be21-23a285093fca';
-- Dados: quem era responsável (e não era a Valéria) virou "quem cuida"; a Valéria virou responsável de todos.
-- Backup: processos_backup_responsavel_20261023 (id, advogado_responsavel_id, advogado_caso_id).
