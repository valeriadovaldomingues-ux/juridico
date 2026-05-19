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

export type OrigemPublicacaoCapturada =
  | 'datajud_oab'
  | 'datajud_nome'
  | 'datajud_processo'
  | 'datajud_combinado'
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
  tribunal?: string
  ramo?: string
}
