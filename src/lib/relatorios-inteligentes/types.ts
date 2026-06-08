import type { UserRole } from '@/types'

export type RelatorioStatus = 'rascunho' | 'pendente_aprovacao' | 'aprovado' | 'publicado' | 'arquivado'
export type RelatorioAcaoLog = 'gerado' | 'editado' | 'aprovado' | 'publicado' | 'arquivado'

export interface RelatorioConteudo {
  resumoExecutivo: string
  principaisMovimentacoes: string[]
  situacaoAtual: string
  oQueIssoSignifica: string
  proximosPassos: string[]
  providenciasCliente: string
}

export interface RelatorioConsulta {
  processoId: string
  clienteId: string
  periodoInicio?: string | null
  periodoFim?: string | null
}

export interface RelatorioClienteDraft extends RelatorioConteudo {
  id: string
  cliente_id: string
  processo_id: string
  titulo: string
  periodo_inicio: string | null
  periodo_fim: string | null
  resumo_executivo: string
  conteudo: RelatorioConteudo | Record<string, unknown>
  conteudo_texto: string
  status: RelatorioStatus
  gerado_por: string
  aprovado_por: string | null
  publicado_por: string | null
  created_at: string
  approved_at: string | null
  published_at: string | null
  updated_at: string
  gerado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
  aprovado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
  publicado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
}

export interface RelatorioLog {
  id: string
  relatorio_id: string
  acao: RelatorioAcaoLog
  detalhes: Record<string, unknown>
  executado_por: string
  created_at: string
  executado_por_profile?: { id: string; nome: string; email: string | null; role: UserRole } | null
}

