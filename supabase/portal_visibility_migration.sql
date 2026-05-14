-- =============================================
-- Portal do Cliente — Fase 1
-- PARTE 3: campos de visibilidade pública
-- Todos DEFAULT false — nada visível até o escritório liberar explicitamente
-- Idempotente: ADD COLUMN IF NOT EXISTS
-- =============================================

-- ── processos ────────────────────────────────────────────────────────────────
-- true = processo aparece no portal do cliente vinculado
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_processos_visivel_cliente
  ON public.processos(visivel_cliente)
  WHERE visivel_cliente = true;

-- ── agenda_items ──────────────────────────────────────────────────────────────
-- true = audiência/prazo aparece na agenda do portal
ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agenda_visivel_cliente
  ON public.agenda_items(visivel_cliente)
  WHERE visivel_cliente = true;

-- ── prazos ────────────────────────────────────────────────────────────────────
-- true = prazo processual aparece no portal
ALTER TABLE public.prazos
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_prazos_visivel_cliente
  ON public.prazos(visivel_cliente)
  WHERE visivel_cliente = true;

-- ── doc_gerados ───────────────────────────────────────────────────────────────
-- true = documento gerado foi liberado para download no portal
ALTER TABLE public.doc_gerados
  ADD COLUMN IF NOT EXISTS liberado_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_doc_gerados_liberado_cliente
  ON public.doc_gerados(liberado_cliente)
  WHERE liberado_cliente = true;

-- ── documentos ────────────────────────────────────────────────────────────────
-- true = documento uploaded foi liberado para download no portal
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS liberado_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documentos_liberado_cliente
  ON public.documentos(liberado_cliente)
  WHERE liberado_cliente = true;
