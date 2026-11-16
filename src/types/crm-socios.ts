// ─── CRM Cris e Val — tipos ──────────────────────────────────────────────────
// Separado de src/types/comercial.ts (CRM da Luciana). Não compartilhe tipos entre os dois.

import type {
  EtapaId, StatusOportunidade, TipoPessoa, TipoInteracao, TipoHonorario, StatusProposta,
} from '@/lib/crm-socios/constants'

export type { EtapaId, StatusOportunidade, TipoPessoa, TipoInteracao, TipoHonorario, StatusProposta }

export interface CrmResponsavel {
  id: string
  nome: string
  cor_kanban: string | null
}

export interface CrmOportunidade {
  id: string
  nome: string
  tipo_pessoa: TipoPessoa
  contato_nome: string | null
  contato_telefone: string | null
  contato_email: string | null
  origem: string | null
  indicado_por: string | null
  area_interesse: string | null
  valor_estimado: number | null
  responsavel_id: string | null
  etapa: EtapaId
  status: StatusOportunidade
  proxima_acao: string | null
  proxima_acao_data: string | null // yyyy-mm-dd
  ultimo_contato_em: string | null // ISO
  motivo_perda: string | null
  notas: string | null
  cliente_id: string | null
  data_fechamento: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
  // joins
  responsavel?: CrmResponsavel | null
  cliente?: { id: string; nome: string } | null
  interacoes?: CrmInteracao[]
  propostas?: CrmProposta[]
}

export interface CrmInteracao {
  id: string
  oportunidade_id: string
  tipo: TipoInteracao
  data_interacao: string // ISO
  descricao: string
  autor_id: string | null
  created_at: string
  autor?: { id: string; nome: string } | null
}

export interface CrmProposta {
  id: string
  oportunidade_id: string
  titulo: string
  descricao: string | null
  valor: number | null
  tipo_honorario: TipoHonorario
  forma_pagamento: string | null
  data_envio: string | null // yyyy-mm-dd
  validade: string | null // yyyy-mm-dd
  status: StatusProposta
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
}

/** Perfil mínimo usado nos seletores de responsável. */
export interface CrmPerfilSocio {
  id: string
  nome: string
  cor_kanban: string | null
}
