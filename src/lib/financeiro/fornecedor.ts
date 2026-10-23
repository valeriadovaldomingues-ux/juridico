import regrasJson from './fornecedor-regras.json'

// Fornecedor preenchido sozinho a partir do nome da despesa ("PAGAMENTO CEMIG" → "CEMIG").
// Regras conhecidas em fornecedor-regras.json (também usadas na carga das despesas de 2026); o resto vem da
// própria descrição, sem as palavras de pagamento. Se não der para tirar nada, usa o nome da despesa mesmo.

interface Regra { se: string; fornecedor: string }
const REGRAS: { re: RegExp; fornecedor: string }[] = (regrasJson.regras as Regra[]).map(r => ({ re: new RegExp(r.se, 'i'), fornecedor: r.fornecedor }))

const PREFIXOS = /^(?:(?:PAGAMENTO|PAGTO\.?|PGTO\.?|PAG\.?|REF\.?|DESP\.?|DESPESAS?|COM|COMPRA|DE|DA|DO|Á|A)\s+)+/i

export function fornecedorDaDescricao(descricao: string | null | undefined): string {
  const original = String(descricao ?? '').replace(/\s+/g, ' ').trim()
  if (!original) return ''
  for (const { re, fornecedor } of REGRAS) {
    const m = re.exec(original)
    if (m) return fornecedor.replace('$1', (m[1] ?? '').toUpperCase())
  }
  // Genérico: tira "PAGAMENTO …" do começo e corta em " - ", " REF", " NF" etc.
  let t = original.replace(PREFIXOS, '')
  t = t.split(/\s+-\s+|\s+REF[. ]|\s+CONF\.|\s+NF\s|\s+\(/i)[0].trim()
  return t.length >= 3 ? t : original
}
