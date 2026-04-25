-- =============================================
-- Módulo Documentos — Modelos e Gerados
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- Tabela de modelos de documentos (templates com placeholders)
CREATE TABLE IF NOT EXISTS public.doc_modelos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text        NOT NULL,
  area_direito   text        CHECK (area_direito IN ('civil','trabalhista','criminal','tributario','previdenciario','administrativo','familia','empresarial','outro')),
  tipo_documento text        NOT NULL DEFAULT 'peticao_inicial',
  descricao      text,
  conteudo       text        NOT NULL DEFAULT '',
  criado_por     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo          boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Tabela de documentos gerados a partir dos modelos
CREATE TABLE IF NOT EXISTS public.doc_gerados (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id      uuid        REFERENCES public.doc_modelos(id) ON DELETE SET NULL,
  processo_id    uuid        NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo         text        NOT NULL,
  conteudo       text        NOT NULL,
  criado_por     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Preparação para integração futura com Google Docs
  google_doc_id  text,
  google_doc_url text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.doc_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.doc_modelos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.doc_gerados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_doc_modelos_area    ON public.doc_modelos(area_direito);
CREATE INDEX IF NOT EXISTS idx_doc_modelos_ativo   ON public.doc_modelos(ativo);
CREATE INDEX IF NOT EXISTS idx_doc_modelos_tipo    ON public.doc_modelos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_doc_gerados_proc    ON public.doc_gerados(processo_id);
CREATE INDEX IF NOT EXISTS idx_doc_gerados_modelo  ON public.doc_gerados(modelo_id);
CREATE INDEX IF NOT EXISTS idx_doc_gerados_criado  ON public.doc_gerados(created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_doc_modelos_updated_at
  BEFORE UPDATE ON public.doc_modelos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_doc_gerados_updated_at
  BEFORE UPDATE ON public.doc_gerados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
