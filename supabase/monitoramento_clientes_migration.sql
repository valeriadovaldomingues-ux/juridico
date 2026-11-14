-- ============================================================
-- Monitoramento de clientes por documento (CPF/CNPJ) — fase 1
-- ============================================================
-- O escritório monitora o CPF/CNPJ dos clientes (contrato de honorários) e quer ser AVISADO quando
-- surgir processo novo envolvendo o cliente (principalmente no polo passivo) que o PEDV ainda não
-- cadastrou.
--
-- Como funciona: uma rotina diária consulta o DJEN (comunicaapi.pje.jus.br) pelo NOME do cliente
-- (o DJEN não filtra por CPF/CNPJ), descarta quem não tem nome igual ao monitorado e cria UM alerta
-- por processo ainda não cadastrado em `processos`. A tabela de alertas tem unicidade
-- (monitoramento_id, numero_processo) para nunca avisar duas vezes o mesmo processo.
--
-- ATENÇÃO: esta migração só deve ser aplicada com autorização expressa da Valéria/sócios.
-- Aditiva e idempotente (CREATE ... IF NOT EXISTS). RLS ligada e SEM policies: só o service role
-- acessa (as rotas /api/monitoramento/clientes/* e o cron usam service role).

-- ─── Documentos monitorados ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitoramento_documentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  documento        text NOT NULL,                       -- só dígitos (11 = CPF, 14 = CNPJ)
  tipo             text NOT NULL CHECK (tipo IN ('cpf', 'cnpj')),
  nome_principal   text NOT NULL,
  nomes_busca      text[] NOT NULL DEFAULT '{}',        -- variações do nome para buscar no DJEN
  ativo            boolean NOT NULL DEFAULT true,
  contrato_ref     text,
  vigencia_inicio  date,
  vigencia_fim     date,
  observacoes      text,
  ultima_busca_em  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Um mesmo documento só pode estar ativo uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS monitoramento_documentos_documento_ativo_uniq
  ON public.monitoramento_documentos (documento) WHERE ativo;
CREATE INDEX IF NOT EXISTS monitoramento_documentos_cliente_idx
  ON public.monitoramento_documentos (cliente_id);

-- ─── Alertas ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitoramento_alertas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoramento_id     uuid NOT NULL REFERENCES public.monitoramento_documentos(id) ON DELETE CASCADE,
  numero_processo      text NOT NULL,                   -- 20 dígitos, sem máscara
  tribunal             text,
  orgao                text,
  polo                 text,                            -- 'A' (ativo) | 'P' (passivo) — polo do cliente
  tipo_comunicacao     text,
  data_disponibilizacao date,                           -- publicação mais antiga do período
  nome_encontrado      text,
  link                 text,
  classificacao        text NOT NULL DEFAULT 'novo_processo'
                       CHECK (classificacao IN ('novo_processo', 'processo_conhecido')),
  possivel_homonimo    boolean NOT NULL DEFAULT false,  -- CPF: só há nome para comparar
  status               text NOT NULL DEFAULT 'novo'
                       CHECK (status IN ('novo', 'visto', 'descartado', 'processo_cadastrado')),
  processo_id          uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  avisado_em           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Alerta UMA vez por processo e por documento monitorado.
CREATE UNIQUE INDEX IF NOT EXISTS monitoramento_alertas_processo_uniq
  ON public.monitoramento_alertas (monitoramento_id, numero_processo);
CREATE INDEX IF NOT EXISTS monitoramento_alertas_status_idx
  ON public.monitoramento_alertas (status, created_at DESC);

-- ─── Segurança ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.monitoramento_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoramento_alertas    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monitoramento_documentos FROM anon, authenticated;
REVOKE ALL ON public.monitoramento_alertas    FROM anon, authenticated;
