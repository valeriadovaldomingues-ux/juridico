-- ============================================================
-- RLS na tabela profiles
-- ============================================================
-- Regras:
--   SELECT  → próprio perfil  OU  sócio (vê todos)
--   UPDATE  → próprio perfil  OU  sócio (atualiza qualquer um)
--   INSERT  → bloqueado para usuários autenticados
--             (o trigger handle_new_user é SECURITY DEFINER e ignora RLS)
--   DELETE  → bloqueado para usuários autenticados (service_role apenas)
-- ============================================================

-- 1. Garante que RLS está ativo
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remove todas as políticas antigas
DROP POLICY IF EXISTS "Authenticated full access"  ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy"     ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy"     ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"     ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy"     ON profiles;

-- 3. Função auxiliar SECURITY DEFINER para evitar recursão circular
--    Sem esta função, uma policy que consulta profiles para checar role
--    causaria loop infinito (a policy chamaria a si mesma).
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. SELECT: próprio perfil OU sócio
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR current_user_role() = 'socio'
  );

-- 5. UPDATE: próprio perfil OU sócio
--    USING  → quais linhas podem ser alvo
--    WITH CHECK → quais valores são permitidos após a mudança
CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR current_user_role() = 'socio'
  )
  WITH CHECK (
    id = auth.uid()
    OR current_user_role() = 'socio'
  );

-- 6. INSERT: nenhuma policy criada para authenticated
--    O trigger handle_new_user é SECURITY DEFINER — bypassa RLS automaticamente.
--    Usuários autenticados não conseguem inserir diretamente.

-- 7. DELETE: nenhuma policy criada para authenticated
--    Apenas service_role (backend) pode deletar.

-- ── Confirmação ─────────────────────────────────────────────
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
