export type StatusFonteMonitoramento =
  | 'ativo'
  | 'preparado'
  | 'pendente'
  | 'erro'
  | 'requer_credencial'

export type RamoFonteMonitoramento =
  | 'estadual'
  | 'federal'
  | 'trabalhista'
  | 'eproc'
  | 'datajud'
  | 'superior'
  | 'nacional'

export type OrigemPublicacaoCapturada =
  | 'djen'
  | 'datajud_oab'
  | 'datajud_nome'
  | 'datajud_processo'
  | 'datajud_combinado'
  | 'superior_djen'
  | 'trf_djen'
  | 'tj_djen'
  | 'tjsp_djen'
  | 'trt_djen'
  | 'trt3_dejt'
  | 'trt3_djen'
  | 'manual'

export interface PublicacaoCapturada {
  fonte_id: string
  numero_processo: string | null
  tribunal: string
  orgao: string | null
  diario: string | null
  data_publicacao: string
  nome_pesquisado: string
  texto_publicacao: string
  origem: OrigemPublicacaoCapturada
  termo_encontrado?: string | null
  // ─── Campos ricos (fonte DJEN) — opcionais para compatibilidade ─────────────
  /** Código em publicacao_fontes (ex.: 'djen'). */
  fonte_codigo?: string | null
  /** Identificador oficial da comunicação na fonte. */
  id_externo?: string | null
  url_oficial?: string | null
  tipo_comunicacao?: string | null
  data_disponibilizacao?: string | null
  partes?: Array<{ nome: string; polo?: string }> | null
  advogados_publicacao?: Array<{ nome: string; numero_oab?: string; uf_oab?: string }> | null
  advogado_monitorado_id?: string | null
  oab_pesquisada?: string | null
  /** Hash de deduplicação já calculado pela fonte (estável entre termos). */
  hash_precomputado?: string | null
  /** Payload bruto recebido da fonte, para auditoria e reprocessamento. */
  dados_brutos?: unknown
}

export interface ResultadoMonitoramento {
  fonte_id: string
  fonte_nome: string
  tribunal: string
  ramo: RamoFonteMonitoramento
  status: StatusFonteMonitoramento
  encontradas: number
  inseridas: number
  duplicadas: number
  ignoradas: number
  falhas: number
  publicacoes: PublicacaoCapturada[]
  mensagem?: string
  erro?: string
}

export interface ContextoFonteMonitoramento {
  nomes: string[]
  processos: string[]
  oabs?: string[]
  data?: string
  /** Cadastro completo dos advogados monitorados (fontes que agrupam por OAB). */
  advogados?: Array<{
    id: string
    nome_completo: string
    oab_numero: string
    oab_uf: string
    ativo?: boolean
    termos_adicionais?: string[] | null
    variacoes_nome?: string[] | null
    tribunais_interesse?: string[] | null
  }>
  /** Dias de busca retroativa (contados a partir de `data` ou de hoje). */
  retroativoDias?: number
}

export interface FonteMonitoramento {
  id: string
  nome: string
  tribunal: string
  ramo: RamoFonteMonitoramento
  status: StatusFonteMonitoramento
  descricao: string
  requerCredencial?: boolean
  executar?: (contexto: ContextoFonteMonitoramento) => Promise<ResultadoMonitoramento>
}

export interface FonteMonitoramentoResumo {
  id: string
  nome: string
  tribunal: string
  ramo: RamoFonteMonitoramento
  status: StatusFonteMonitoramento
  descricao: string
  requerCredencial?: boolean
  ultima_execucao?: string | null
  total_encontrado?: number | null
  total_inserido?: number | null
  total_ignorado?: number | null
  erro?: string | null
}

export interface FiltroFontesMonitoramento {
  fonte?: string
  fontes?: string[]
  tribunal?: string
  ramo?: string
  data?: string
}
