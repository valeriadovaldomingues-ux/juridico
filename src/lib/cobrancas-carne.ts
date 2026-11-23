// Carnê do contrato (advocacia de partido): quais parcelas formam o contrato, emissão em fila no Inter
// (com pausa e nova tentativa quando o Inter limita com 429) e regras para montar o PDF único.
// Lógica pura: nada de banco, rede ou React, para ser testada.

export interface ParcelaCarne {
  id: string
  cliente_id: string
  processo_id: string | null
  parcela_numero: number
  parcela_total: number
  descricao: string
  tipo_caso: string | null
  status: string
  inter_cobranca_id: string | null
  data_vencimento: string
  valor: number | string
}

/** Pausa entre uma emissão e a próxima (o Inter limita pedidos em sequência rápida). */
export const INTERVALO_ENTRE_EMISSOES_MS = 3000
/** Esperas, em ordem, quando o Inter responde 429 (Too Many Requests): até 3 novas tentativas por parcela. */
export const ESPERAS_429_MS = [8000, 15000, 30000]

export function erroDeLimite(mensagem: string | null | undefined): boolean {
  return /\b429\b|too many requests/i.test(mensagem ?? '')
}

/** Duas parcelas são do mesmo contrato quando cliente, processo, nº de parcelas, descrição e tipo coincidem. */
export function mesmoContrato(a: ParcelaCarne, b: ParcelaCarne): boolean {
  return (
    a.cliente_id === b.cliente_id &&
    (a.processo_id ?? null) === (b.processo_id ?? null) &&
    a.parcela_total === b.parcela_total &&
    a.descricao.trim() === b.descricao.trim() &&
    (a.tipo_caso ?? null) === (b.tipo_caso ?? null)
  )
}

export interface ContratoParcelas {
  /** parcelas do contrato (sem canceladas), por número da parcela */
  parcelas: ParcelaCarne[]
  /** nº de parcelas (1..total) que não existem ou estão canceladas */
  ausentes: number[]
  /** true se há duas parcelas com o mesmo número (dois contratos iguais misturados) */
  ambiguo: boolean
}

export function parcelasDoContrato<T extends ParcelaCarne>(referencia: T, todas: T[]): Omit<ContratoParcelas, 'parcelas'> & { parcelas: T[] } {
  const parcelas = todas
    .filter(c => c.status !== 'cancelada' && mesmoContrato(referencia, c))
    .sort((x, y) => x.parcela_numero - y.parcela_numero)
  const numeros = parcelas.map(p => p.parcela_numero)
  const ambiguo = new Set(numeros).size !== numeros.length
  const ausentes: number[] = []
  for (let n = 1; n <= referencia.parcela_total; n += 1) if (!numeros.includes(n)) ausentes.push(n)
  return { parcelas, ausentes, ambiguo }
}

const hoje = () => new Date().toISOString().slice(0, 10)

/** Precisa ser enviada ao Inter: ainda sem identificador de lá e em um status que permite emitir. */
export function precisaEmitir(p: Pick<ParcelaCarne, 'status' | 'inter_cobranca_id'>): boolean {
  return !p.inter_cobranca_id && ['rascunho', 'pendente', 'erro_emissao', 'vencida'].includes(p.status)
}

export interface ResultadoEmissao {
  ok: boolean
  /** mensagem de erro (quando !ok) */
  erro?: string
}

export interface ResultadoFila {
  emitidas: number[]
  /** parcelas puladas porque o vencimento já passou (o Inter não emite boleto vencido) */
  puladasVencidas: number[]
  /** primeira falha que interrompeu a fila (null = terminou tudo) */
  falha: { numero: number; erro: string } | null
}

/**
 * Emite as parcelas pendentes uma a uma. Entre uma e outra faz uma pausa; se o Inter limitar (429),
 * espera e tenta a mesma parcela de novo (até ESPERAS_429_MS.length vezes). Qualquer outro erro
 * (dados do pagador, por exemplo) interrompe a fila, porque as próximas falhariam do mesmo jeito.
 */
export async function emitirEmFila(entrada: {
  parcelas: Array<Pick<ParcelaCarne, 'id' | 'parcela_numero' | 'status' | 'inter_cobranca_id' | 'data_vencimento'>>
  emitir: (id: string) => Promise<ResultadoEmissao>
  esperar: (ms: number) => Promise<void>
  aoProgredir?: (info: { numero: number; feitas: number; total: number; aguardando429?: boolean }) => void
  hojeISO?: string
}): Promise<ResultadoFila> {
  const dia = entrada.hojeISO ?? hoje()
  const fila = entrada.parcelas.filter(precisaEmitir)
  const emitiveis = fila.filter(p => p.data_vencimento >= dia)
  const puladasVencidas = fila.filter(p => p.data_vencimento < dia).map(p => p.parcela_numero)
  const emitidas: number[] = []

  for (let i = 0; i < emitiveis.length; i += 1) {
    const parcela = emitiveis[i]
    entrada.aoProgredir?.({ numero: parcela.parcela_numero, feitas: emitidas.length, total: emitiveis.length })

    let resultado = await entrada.emitir(parcela.id)
    for (let tentativa = 0; !resultado.ok && erroDeLimite(resultado.erro) && tentativa < ESPERAS_429_MS.length; tentativa += 1) {
      entrada.aoProgredir?.({ numero: parcela.parcela_numero, feitas: emitidas.length, total: emitiveis.length, aguardando429: true })
      await entrada.esperar(ESPERAS_429_MS[tentativa])
      resultado = await entrada.emitir(parcela.id)
    }

    if (!resultado.ok) {
      return { emitidas, puladasVencidas, falha: { numero: parcela.parcela_numero, erro: resultado.erro ?? 'Erro ao emitir no Inter.' } }
    }
    emitidas.push(parcela.parcela_numero)
    if (i < emitiveis.length - 1) await entrada.esperar(INTERVALO_ENTRE_EMISSOES_MS)
  }

  return { emitidas, puladasVencidas, falha: null }
}
