import extenso from 'extenso'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "R$ 1.621,00" — formatação padrão BRL usada nos recibos. */
export function formatarValorBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Valor por extenso em português, no formato usado nos recibos originais
 * (com vírgula após "mil"/"milhão" antes do restante — ex: "dezesseis mil,
 * quatrocentos e dezenove reais e sessenta e cinco centavos").
 */
export function valorPorExtenso(valor: number): string {
  const texto = extenso(Math.max(0, valor), { mode: 'currency' }) as string
  return texto.replace(/\b(mil|milhão|milhões)\s+(?=\S)/, '$1, ')
}

export function mesReferenciaLabel(mesReferencia: string): string {
  const [, m] = mesReferencia.split('-').map(Number)
  return MESES[m - 1]
}

/** "15 de agosto de 2026" — dia 15 do mês de referência, convenção usada nos recibos. */
export function dataAssinaturaExtenso(mesReferencia: string, dia = 15): string {
  const [y, m] = mesReferencia.split('-').map(Number)
  return `${dia} de ${MESES[m - 1]} de ${y}`
}

/** Período de benefício (transporte/alimentação): 16 do mês de ref. a 15 do mês seguinte. */
export function periodoBeneficio(mesReferencia: string): { inicio: string; fim: string } {
  const [y, m] = mesReferencia.split('-').map(Number)
  const fimData = new Date(y, m, 15) // dia 15 do mês seguinte
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    inicio: `16.${pad(m)}.${y}`,
    fim: `${pad(fimData.getDate())}.${pad(fimData.getMonth() + 1)}.${fimData.getFullYear()}`,
  }
}
