-- ============================================================
-- Histórico de análises de publicações via IA
-- ============================================================

CREATE TABLE IF NOT EXISTS ia_analises_publicacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id    uuid REFERENCES publicacoes(id) ON DELETE CASCADE,
  processo_id      uuid REFERENCES processos(id) ON DELETE SET NULL,
  criado_por       uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Campos da análise
  resumo           text,
  tipo_prazo       text,
  prazo_detectado  boolean DEFAULT false,
  prazo_data       date,
  prazo_descricao  text,
  fundamentacao    text,
  sugestao_acao    text,
  urgencia         text CHECK (urgencia IN ('baixa', 'media', 'alta', 'critica')),
  observacoes      text,

  created_at       timestamptz DEFAULT now()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS ia_analises_publicacao_id_idx ON ia_analises_publicacoes(publicacao_id);
CREATE INDEX IF NOT EXISTS ia_analises_processo_id_idx  ON ia_analises_publicacoes(processo_id);
CREATE INDEX IF NOT EXISTS ia_analises_criado_por_idx   ON ia_analises_publicacoes(criado_por);
CREATE INDEX IF NOT EXISTS ia_analises_created_at_idx   ON ia_analises_publicacoes(created_at DESC);

-- RLS
ALTER TABLE ia_analises_publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_analises_all_authenticated" ON ia_analises_publicacoes;
CREATE POLICY "ia_analises_all_authenticated"
  ON ia_analises_publicacoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
