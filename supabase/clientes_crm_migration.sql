-- ─────────────────────────────────────────────────────────────────────────────
-- clientes_crm_migration.sql
--
-- Evolui o módulo de clientes para CRM funcional:
-- 1. Estende a tabela clientes com campos de relacionamento
-- 2. Cria contact_interactions (histórico/timeline)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extensão de clientes ───────────────────────────────────────────────────

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_contato    text NOT NULL DEFAULT 'cliente'
        CHECK (tipo_contato IN ('cliente','parte_contraria','parceiro','fornecedor','comercial')),
  ADD COLUMN IF NOT EXISTS responsavel_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ultimo_contato  timestamptz,
  ADD COLUMN IF NOT EXISTS cargo           text,
  ADD COLUMN IF NOT EXISTS empresa         text,
  ADD COLUMN IF NOT EXISTS tags            text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_clientes_tipo_contato   ON public.clientes(tipo_contato);
CREATE INDEX IF NOT EXISTS idx_clientes_responsavel_id ON public.clientes(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_clientes_ultimo_contato ON public.clientes(ultimo_contato);

-- ── 2. Histórico de interações ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo          text        NOT NULL
        CHECK (tipo IN ('ligacao','reuniao','email','mensagem','observacao','tarefa_concluida')),
  descricao     text        NOT NULL,
  usuario_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access on contact_interactions"
  ON public.contact_interactions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_interactions_cliente ON public.contact_interactions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date    ON public.contact_interactions(created_at DESC);

-- Trigger: atualiza ultimo_contato em clientes sempre que uma interação é criada
CREATE OR REPLACE FUNCTION sync_ultimo_contato()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.clientes
  SET ultimo_contato = NEW.created_at
  WHERE id = NEW.cliente_id
    AND (ultimo_contato IS NULL OR ultimo_contato < NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_ultimo_contato
  AFTER INSERT ON public.contact_interactions
  FOR EACH ROW EXECUTE FUNCTION sync_ultimo_contato();
