-- ─────────────────────────────────────────────────────────────────────────────
-- Publicação vira andamento do processo e tarefa no Kanban
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Quase tudo de que este recurso precisa JÁ EXISTE no banco. Antes de escrever
-- esta migration foram conferidos, um a um:
--
--   publicacoes.data_disponibilizacao  → existe e é preenchida por persistencia.ts
--   publicacoes.url_oficial            → existe (djen_monitoramento_migration)
--   publicacoes.origem CHECK           → já aceita as fontes DJEN (idem)
--   kanban_tasks.publicacao_id + FK    → existe (kanban_v2_migration linha 38)
--   kanban_tasks.origem CHECK          → já aceita 'publicacao' (automacoes_v2)
--   processo_andamentos.tipo/origem    → já aceitam 'publicacao'
--
-- Sobram duas coisas, e só elas estão aqui.
--
-- Idempotente: pode rodar mais de uma vez.

-- ── 1. Uma publicação gera no máximo UMA tarefa ──────────────────────────────
--
-- Já existe índice em publicacao_id, mas não-único. Sem unicidade, duas
-- execuções concorrentes do cron (ou uma reexecução manual no meio da
-- automática) criam duas tarefas para a mesma publicação. O índice único
-- transforma essa corrida em erro de chave duplicada, que o código trata como
-- "já existe" em vez de duplicar — mesma estratégia que persistencia.ts usa
-- para as publicações.

CREATE UNIQUE INDEX IF NOT EXISTS uq_kanban_tasks_publicacao
  ON public.kanban_tasks (publicacao_id)
  WHERE publicacao_id IS NOT NULL;

-- ── 2. Papel 'sistema' para o Robô ───────────────────────────────────────────
--
-- processo_andamentos.criado_por é NOT NULL e referencia profiles. O
-- monitoramento roda por cron, sem usuário logado, então precisa de um perfil
-- que assine esses registros.
--
-- Papel próprio, e não 'advogado': a matriz de permissões (lib/permissions.ts)
-- e o KANBAN_ONLY_MODE leem profiles.role. Um robô com papel de advogado teria
-- as permissões de um advogado — inclusive as telas que o modo restrito hoje
-- bloqueia para quem não é sócio.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('estagiario', 'comercial', 'administrativo',
                  'advogado', 'gerente', 'socio', 'sistema'));

COMMENT ON CONSTRAINT profiles_role_check ON public.profiles IS
  'O papel "sistema" existe para contas de automação (o Robô), que assinam '
  'andamentos e tarefas criados sem usuário logado. Não deve receber permissão '
  'de tela em lib/permissions.ts.';

-- ── Depois de aplicar ────────────────────────────────────────────────────────
--
-- O perfil do Robô precisa de um usuário em auth.users, que só é criado pelo
-- painel do Supabase (Authentication → Add user). Feito isso, ligar o perfil:
--
--   INSERT INTO public.profiles (id, nome, email, role, ativo)
--   VALUES ('<uuid-do-usuario>', 'Robô', 'robo@pessoaedoval.com.br', 'sistema', true)
--   ON CONFLICT (id) DO UPDATE
--     SET nome = EXCLUDED.nome, role = EXCLUDED.role, ativo = true;
--
-- E informar o mesmo uuid em ROBO_PROFILE_ID nas variáveis de ambiente.
