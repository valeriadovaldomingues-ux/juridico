-- ============================================================
-- PEDV — Configuração completa de autenticação e perfis
-- Execute no Supabase SQL Editor (uma única vez)
-- ============================================================

-- Papéis válidos: estagiario | comercial | administrativo | advogado | gerente | socio
-- ── 1. Tabela profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'advogado',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles válidos
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

-- Migrar roles legados (caso existam)
UPDATE public.profiles SET role = 'socio'          WHERE role = 'admin';
UPDATE public.profiles SET role = 'administrativo' WHERE role = 'secretaria';

-- ── 2. Índices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- ── 3. Trigger: cria profile automaticamente ao criar usuário ──
--    O role pode ser passado via raw_user_meta_data->>'role'
--    ao criar o usuário pela API de admin. Padrão: 'advogado'.
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Row Level Security ────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas
DROP POLICY IF EXISTS "Authenticated full access" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy"    ON profiles;

-- Função auxiliar para evitar recursão circular nas policies
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- SELECT: próprio perfil ou sócio vê todos
CREATE POLICY "profiles_select_policy"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR current_user_role() = 'socio');

-- UPDATE: próprio perfil ou sócio atualiza qualquer um
CREATE POLICY "profiles_update_policy"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR current_user_role() = 'socio')
  WITH CHECK (id = auth.uid() OR current_user_role() = 'socio');

-- INSERT/DELETE: apenas via trigger (SECURITY DEFINER) ou service_role

-- ── 5. Confirmação ───────────────────────────────────────────
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd;
