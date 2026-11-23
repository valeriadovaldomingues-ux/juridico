// Monta o PDF único do carnê: uma folha de resumo + os boletos do Inter na ordem das parcelas.
// Usa pdf-lib (já no projeto). Só leitura dos PDFs recebidos; nada é gravado.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export interface ParcelaParaCarne {
  numero: number
  total: number
  vencimento: string // AAAA-MM-DD
  valor: number
  pdf: Uint8Array
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

/** Helvetica padrão só codifica WinAnsi: o que não couber vira "?" em vez de derrubar o PDF. */
function seguro(fonte: PDFFont, texto: string): string {
  let saida = ''
  for (const ch of texto) {
    try {
      fonte.encodeText(ch)
      saida += ch
    } catch {
      saida += '?'
    }
  }
  return saida
}

export async function montarCarnePdf(entrada: { clienteNome: string; descricao: string; parcelas: ParcelaParaCarne[] }): Promise<Uint8Array> {
  const parcelas = [...entrada.parcelas].sort((a, b) => a.numero - b.numero)
  const doc = await PDFDocument.create()
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Folha de resumo ───────────────────────────────────────────────
  const capa = doc.addPage([595, 842])
  const esc = (t: string, x: number, y: number, tam: number, fonte = normal) =>
    capa.drawText(seguro(fonte, t), { x, y, size: tam, font: fonte, color: rgb(0.1, 0.15, 0.2) })
  esc('Carnê de honorários', 50, 780, 20, negrito)
  esc(entrada.clienteNome, 50, 752, 12, negrito)
  esc(entrada.descricao.slice(0, 90), 50, 734, 10)
  esc('Parcela', 50, 700, 10, negrito)
  esc('Vencimento', 150, 700, 10, negrito)
  esc('Valor', 300, 700, 10, negrito)

  let y = 682
  let total = 0
  for (const p of parcelas) {
    if (y < 80) break // resumo de uma página; contratos muito longos seguem só pelos boletos
    esc(`${p.numero}/${p.total}`, 50, y, 10)
    esc(dataBR(p.vencimento), 150, y, 10)
    esc(brl(p.valor), 300, y, 10)
    y -= 16
  }
  for (const p of parcelas) total += p.valor
  esc(`Total: ${brl(Math.round(total * 100) / 100)} em ${parcelas.length} parcela${parcelas.length > 1 ? 's' : ''}`, 50, Math.max(y - 12, 56), 11, negrito)

  // ── Boletos, na ordem ─────────────────────────────────────────────
  for (const p of parcelas) {
    const origem = await PDFDocument.load(p.pdf)
    const paginas = await doc.copyPages(origem, origem.getPageIndices())
    for (const pagina of paginas) doc.addPage(pagina)
  }

  return doc.save()
}
