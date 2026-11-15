# Portal do Cliente — qual migração vale

**Vale só:** `portal_cliente_v2_migration.sql` (CPF/CNPJ + código; cliente sem sessão Supabase).
Só aplicar com autorização expressa. Passo a passo de ativação: ver a descrição do PR `feat/portal-cliente-cpf`.

**OBSOLETAS — NÃO APLICAR** (desenho antigo: magic link + sessão Supabase + role `cliente` + RLS). Esse desenho
dá a qualquer JWT `authenticated` acesso às tabelas centrais, porque elas têm a policy
`"Authenticated full access" FOR ALL TO authenticated USING (true)`:

- `portal_clientes_migration.sql`
- `portal_visibility_migration.sql`  (`visivel_cliente` — substituída por `processos.ocultar_portal`)
- `portal_rls_migration.sql`
- `portal_rbac_migration.sql`
- `portal_access_logs_migration.sql`
- `portal_mensagens_migration.sql`   (mensagens ficam fora da v1)
- `portal_storage_migration.sql`     (documentos ficam fora da v1)
- `portal_ai_conversations_migration.sql` (Aurora Cliente fica fora do portal v1)
