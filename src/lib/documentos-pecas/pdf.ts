import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

// Margens reais extraídas do docx da folha timbrada oficial (Folha-Padrao-Fundo-Branco1.docx):
// top 3685 twips, bottom 2041 twips, left/right 1440 twips. 1 twip = 1/20pt.
const PAGE_WIDTH  = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN_TOP    = (3685 / 20)
const MARGIN_BOTTOM = (2041 / 20)
const MARGIN_SIDE   = (1440 / 20)
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_SIDE * 2
const LINE_HEIGHT   = 15.5

let _logoBytes: Buffer | null = null
async function getLogoBytes() {
  if (_logoBytes) return _logoBytes
  _logoBytes = await fs.readFile(path.join(process.cwd(), 'public/documentos/folha-timbrada.png'))
  return _logoBytes
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) { current = next; continue }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

export interface Assinante {
  nome: string
  linha2?: string // ex: "OAB/MG 88.465" ou "CPF/MF nº 000.000.000-00"
}

export interface PecaPdfParams {
  titulo:      string   // ex: "PROCURAÇÃO" — vira espaçado (P R O C U R A Ç Ã O)
  paragrafos:  string[] // cada item é um parágrafo (pode ter múltiplas linhas após wrap)
  localData:   string   // ex: "Belo Horizonte, 15 de setembro de 2026."
  assinantes:  Assinante[] // 1 (hipossuficiência/procuração) ou 2 (petição, lado a lado)
}

export async function gerarPecaPdfBytes(params: PecaPdfParams): Promise<Uint8Array> {
  const { titulo, paragrafos, localData, assinantes } = params

  const pdf = await PDFDocument.create()
  const font     = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const logoImg  = await pdf.embedPng(await getLogoBytes())

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN_TOP

  function novaPagina() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawImage(logoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT })
    y = PAGE_HEIGHT - MARGIN_TOP
  }

  // Fundo timbrado na primeira página
  page.drawImage(logoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT })

  function garantirEspaco(altura: number) {
    if (y - altura < MARGIN_BOTTOM) novaPagina()
  }

  function desenharLinha(texto: string, opts?: { size?: number; font?: PDFFont; x?: number }) {
    const size = opts?.size ?? 12
    const f    = opts?.font ?? font
    garantirEspaco(LINE_HEIGHT)
    page.drawText(texto, { x: opts?.x ?? MARGIN_SIDE, y, size, font: f, color: rgb(0, 0, 0) })
    y -= LINE_HEIGHT
  }

  function desenharParagrafo(texto: string, opts?: { size?: number; font?: PDFFont; centralizado?: boolean }) {
    const size = opts?.size ?? 12
    const f    = opts?.font ?? font
    const lines = wrapText(texto, f, size, CONTENT_WIDTH)
    lines.forEach(line => {
      garantirEspaco(LINE_HEIGHT)
      const x = opts?.centralizado
        ? (PAGE_WIDTH - f.widthOfTextAtSize(line, size)) / 2
        : MARGIN_SIDE
      page.drawText(line, { x, y, size, font: f, color: rgb(0, 0, 0) })
      y -= LINE_HEIGHT
    })
  }

  // Título espaçado, centralizado
  const tituloEspacado = titulo.split('').join(' ')
  desenharLinha(tituloEspacado, {
    size: 14, font: fontBold,
    x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(tituloEspacado, 14)) / 2,
  })
  y -= LINE_HEIGHT

  paragrafos.forEach((paragrafo, i) => {
    desenharParagrafo(paragrafo)
    if (i < paragrafos.length - 1) y -= LINE_HEIGHT * 0.6
  })

  y -= LINE_HEIGHT
  desenharParagrafo(localData)

  // Bloco(s) de assinatura
  garantirEspaco(LINE_HEIGHT * 5)
  y -= LINE_HEIGHT * 3

  if (assinantes.length === 1) {
    const a = assinantes[0]
    const linha = '_'.repeat(50)
    desenharLinha(linha, { x: (PAGE_WIDTH - font.widthOfTextAtSize(linha, 12)) / 2 })
    const nomeUpper = a.nome.toUpperCase()
    desenharLinha(nomeUpper, { x: (PAGE_WIDTH - font.widthOfTextAtSize(nomeUpper, 12)) / 2 })
    if (a.linha2) {
      desenharLinha(a.linha2, { size: 11, x: (PAGE_WIDTH - font.widthOfTextAtSize(a.linha2, 11)) / 2 })
    }
  } else {
    // duas assinaturas lado a lado (petição — sócios)
    const colWidth = CONTENT_WIDTH / 2
    const linhaW = 50
    const linha = '_'.repeat(linhaW)
    garantirEspaco(LINE_HEIGHT * 3)
    const yAssin = y
    assinantes.forEach((a, i) => {
      const xCol = MARGIN_SIDE + i * colWidth
      page.drawText(linha, { x: xCol, y: yAssin, size: 12, font })
      page.drawText(a.nome, { x: xCol, y: yAssin - LINE_HEIGHT, size: 11, font })
      if (a.linha2) page.drawText(a.linha2, { x: xCol, y: yAssin - LINE_HEIGHT * 2, size: 10, font })
    })
    y = yAssin - LINE_HEIGHT * 2.5
  }

  return pdf.save()
}
