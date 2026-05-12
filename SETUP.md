# Checklist de Configuração - Sistema Jurídico PEDV

Use este checklist para garantir que tudo está configurado corretamente.

## Ambiente Local

### 1. Dependências
- [ ] Node.js 20+ instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] Git instalado (`git --version`)
- [ ] Dependências do projeto instaladas (`npm install`)

### 2. Variáveis de Ambiente
- [ ] Arquivo `.env.local` criado na raiz
- [ ] `NEXT_PUBLIC_SUPABASE_URL` preenchida
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` preenchida
- [ ] `SUPABASE_SERVICE_ROLE_KEY` preenchida (sem NEXT_PUBLIC_!)
- [ ] `NEXT_PUBLIC_APP_URL` configurada (`http://localhost:3000`)
- [ ] `OPENAI_API_KEY` preenchida (se usar IA)
- [ ] `OPENAI_MODEL` configurado (`gpt-4o-mini`)
- [ ] `CRON_SECRET` gerado e preenchido

### 3. Supabase - Projeto
- [ ] Projeto criado no Supabase
- [ ] Copiado URL do projeto
- [ ] Copiado anon key
- [ ] Copiado service role key

### 4. Supabase - Autenticação
- [ ] Site URL configurado em Authentication → URL Configuration
- [ ] Redirect URLs adicionadas:
  - [ ] `http://localhost:3000/**`
  - [ ] `http://localhost:3000/auth/callback`
- [ ] Email auth habilitado (padrão)

### 5. Supabase - Banco de Dados
Executar no SQL Editor (nesta ordem):

- [ ] `supabase/schema.sql`
- [ ] `supabase/auth_setup.sql`
- [ ] `supabase/profiles_rls_migration.sql`
- [ ] `supabase/rbac_migration.sql`
- [ ] `supabase/pessoas_migracao.sql`
- [ ] `supabase/clientes_crm_migration.sql`
- [ ] `supabase/kanban_migration.sql`
- [ ] `supabase/kanban_v2_migration.sql`
- [ ] `supabase/kanban_import_logs.sql`
- [ ] `supabase/kanban_historico_v2.sql`
- [ ] `supabase/kanban_sla_simple_migration.sql`
- [ ] `supabase/agenda_migration.sql`
- [ ] `supabase/agenda_import_migration.sql`
- [ ] `supabase/agenda_kanban_sync_migration.sql`
- [ ] `supabase/calendar_events_migration.sql`
- [ ] `supabase/publicacoes_migration.sql`
- [ ] `supabase/documentos_migration.sql`
- [ ] `supabase/ia_analises_migration.sql`
- [ ] `supabase/comercial_migration.sql`
- [ ] `supabase/automacoes_migration.sql`
- [ ] `supabase/automacoes_v2_migration.sql`
- [ ] `supabase/monitoramento_migration.sql`
- [ ] `supabase/aniversarios_migration.sql`
- [ ] `supabase/feriados_migration.sql`
- [ ] `supabase/trello_integration_migration.sql`
- [ ] `supabase/clientes_campos_relatorio.sql`
- [ ] `supabase/dashboard_produtividade_fn.sql`

### 6. Build e Testes
- [ ] `npm run type-check` passa sem erros
- [ ] `npm run build` passa sem erros
- [ ] `npm run dev` inicia sem erros
- [ ] Abre http://localhost:3000 no navegador
- [ ] Página de login aparece
- [ ] Consegue fazer login (ou criar primeiro usuário)

### 7. OpenAI (Opcional - apenas se usar IA Jurídica)
- [ ] Conta criada em https://platform.openai.com
- [ ] API key gerada
- [ ] API key adicionada no `.env.local`
- [ ] Créditos disponíveis na conta OpenAI

## Testes Funcionais

Após tudo configurado, teste:

### Autenticação
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Sessão persiste ao recarregar página
- [ ] Reset de senha envia email

### Dashboard
- [ ] Dashboard carrega
- [ ] Sidebar aparece corretamente
- [ ] Header mostra nome do usuário

### Kanban
- [ ] Página do Kanban carrega
- [ ] Consegue criar tarefa
- [ ] Drag and drop funciona
- [ ] Consegue importar CSV do Trello

### Clientes
- [ ] Lista de clientes carrega
- [ ] Consegue adicionar cliente
- [ ] Busca funciona

### Agenda
- [ ] Calendário carrega
- [ ] Consegue adicionar compromisso
- [ ] Compromissos aparecem no calendário

### IA Jurídica (se configurada)
- [ ] Campo de pergunta aparece
- [ ] Consegue fazer uma pergunta teste
- [ ] Resposta é gerada

## Problemas Comuns

### "Cannot find module '@/...'"
- Execute: `npm install`

### "Supabase client not initialized"
- Verifique `.env.local`
- Confirme que as variáveis estão corretas

### "Invalid API key"
- Confirme OpenAI API key no `.env.local`
- Verifique se tem créditos na conta OpenAI

### Build falha com erros TypeScript
- Execute: `npm run type-check`
- Corrija os erros apontados

### Nenhum usuário consegue fazer login
- Execute migrations de autenticação
- Crie primeiro usuário via Supabase Dashboard → Authentication → Users

## Configuração Completa!

Se todos os itens acima estão marcados, seu ambiente está pronto para desenvolvimento!

Próximos passos:
1. Criar primeiro usuário administrador
2. Configurar permissões de acesso
3. Importar dados iniciais (se tiver)
4. Começar a usar o sistema!
