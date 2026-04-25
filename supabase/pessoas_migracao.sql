-- ─── Migração: Tabela pessoas + ajuste em partes_processo ────────────────────
--
-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
-- É seguro rodar múltiplas vezes (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- O que faz:
--   1. Cria tabela `pessoas` — repositório leve de pessoas físicas/jurídicas
--      que aparecem como partes em processos (partes contrárias, terceiros, etc.)
--      SEM confundir com `clientes` (que possuem dados de contato completos).
--
--   2. Adiciona coluna `pessoa_id` em `partes_processo` (nullable).
--      Dados existentes NÃO são afetados (pessoa_id fica NULL para registros antigos).
--
--   3. Índice normalizado em pessoas.nome: lower(trim(nome))
--      Garante deduplicação case-insensitive e sem espaços extras.
--
--   4. Unique index em partes_processo(processo_id, pessoa_id) para impedir
--      que a mesma pessoa apareça duas vezes no mesmo processo — torna a
--      importação idempotente.
--
--   5. Índice de performance em partes_processo(processo_id) — estava faltando.

-- ─── 1. Tabela pessoas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pessoas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  cpf_cnpj   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pessoas' AND policyname = 'Authenticated full access'
  ) THEN
    CREATE POLICY "Authenticated full access"
      ON public.pessoas FOR ALL
      TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Índice único normalizado: garante que "banco itaú", "Banco Itaú" e "BANCO ITAÚ"
-- não geram registros duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoas_nome_norm
  ON public.pessoas (lower(trim(nome)));

-- ─── 2. Adiciona pessoa_id em partes_processo ──────────────────────────────────

ALTER TABLE public.partes_processo
  ADD COLUMN IF NOT EXISTS pessoa_id UUID
    REFERENCES public.pessoas(id) ON DELETE SET NULL;

-- Índice de performance para queries por processo_id (estava ausente)
CREATE INDEX IF NOT EXISTS idx_partes_processo_processo_id
  ON public.partes_processo (processo_id);

-- Índice de performance para o FK pessoa_id
CREATE INDEX IF NOT EXISTS idx_partes_processo_pessoa_id
  ON public.partes_processo (pessoa_id)
  WHERE pessoa_id IS NOT NULL;

-- Unique: impede a mesma pessoa no mesmo processo (idempotência da importação).
-- Só se aplica a registros com pessoa_id preenchido (partes manuais com texto livre
-- não são afetadas).
CREATE UNIQUE INDEX IF NOT EXISTS idx_partes_unique_pessoa_processo
  ON public.partes_processo (processo_id, pessoa_id)
  WHERE pessoa_id IS NOT NULL;

-- ─── 3. (Opcional) Migrar registros existentes em partes_processo ─────────────
--
-- Se você já tem registros em partes_processo com pessoa_nome preenchido
-- e quiser vinculá-los à tabela pessoas, descomente e execute o bloco abaixo.
-- Ele cria entradas em pessoas para cada nome único e atualiza o pessoa_id.
--
-- ATENÇÃO: Só execute depois de rodar os passos 1 e 2 acima.
--
-- DO $$
-- DECLARE
--   r RECORD;
--   p_id UUID;
-- BEGIN
--   FOR r IN
--     SELECT DISTINCT ON (lower(trim(pessoa_nome))) pessoa_nome
--     FROM public.partes_processo
--     WHERE pessoa_id IS NULL AND pessoa_nome IS NOT NULL AND trim(pessoa_nome) <> ''
--   LOOP
--     -- Tenta inserir, ignora se já existe
--     INSERT INTO public.pessoas (nome)
--     VALUES (trim(r.pessoa_nome))
--     ON CONFLICT (lower(trim(nome))) DO NOTHING;
--
--     -- Busca o id (seja novo ou existente)
--     SELECT id INTO p_id
--     FROM public.pessoas
--     WHERE lower(trim(nome)) = lower(trim(r.pessoa_nome))
--     LIMIT 1;
--
--     -- Atualiza partes_processo com o pessoa_id encontrado
--     IF p_id IS NOT NULL THEN
--       UPDATE public.partes_processo
--       SET pessoa_id = p_id
--       WHERE lower(trim(pessoa_nome)) = lower(trim(r.pessoa_nome))
--         AND pessoa_id IS NULL;
--     END IF;
--   END LOOP;
-- END$$;
