-- =============================================
-- RBAC Migration — Novos papéis de usuário
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Remover constraint antiga e criar nova com os novos roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'));

-- 2. Migrar roles legados para os novos equivalentes
UPDATE public.profiles SET role = 'socio'          WHERE role = 'admin';
UPDATE public.profiles SET role = 'administrativo' WHERE role = 'secretaria';
-- 'advogado' permanece sem alteração

-- 3. Atualizar a função trigger que cria o profile automaticamente
--    ao criar um novo auth.user. O role padrão agora é 'advogado'.
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

-- 4. Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);


-- =============================================
-- PREPARAÇÃO PARA FASE 2: Restrição de processos por responsável/equipe
-- =============================================
--
-- A coluna processos.advogado_responsavel_id já existe e está pronta.
-- Quando quiser ativar restrição de acesso por responsável:
--
-- PASSO 1 — Remover a policy atual de acesso total:
--
--   DROP POLICY IF EXISTS "Authenticated full access" ON public.processos;
--
-- PASSO 2 — Criar policy de acesso por papel ou responsabilidade:
--
--   CREATE POLICY "Acesso por role ou responsavel" ON public.processos
--     FOR SELECT TO authenticated
--     USING (
--       -- Sócios e gerentes veem todos os processos
--       EXISTS (
--         SELECT 1 FROM public.profiles
--         WHERE id = auth.uid()
--           AND role IN ('socio', 'gerente')
--           AND ativo = true
--       )
--       OR
--       -- Advogado/administrativo/estagiário veem apenas os seus
--       advogado_responsavel_id = auth.uid()
--     );
--
-- PASSO 3 — Criar policies análogas para INSERT/UPDATE/DELETE.
--
-- PASSO 4 — Atualizar canAccessProcesso() em src/lib/permissions.ts:
--   Remover o `return true` e descomentar a lógica por responsável.
--
-- OPCIONAL: tabela equipe_processo para acesso por equipe (N para N):
--
--   CREATE TABLE IF NOT EXISTS public.equipe_processo (
--     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
--     membro_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--     papel       TEXT DEFAULT 'colaborador',
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     UNIQUE (processo_id, membro_id)
--   );
--
--   Adicionar na USING da policy:
--     OR EXISTS (
--       SELECT 1 FROM public.equipe_processo
--       WHERE processo_id = processos.id AND membro_id = auth.uid()
--     )
--
-- =============================================
