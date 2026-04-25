-- =============================================
-- Campos adicionais para busca e relatórios por cliente
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Adicionar colunas (seguro — IF NOT EXISTS evita falha em re-execução)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nome_fantasia        TEXT,
  ADD COLUMN IF NOT EXISTS socio_representante  TEXT,
  ADD COLUMN IF NOT EXISTS cnpj_raiz            TEXT;

-- 2. Popular cnpj_raiz para registros existentes
--    Regra: primeiros 8 dígitos do CNPJ normalizado (sem pontos/barras/traços)
--    Só para pessoa jurídica com CNPJ de 14 dígitos
UPDATE public.clientes
SET cnpj_raiz = LEFT(REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g'), 8)
WHERE cpf_cnpj IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g')) >= 14;

-- 3. Trigger para manter cnpj_raiz sincronizado automaticamente
CREATE OR REPLACE FUNCTION public.sync_cnpj_raiz()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  digits TEXT;
BEGIN
  IF NEW.cpf_cnpj IS NOT NULL THEN
    digits := REGEXP_REPLACE(NEW.cpf_cnpj, '[^0-9]', '', 'g');
    IF LENGTH(digits) >= 14 THEN
      NEW.cnpj_raiz := LEFT(digits, 8);
    ELSE
      NEW.cnpj_raiz := NULL;
    END IF;
  ELSE
    NEW.cnpj_raiz := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cnpj_raiz ON public.clientes;
CREATE TRIGGER trg_sync_cnpj_raiz
  BEFORE INSERT OR UPDATE OF cpf_cnpj, tipo_pessoa
  ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_raiz();

-- 4. Índices para performance de busca
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj_raiz
  ON public.clientes(cnpj_raiz)
  WHERE cnpj_raiz IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_nome_fantasia
  ON public.clientes USING gin(to_tsvector('portuguese', COALESCE(nome_fantasia, '')))
  WHERE nome_fantasia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj_norm
  ON public.clientes(
    (REGEXP_REPLACE(COALESCE(cpf_cnpj, ''), '[^0-9]', '', 'g'))
  )
  WHERE cpf_cnpj IS NOT NULL;
