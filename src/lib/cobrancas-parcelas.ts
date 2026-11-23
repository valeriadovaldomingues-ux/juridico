// Planejamento das parcelas de um contrato de advocacia de partido (mês a mês, com ou sem 13º).
// Lógica pura (sem banco, sem React) para ser testada e usada pela tela de Cobranças.
// As datas usam o mesmo cálculo do servidor (addMonthsKeepingDay), então o que a tela mostra é o que será gravado.

import { addMonthsKeepingDay } from './cobrancas'

/** Mínimo aceito pela API de boleto/Pix do Inter (mesma regra do servidor). */
export const VALOR_MINIMO_PARCELA = 2.5

/** "Do que se trata" — atalhos para a descrição da cobrança. O texto continua editável. */
export const ASSUNTOS_COBRANCA = [
  'Honorários advocatícios',
  'Honorários advocatícios — advocacia de partido',
  'Honorários de êxito',
  'Custas e despesas processuais',
] as const

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "1.500,25" | "1500,25" | "1500.25" | "R$ 1.500,25" → número; vazio/ruim → null. */
export function parseValorBR(texto: string | null | undefined): number | null {
  if (texto == null) return null
  let t = String(texto).replace(/R\$/gi, '').replace(/\s/g, '')
  if (t === '') return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function rotuloMes(dataISO: string): string {
  const [ano, mes] = dataISO.split('-')
  return `${MESES[Number(mes) - 1] ?? mes}/${ano}`
}

export interface ParcelaPlanejada {
  numero: number
  /** AAAA-MM-DD */
  vencimento: string
  /** ex.: "dez/2027" */
  mes: string
  ehDezembro: boolean
  /** valor do mês (null = ainda não preenchido ou inválido) */
  base: number | null
  /** parte do 13º somada nesta parcela (0 se não é dezembro ou o 13º está desligado) */
  decimoTerceiro: number
  /** o que vira boleto: base + 13º (null se a base não está preenchida) */
  valor: number | null
}

export interface PlanoParcelas {
  parcelas: ParcelaPlanejada[]
  /** soma das parcelas já preenchidas */
  total: number
  /** números (1..N) das parcelas sem valor válido (vazio ou abaixo do mínimo) */
  invalidas: number[]
}

export function montarPlano(entrada: {
  vencimentoInicial: string
  quantidade: number
  diaVencimento: number
  /** modo "valor fixo": um valor para todos os meses */
  valorFixo?: string
  /** modo "mês a mês": um texto por parcela (índice 0 = parcela 1) */
  valoresMensais?: string[]
  /** true = dezembro leva 13º */
  incluir13: boolean
  /** 13º por parcela (índice da parcela). Vazio = em dobro (13º igual ao valor do mês). */
  valores13?: string[]
}): PlanoParcelas {
  const { vencimentoInicial, quantidade, diaVencimento, incluir13 } = entrada
  const parcelas: ParcelaPlanejada[] = []
  const invalidas: number[] = []
  let total = 0

  for (let i = 0; i < quantidade; i += 1) {
    const vencimento = addMonthsKeepingDay(vencimentoInicial, i, diaVencimento)
    const ehDezembro = vencimento.slice(5, 7) === '12'
    const base = parseValorBR(entrada.valoresMensais ? entrada.valoresMensais[i] : entrada.valorFixo)
    const baseValida = base !== null && base >= VALOR_MINIMO_PARCELA

    let decimoTerceiro = 0
    if (incluir13 && ehDezembro && baseValida) {
      const informado = parseValorBR(entrada.valores13?.[i])
      decimoTerceiro = informado !== null ? informado : base
    }

    const valor = baseValida ? Math.round((base + decimoTerceiro) * 100) / 100 : null
    if (valor === null) invalidas.push(i + 1)
    else total += valor

    parcelas.push({ numero: i + 1, vencimento, mes: rotuloMes(vencimento), ehDezembro, base: baseValida ? base : null, decimoTerceiro, valor })
  }

  return { parcelas, total: Math.round(total * 100) / 100, invalidas }
}
