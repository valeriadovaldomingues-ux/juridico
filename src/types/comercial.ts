// ─── Comercial Module Types ───────────────────────────────────────────────────

export type LeadStatus =
  | 'novo_lead'
  | 'contato_inicial'
  | 'aguardando_retorno'
  | 'reuniao_agendada'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export type LeadOrigem =
  | 'indicacao'
  | 'site'
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'google'
  | 'evento'
  | 'outro'

export type AtendimentoTipo =
  | 'whatsapp'
  | 'telefone'
  | 'reuniao'
  | 'email'
  | 'presencial'
  | 'outro'

export type PropostaStatus = 'em_elaboracao' | 'enviada' | 'aceita' | 'recusada'

export type TipoContratacao = 'honorarios' | 'mensalidade' | 'exito' | 'misto'

export interface Lead {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  origem: LeadOrigem
  area_interesse: string | null
  observacoes: string | null
  responsavel_id: string | null
  status: LeadStatus
  ordem: number
  valor_estimado: number | null
  cliente_id: string | null
  convertido_em: string | null
  created_at: string
  updated_at: string
  // joins
  responsavel?: { id: string; nome: string; cor_kanban: string | null } | null
  cliente?: { id: string; nome: string } | null
  atendimentos?: AtendimentoComercial[]
  propostas?: PropostaComercial[]
}

export interface AtendimentoComercial {
  id: string
  lead_id: string
  data: string
  tipo: AtendimentoTipo
  resumo: string
  proxima_acao: string | null
  responsavel_id: string | null
  created_at: string
  responsavel?: { id: string; nome: string } | null
}

export interface PropostaComercial {
  id: string
  lead_id: string
  valor: number
  descricao: string | null
  tipo_contratacao: TipoContratacao
  data_envio: string | null
  status: PropostaStatus
  created_at: string
  updated_at: string
}

// ─── Funil config ─────────────────────────────────────────────────────────────

export interface FunilColuna {
  status: LeadStatus
  label: string
  cor: string          // tailwind bg class
  corBorda: string     // tailwind border class
  terminal: boolean    // true = fechado/perdido
}

export const FUNIL_COLUNAS: FunilColuna[] = [
  { status: 'novo_lead',           label: 'Novo Lead',           cor: 'bg-slate-100',  corBorda: 'border-slate-300',  terminal: false },
  { status: 'contato_inicial',     label: 'Contato Inicial',     cor: 'bg-blue-50',    corBorda: 'border-blue-300',   terminal: false },
  { status: 'aguardando_retorno',  label: 'Aguardando Retorno',  cor: 'bg-amber-50',   corBorda: 'border-amber-300',  terminal: false },
  { status: 'reuniao_agendada',    label: 'Reunião Agendada',    cor: 'bg-purple-50',  corBorda: 'border-purple-300', terminal: false },
  { status: 'proposta_enviada',    label: 'Proposta Enviada',    cor: 'bg-indigo-50',  corBorda: 'border-indigo-300', terminal: false },
  { status: 'negociacao',          label: 'Em Negociação',       cor: 'bg-orange-50',  corBorda: 'border-orange-300', terminal: false },
  { status: 'fechado',             label: 'Fechado',             cor: 'bg-emerald-50', corBorda: 'border-emerald-400', terminal: true },
  { status: 'perdido',             label: 'Perdido',             cor: 'bg-red-50',     corBorda: 'border-red-300',    terminal: true },
]

export const STATUS_LABEL: Record<LeadStatus, string> = {
  novo_lead:          'Novo Lead',
  contato_inicial:    'Contato Inicial',
  aguardando_retorno: 'Aguardando Retorno',
  reuniao_agendada:   'Reunião Agendada',
  proposta_enviada:   'Proposta Enviada',
  negociacao:         'Em Negociação',
  fechado:            'Fechado',
  perdido:            'Perdido',
}

export const ORIGEM_LABEL: Record<LeadOrigem, string> = {
  indicacao: 'Indicação',
  site:      'Site',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  facebook:  'Facebook',
  google:    'Google',
  evento:    'Evento',
  outro:     'Outro',
}

export const TIPO_CONTRATACAO_LABEL: Record<TipoContratacao, string> = {
  honorarios:  'Honorários',
  mensalidade: 'Mensalidade',
  exito:       'Êxito',
  misto:       'Misto',
}
