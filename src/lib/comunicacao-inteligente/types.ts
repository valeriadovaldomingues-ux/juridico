import type { UserRole } from '@/types'

export type ComunicacaoInteligenteTipo = 'relatorio' | 'mensagem' | 'atualizacao'
export type ComunicacaoInteligenteCanal = 'portal' | 'email' | 'whatsapp'
export type ComunicacaoInteligenteStatus = 'pendente_aprovacao' | 'em_edicao' | 'aprovada' | 'enviada' | 'descartada'
export type ComunicacaoInteligenteAcaoLog = 'gerada' | 'editada' | 'aprovada' | 'enviada' | 'descartada'

export interface ComunicacaoInteligenteConteudo {
  resumoExecutivo: string
  oQueAconteceu: string
  oQueIssoSignifica: string
  proximosPassos: string[]
  acaoNecessariaCliente: string
  mensagemCliente: string
  observacoesInternas: string
  camposNaoEncontrados: string[]
  inconsistencias: string[]
}

export interface ComunicacaoInteligenteDraft extends ComunicacaoInteligenteConteudo {
  id: string
  cliente_id: string
  processo_id: string
  andamento_ids: unknown
  tipo: ComunicacaoInteligenteTipo
  canal_destino: ComunicacaoInteligenteCanal
  status: ComunicacaoInteligenteStatus
  titulo: string
  conteudo_json: ComunicacaoInteligenteConteudo | Record<string, unknown>
  conteudo_texto: string
  visivel_portal: boolean
  aprovado_por: string | null
  aprovado_em: string | null
  enviado_por: string | null
  enviado_em: string | null
  portal_mensagem_id: string | null
  criado_por: string
  atualizado_por: string | null
  created_at: string
  updated_at: string
  criado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
  aprovado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
  enviado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
}

export interface ComunicacaoInteligenteLog {
  id: string
  comunicacao_id: string
  acao: ComunicacaoInteligenteAcaoLog
  detalhes: Record<string, unknown>
  realizado_por: string
  created_at: string
  realizado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
}

export interface ComunicacaoInteligenteConsulta {
  processoId: string
  clienteId: string
  tipo: ComunicacaoInteligenteTipo
  canalDestino: ComunicacaoInteligenteCanal
  andamentoIds: string[]
}

