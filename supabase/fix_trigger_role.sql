-- ============================================================
-- PEDV — Fix: trigger handle_new_user + constraint de roles
-- Execute no Supabase SQL Editor (uma única vez)
--
-- Problema corrigido:
--   O trigger original (schema.sql) não gravava o campo `role`
--   no profile, e a constraint aceitava apenas roles legados
--   ('admin', 'advogado', 'secretaria'). Isso fazia com que
--   qualquer role novo (comercial, estagiario, gerente, socio)
--   fosse rejeitado silenciosamente no endpoint de criação.
-- ============================================================

-- 1. Atualizar constraint de roles para os 6 perfis atuais
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

-- 2. Substituir o trigger para incluir `role` dos metadados do usuário
--    COALESCE garante fallback para 'advogado' se o campo não vier no metadata.
--    ON CONFLICT (id) DO NOTHING evita erro se o profile já existir.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'advogado')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recriar o trigger (garante que a nova função está ativa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Corrigir profiles existentes com roles legados
UPDATE public.profiles SET role = 'socio'          WHERE role = 'admin';
UPDATE public.profiles SET role = 'administrativo' WHERE role = 'secretaria';

-- 5. Índices (idempotentes)
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- 6. Confirmação
SELECT
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;

SELECT
  conname  AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'c';
