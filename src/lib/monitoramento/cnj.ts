// ─── Normalização do número único CNJ (Res. CNJ 65/2008) ─────────────────────
//
// Formato: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)

/** Remove tudo que não for dígito. */
export function somenteDigitos(numero: string): string {
  return numero?.replace(/\D/g, '') ?? ''
}

/**
 * Normaliza para os 20 dígitos do número único CNJ.
 * Retorna null quando a quantidade de dígitos não corresponde ao padrão.
 */
export function normalizarNumeroCNJ(numero: string): string | null {
  const digitos = somenteDigitos(numero)
  return digitos.length === 20 ? digitos : null
}

/** Aplica a máscara NNNNNNN-DD.AAAA.J.TR.OOOO a 20 dígitos. */
export function formatarNumeroCNJ(numero: string): string | null {
  const digitos = normalizarNumeroCNJ(numero)
  if (!digitos) return null
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16, 20)}`
}

/**
 * Valida o dígito verificador do número único CNJ (módulo 97, base 10 — ISO 7064).
 * DV = 98 - ((NNNNNNN AAAA J TR OOOO concatenado com "00") mod 97)
 */
export function validarNumeroCNJ(numero: string): boolean {
  const digitos = normalizarNumeroCNJ(numero)
  if (!digitos) return false

  const sequencial = digitos.slice(0, 7)
  const dv = Number(digitos.slice(7, 9))
  const restante = digitos.slice(9)
  const base = `${sequencial}${restante}00`

  // mod 97 em partes para evitar overflow de Number
  let resto = 0
  for (const char of base) {
    resto = (resto * 10 + Number(char)) % 97
  }

  return 98 - resto === dv
}
