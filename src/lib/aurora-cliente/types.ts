import type { UserRole } from '@/types'

export const AURORA_CLIENTE_STATUS = ['respondida', 'precisa_revisao', 'encaminhada_equipe'] as const

export type AuroraClienteStatus = typeof AURORA_CLIENTE_STATUS[number]

export const AURORA_CLIENTE_FALLBACK = 'Não encontrei essa informação nos dados disponíveis. Vou encaminhar sua solicitação para a equipe responsável.'

export interface AuroraClienteContextoAndamento {
  id: string
  data_andamento: string
  tipo: string
  titulo: string
  origem: string
  responsavel?: { nome: string | null } | null
  criado_por_profile?: { nome: string | null } | null
}

export interface AuroraClienteContextoRelatorio {
  id: string
  titulo: string
  resumo_executivo: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  published_at: string | null
}

export interface AuroraClienteContextoComunicacao {
  id: string
  autor_tipo: string
  conteudo: string
  tipo: string
  created_at: string
}

export interface AuroraClienteContextoDocumento {
  id: string
  nome_arquivo: string
  tipo_documento: string
  created_at: string
}

export interface AuroraClienteTimelineItem {
  id: string
  data: string | null
  tipo: string
  texto: string
  sub?: string | null
}

export interface AuroraClienteContexto {
  cliente_id: string
  processo: {
    id: string
    numero_processo: string | null
    titulo: string
    area_direito: string
    status: string
    fase: string | null
    tribunal: string | null
    comarca: string | null
    vara: string | null
    classe_processual: string | null
    assunto: string | null
    data_distribuicao: string | null
  }
  andamentos: AuroraClienteContextoAndamento[]
  relatorios: AuroraClienteContextoRelatorio[]
  comunicacoes: AuroraClienteContextoComunicacao[]
  documentos: AuroraClienteContextoDocumento[]
  timeline: AuroraClienteTimelineItem[]
  resumo: {
    andamentos: number
    relatorios: number
    comunicacoes: number
    documentos: number
    timeline: number
  }
}

export interface AuroraClienteConversa {
  id: string
  cliente_id: string
  processo_id: string
  pergunta: string
  resposta: string
  status: AuroraClienteStatus
  precisa_retorno_humano: boolean
  created_at: string
  created_by: string
  created_by_profile?: {
    id: string
    nome: string
    role: UserRole
  } | null
}

export interface AuroraClienteResposta {
  resposta: string
  status: AuroraClienteStatus
  precisa_retorno_humano: boolean
  pontos_principais: string[]
  fontes_usadas: string[]
}

export interface AuroraClientePerguntaInput {
  pergunta: string
  precisaRetornoHumano?: boolean
}
