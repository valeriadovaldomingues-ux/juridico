// ─── Validação de CPF/CNPJ (com dígito verificador) ──────────────────────────
//
// Funções puras, sem rede: usadas no cadastro de documentos monitorados
// (API e tela) e no "colar em lote".

export type TipoDocumento = 'cpf' | 'cnpj'

/** Remove tudo que não for dígito. */
export function soDigitos(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function todosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos)
}

export function validarCpf(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 11 || todosIguais(d)) return false
  for (const tamanho of [9, 10]) {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i)
    const dv = ((soma * 10) % 11) % 10
    if (dv !== Number(d[tamanho])) return false
  }
  return true
}

export function validarCnpj(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 14 || todosIguais(d)) return false
  const calcular = (tamanho: number) => {
    const pesos = tamanho === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return calcular(12) === Number(d[12]) && calcular(13) === Number(d[13])
}

/** 11 dígitos → 'cpf', 14 dígitos → 'cnpj', outro tamanho → null (não valida o dígito verificador). */
export function tipoPorTamanho(valor: string): TipoDocumento | null {
  const d = soDigitos(valor)
  if (d.length === 11) return 'cpf'
  if (d.length === 14) return 'cnpj'
  return null
}

export type ResultadoDocumento =
  | { ok: true; documento: string; tipo: TipoDocumento }
  | { ok: false; erro: string }

/** Valida CPF ou CNPJ (com dígito verificador) e devolve só os dígitos + o tipo. */
export function validarDocumento(valor: string | null | undefined): ResultadoDocumento {
  const documento = soDigitos(valor)
  if (!documento) return { ok: false, erro: 'Informe o CPF ou CNPJ.' }
  const tipo = tipoPorTamanho(documento)
  if (!tipo) return { ok: false, erro: 'CPF deve ter 11 dígitos e CNPJ 14 dígitos.' }
  if (tipo === 'cpf' && !validarCpf(documento)) return { ok: false, erro: 'CPF inválido (dígito verificador não confere).' }
  if (tipo === 'cnpj' && !validarCnpj(documento)) return { ok: false, erro: 'CNPJ inválido (dígito verificador não confere).' }
  return { ok: true, documento, tipo }
}

/** Formata com pontuação (CPF ou CNPJ); devolve o texto original se o tamanho não bater. */
export function formatarDocumento(valor: string): string {
  const d = soDigitos(valor)
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return valor
}
