// Valor da hora (valor_hora) e valor estimado (valor_total) dos lançamentos de horas: só os sócios veem e definem.
// A equipe lança e vê o TEMPO; o dinheiro fica de fora das telas e das respostas das APIs.
// (Decisão de 18/11/2026. O banco guarda as duas colunas na mesma linha do tempo, então o corte é feito aqui.)

export function podeVerValorHoras(role: string | null | undefined): boolean {
  return role === 'socio'
}

/** Remove os valores em R$ de um lançamento (ou lista) quando quem lê não é sócio. */
export function semValorDeHoras<T>(role: string | null | undefined, entrada: T): T
export function semValorDeHoras<T>(role: string | null | undefined, entrada: T[]): T[]
export function semValorDeHoras(role: string | null | undefined, entrada: unknown): unknown {
  if (podeVerValorHoras(role) || entrada == null) return entrada
  const limpar = (e: unknown) => (e && typeof e === 'object' ? { ...(e as object), valor_hora: null, valor_total: null } : e)
  return Array.isArray(entrada) ? entrada.map(limpar) : limpar(entrada)
}
