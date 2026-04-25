-- Add birth_date and ignore_birthday to clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS ignore_birthday boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clientes_birth_month_day
  ON public.clientes(EXTRACT(MONTH FROM data_nascimento), EXTRACT(DAY FROM data_nascimento))
  WHERE data_nascimento IS NOT NULL AND NOT ignore_birthday;

-- Add birth_date to profiles (team members)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS ignore_birthday boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_birth_month_day
  ON public.profiles(EXTRACT(MONTH FROM data_nascimento), EXTRACT(DAY FROM data_nascimento))
  WHERE data_nascimento IS NOT NULL AND NOT ignore_birthday;
