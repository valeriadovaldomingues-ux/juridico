-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 1: adiciona role 'cliente' ao constraint de profiles
-- Idempotente: DROP + ADD CONSTRAINT é seguro em re-execução
-- =============================================

-- Atualiza constraint para incluir 'cliente' (role externo do portal)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'estagiario', 'comercial', 'administrativo',
    'advogado', 'gerente', 'socio',
    'cliente'
  ));

-- Atualiza trigger handle_new_user para aceitar role 'cliente' via metadata
-- (já usa COALESCE com fallback 'advogado' — sem alteração funcional necessária)
-- Confirmar que ON CONFLICT DO NOTHING está presente (já está desde auth_setup.sql)

-- Confirmação
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype   = 'c'
  AND conname   = 'profiles_role_check';
