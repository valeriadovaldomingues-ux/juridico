-- ============================================================
-- Agenda: campos próprios da audiência (tipo, modalidade, link ou endereço)
-- ============================================================
-- Aditiva e idempotente: três colunas novas, todas opcionais. Nada existente muda de tipo nem é preenchido.
-- Antes, tipo/modalidade/link ficavam misturados no texto da descrição.
--
-- O status continua sendo agenda_items.status: pendente = "Aberta", cancelado = "Cancelada", concluido = "Realizada".
-- Os dois responsáveis continuam em agenda_items.responsavel ("Nome 1 / Nome 2"), como a tela e o conector já fazem.
--
-- A regra "audiência sempre ligada a um processo" é aplicada na tela, na API e no conector. NÃO há CHECK no banco de
-- propósito: 15 audiências antigas do EasyJur estão sem processo e qualquer UPDATE nelas (inclusive o sync do Google)
-- seria recusado. A restrição entra depois que essas 15 forem vinculadas.

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS audiencia_tipo text,
  ADD COLUMN IF NOT EXISTS audiencia_modalidade text,
  ADD COLUMN IF NOT EXISTS audiencia_local text;

ALTER TABLE public.agenda_items DROP CONSTRAINT IF EXISTS agenda_items_audiencia_tipo_check;
ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_audiencia_tipo_check
  CHECK (audiencia_tipo IS NULL OR audiencia_tipo IN ('inicial', 'una', 'instrucao', 'conciliacao', 'outra'));

ALTER TABLE public.agenda_items DROP CONSTRAINT IF EXISTS agenda_items_audiencia_modalidade_check;
ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_audiencia_modalidade_check
  CHECK (audiencia_modalidade IS NULL OR audiencia_modalidade IN ('presencial', 'virtual', 'hibrida'));
