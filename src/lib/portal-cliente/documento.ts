// CPF/CNPJ: normalização e validação por dígito verificador (só dígitos).

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false
  const calc = (base: number) => {
    let soma = 0
    for (let i = 0; i < base; i++) soma += Number(d[i]) * (base + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false
  const calc = (base: number) => {
    const pesos = base === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < base; i++) soma += Number(d[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export type DocumentoNormalizado =
  | { ok: true; digitos: string; tipo: 'cpf' | 'cnpj' }
  | { ok: false }

/** Aceita "123.456.789-09", "12345678909" etc. Só devolve ok com dígito verificador correto. */
export function normalizarDocumento(entrada: unknown): DocumentoNormalizado {
  if (typeof entrada !== 'string' || entrada.length > 40) return { ok: false }
  const digitos = somenteDigitos(entrada)
  if (digitos.length === 11 && cpfValido(digitos)) return { ok: true, digitos, tipo: 'cpf' }
  if (digitos.length === 14 && cnpjValido(digitos)) return { ok: true, digitos, tipo: 'cnpj' }
  return { ok: false }
}

/** Máscara de digitação (CPF até 11 dígitos, CNPJ até 14). */
export function mascararDocumento(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Para e-mails/telas do escritório: só os 2 últimos dígitos aparecem. */
export function documentoParcial(digitos: string): string {
  const d = somenteDigitos(digitos)
  return d.length >= 2 ? `${'•'.repeat(Math.max(d.length - 2, 0))}${d.slice(-2)}` : '••'
}
