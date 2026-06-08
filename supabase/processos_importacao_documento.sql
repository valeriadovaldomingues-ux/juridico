ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS comarca TEXT;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS classe_processual TEXT;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS assunto TEXT;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS segredo_justica BOOLEAN;

