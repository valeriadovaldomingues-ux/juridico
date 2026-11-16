// ─────────────────────────────────────────────────────────────────────────────
// CRM Cris e Val — constantes centrais.
//
// Módulo SEPARADO do CRM comercial da Luciana (/comercial, tabelas `leads` e
// `propostas_comerciais`). Nada aqui lê ou escreve nas tabelas dela.
//
// Sem dependências: é importado pelo proxy (Edge Runtime), pela permissions.ts,
// pelas API routes e pela UI.
// ─────────────────────────────────────────────────────────────────────────────

import type { UserRole } from '@/types'

/** Quem enxerga e usa o módulo. Hoje: sócios (Valéria e Cristiano). Fonte única — menu, rota, APIs e páginas. */
export const CRM_SOCIOS_PAPEIS: readonly UserRole[] = ['socio']

/** Rota base do módulo. */
export const CRM_SOCIOS_ROTA = '/crm-socios'

/** Dias sem interação para a oportunidade ser considerada "parada". */
export const CRM_SOCIOS_DIAS_PARADA = 14

/** Quantas ações aparecem na faixa "Próximas ações". */
export const CRM_SOCIOS_QTD_PROXIMAS_ACOES = 5

// ─── Etapas do funil (ordem = ordem das colunas) ─────────────────────────────
// Para mudar o funil depois, é só editar esta lista (e o CHECK da migração).

export const ETAPAS = [
  { id: 'contato_inicial',  label: 'Contato inicial',      terminal: false },
  { id: 'reuniao_marcada',  label: 'Reunião marcada',      terminal: false },
  { id: 'reuniao_feita',    label: 'Reunião feita',        terminal: false },
  { id: 'proposta_enviada', label: 'Proposta enviada',     terminal: false },
  { id: 'negociacao',       label: 'Negociação',           terminal: false },
  { id: 'fechado',          label: 'Fechado (ganho)',      terminal: true  },
  { id: 'perdido',          label: 'Perdido',              terminal: true  },
] as const

export type EtapaId = (typeof ETAPAS)[number]['id']

export const ETAPA_IDS: readonly EtapaId[] = ETAPAS.map(e => e.id)

export const ETAPA_LABEL: Record<EtapaId, string> =
  Object.fromEntries(ETAPAS.map(e => [e.id, e.label])) as Record<EtapaId, string>

export const ETAPA_INICIAL: EtapaId = 'contato_inicial'
export const ETAPA_GANHO: EtapaId = 'fechado'
export const ETAPA_PERDIDO: EtapaId = 'perdido'
export const ETAPA_PROPOSTA: EtapaId = 'proposta_enviada'

// ─── Status (derivado da etapa) ──────────────────────────────────────────────

export const STATUS_OPORTUNIDADE = ['aberto', 'ganho', 'perdido'] as const
export type StatusOportunidade = (typeof STATUS_OPORTUNIDADE)[number]

export const STATUS_OPORTUNIDADE_LABEL: Record<StatusOportunidade, string> = {
  aberto: 'Aberto',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

// ─── Tipo de pessoa (mesmos valores de `clientes.tipo_pessoa`) ───────────────

export const TIPOS_PESSOA = ['fisica', 'juridica'] as const
export type TipoPessoa = (typeof TIPOS_PESSOA)[number]
export const TIPO_PESSOA_LABEL: Record<TipoPessoa, string> = { fisica: 'Pessoa física', juridica: 'Pessoa jurídica' }

// ─── Interações ──────────────────────────────────────────────────────────────

export const TIPOS_INTERACAO = ['ligacao', 'reuniao', 'whatsapp', 'email', 'nota'] as const
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number]
export const TIPO_INTERACAO_LABEL: Record<TipoInteracao, string> = {
  ligacao: 'Ligação',
  reuniao: 'Reunião',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  nota: 'Nota',
}

// ─── Propostas de honorários ─────────────────────────────────────────────────

export const TIPOS_HONORARIO = ['fixo', 'mensal', 'exito', 'misto'] as const
export type TipoHonorario = (typeof TIPOS_HONORARIO)[number]
export const TIPO_HONORARIO_LABEL: Record<TipoHonorario, string> = {
  fixo: 'Fixo',
  mensal: 'Mensal',
  exito: 'Êxito',
  misto: 'Misto',
}

export const STATUS_PROPOSTA = ['rascunho', 'enviada', 'aceita', 'recusada'] as const
export type StatusProposta = (typeof STATUS_PROPOSTA)[number]
export const STATUS_PROPOSTA_LABEL: Record<StatusProposta, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
}

// ─── Responsáveis ────────────────────────────────────────────────────────────
// Responsável = perfil ativo com papel de sócio (Valéria ou Cristiano).
export const CRM_SOCIOS_RESPONSAVEL_PAPEIS: readonly UserRole[] = CRM_SOCIOS_PAPEIS

// ─── Nomes das tabelas (uma só vez, para não espalhar string) ────────────────
export const TABELA_OPORTUNIDADES = 'crm_socios_oportunidades'
export const TABELA_INTERACOES = 'crm_socios_interacoes'
export const TABELA_PROPOSTAS = 'crm_socios_propostas'
