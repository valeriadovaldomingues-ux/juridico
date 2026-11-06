// Campos próprios da audiência (tipo, modalidade, link ou endereço) e regras que valem para audiência e perícia.
// Antes, tudo isso ficava misturado no texto da descrição.

export const AUDIENCIA_TIPOS = { inicial: 'Inicial', una: 'UNA', instrucao: 'Instrução', conciliacao: 'Conciliação', outra: 'Outra' } as const
export const AUDIENCIA_MODALIDADES = { presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Híbrida' } as const

export type AudienciaTipo = keyof typeof AUDIENCIA_TIPOS
export type AudienciaModalidade = keyof typeof AUDIENCIA_MODALIDADES

/** Audiência e perícia: sempre ligadas a um processo. */
export const ehAudienciaOuPericia = (tipo: string | null | undefined) => tipo === 'audiencia' || tipo === 'pericia'

/** Mensagem de erro quando uma audiência/perícia é salva sem processo; null quando está tudo certo. */
export function erroProcessoDaAudiencia(tipo: string | null | undefined, processoId: string | null | undefined): string | null {
  return ehAudienciaOuPericia(tipo) && !processoId
    ? 'Audiência e perícia precisam estar ligadas a um processo. Escolha o processo.'
    : null
}

/** Rótulo do status para a pauta: pendente = Aberta; concluído = Realizada; cancelado = Cancelada. */
export function rotuloStatusAudiencia(status: string | null | undefined): 'Aberta' | 'Realizada' | 'Cancelada' {
  if (status === 'cancelado') return 'Cancelada'
  if (status === 'concluido') return 'Realizada'
  return 'Aberta'
}

/** Responsáveis de uma audiência: o campo guarda até 2 nomes como "Nome 1 / Nome 2" (o 2º é quem acompanha). */
export function responsaveisDaAudiencia(responsavel: string | null | undefined): string[] {
  return (responsavel ?? '').split(' / ').map(n => n.trim()).filter(Boolean).slice(0, 2)
}

/** Número do processo guardado como texto na importação (vem com aspas e espaços): devolve só o número. */
export function limparNumeroProcesso(raw: string | null | undefined): string | null {
  const n = (raw ?? '').replace(/["'“”]/g, '').trim()
  return n || null
}

export interface CamposAudiencia {
  audiencia_tipo: AudienciaTipo | null
  audiencia_modalidade: AudienciaModalidade | null
  audiencia_local: string | null
}

/** Valida e normaliza os campos da audiência vindos de formulário, API ou conector (valor desconhecido vira null). */
export function normalizarCamposAudiencia(input: { audiencia_tipo?: unknown; audiencia_modalidade?: unknown; audiencia_local?: unknown }): CamposAudiencia {
  const tipo = typeof input.audiencia_tipo === 'string' && input.audiencia_tipo in AUDIENCIA_TIPOS ? input.audiencia_tipo as AudienciaTipo : null
  const modalidade = typeof input.audiencia_modalidade === 'string' && input.audiencia_modalidade in AUDIENCIA_MODALIDADES ? input.audiencia_modalidade as AudienciaModalidade : null
  const local = typeof input.audiencia_local === 'string' && input.audiencia_local.trim() ? input.audiencia_local.trim().slice(0, 500) : null
  return { audiencia_tipo: tipo, audiencia_modalidade: modalidade, audiencia_local: local }
}
