// ─── Normalização de números de OAB ──────────────────────────────────────────
//
// Reconhece como o mesmo registro formas como:
//   OAB/MG 123.456 · MG123456 · 123456-MG · 123.456/MG · OAB MG 123456

const UFS = new Set([
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO',
])

export interface OABNormalizada {
  numero: string
  uf: string
}

/**
 * Normaliza uma OAB em qualquer formato usual para { numero, uf }.
 * Retorna null quando não há número ou a UF não pode ser determinada
 * (nem via texto, nem via ufPadrao).
 */
export function normalizarOAB(valor: string, ufPadrao?: string): OABNormalizada | null {
  if (!valor?.trim()) return null

  const texto = valor.toUpperCase()
  const numero = texto.replace(/\D/g, '').replace(/^0+/, '')
  if (!numero) return null

  // Procura uma UF válida fora da palavra "OAB"
  const semOab = texto.replace(/\bOAB\b/g, ' ')
  const candidatos = semOab.match(/[A-Z]{2}/g) ?? []
  const uf = candidatos.find(item => UFS.has(item))
    ?? (ufPadrao && UFS.has(ufPadrao.toUpperCase()) ? ufPadrao.toUpperCase() : undefined)

  if (!uf) return null
  return { numero, uf }
}

/** Chave canônica para comparação/deduplicação: "MG123456". */
export function chaveOAB(oab: OABNormalizada): string {
  return `${oab.uf}${oab.numero}`
}

/** Formato de exibição: "OAB/MG 123456". */
export function formatarOAB(oab: OABNormalizada): string {
  return `OAB/${oab.uf} ${oab.numero}`
}

/** True quando os dois valores representam o mesmo registro de OAB. */
export function mesmaOAB(a: string, b: string, ufPadrao?: string): boolean {
  const na = normalizarOAB(a, ufPadrao)
  const nb = normalizarOAB(b, ufPadrao)
  if (!na || !nb) return false
  return chaveOAB(na) === chaveOAB(nb)
}
