/**
 * src/lib/cnpj.ts
 *
 * Utilitários de CPF/CNPJ para busca jurídica inteligente.
 * Sem side-effects — funciona em browser e servidor.
 */

// ── Normalização ──────────────────────────────────────────────────────────────

/** Remove qualquer caractere que não seja dígito. */
export function normalizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, '')
}

/** Retorna os 8 primeiros dígitos de um CNPJ (raiz do grupo econômico). */
export function getCnpjRoot(cnpj: string): string {
  return normalizeCpfCnpj(cnpj).slice(0, 8)
}

/** Formata 14 dígitos como CNPJ: XX.XXX.XXX/XXXX-XX */
export function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 14) return digits
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`
}

/** Formata 11 dígitos como CPF: XXX.XXX.XXX-XX */
export function formatCpf(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 11) return digits
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`
}

// ── Detecção de tipo ──────────────────────────────────────────────────────────

export type DocSearchType =
  | 'cnpj_full'   // 14 dígitos → CNPJ completo
  | 'cpf_full'    // 11 dígitos → CPF completo
  | 'cnpj_root'   // 8 dígitos  → raiz de CNPJ
  | 'partial_doc' // 2-13 dígitos → fragmento numérico
  | 'text'        // não-numérico  → busca textual

/**
 * Detecta o tipo de busca a partir do input do usuário.
 *
 * @example
 * detectDocSearchType('12.345.678/0001-90') // → 'cnpj_full'
 * detectDocSearchType('12345678')           // → 'cnpj_root'
 * detectDocSearchType('Martins')            // → 'text'
 */
export function detectDocSearchType(input: string): DocSearchType {
  const digits = normalizeCpfCnpj(input)

  if (!digits) return 'text'

  // Se o input tiver letras além de dígitos e pontuação → texto
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(input)
  if (hasLetters) return 'text'

  if (digits.length === 14) return 'cnpj_full'
  if (digits.length === 11) return 'cpf_full'
  if (digits.length === 8)  return 'cnpj_root'
  if (digits.length >= 2)   return 'partial_doc'

  return 'text'
}

// ── Normalização de texto para busca ─────────────────────────────────────────

/**
 * Normaliza texto para busca: lowercase, remove acentos, colapsa espaços.
 *
 * @example
 * normalizeSearchText('João Peçanha') // → 'joao pecanha'
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')  // remove acentos
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Escapa caracteres especiais do LIKE do PostgreSQL (`%` e `_`).
 * Necessário quando o valor do usuário entra em uma expressão ILIKE.
 */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}
