import type { UserRole } from '@/types'

export interface ClienteContato {
  id: string
  cliente_id: string
  nome: string
  cargo: string | null
  area_responsavel: string | null
  celular: string | null
  email: string | null
  observacoes: string | null
  contato_principal: boolean
  ativo: boolean
  recebe_juridico: boolean
  recebe_financeiro: boolean
  recebe_documentos: boolean
  recebe_comunicados: boolean
  criado_por: string
  atualizado_por: string | null
  created_at: string
  updated_at: string
  cliente?: { id: string; nome: string } | null
  criado_por_profile?: { id: string; nome: string; role: UserRole } | null
  atualizado_por_profile?: { id: string; nome: string; role: UserRole } | null
}

export interface ClienteContatoFormValues {
  nome: string
  cargo: string
  area_responsavel: string
  celular: string
  email: string
  observacoes: string
  contato_principal: boolean
  ativo: boolean
  recebe_juridico: boolean
  recebe_financeiro: boolean
  recebe_documentos: boolean
  recebe_comunicados: boolean
}

export interface ClienteContatoWriteInput extends ClienteContatoFormValues {}

export interface ClienteContatosListFilters {
  includeInactive?: boolean
}
