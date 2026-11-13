import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import { embedCarlito, TAM_TEXTO } from '@/lib/pdf/fonte'
import type { RelatorioClienteDraft } from './types'
import { buildRelatorioPdfSubtitle } from './service'
import { normalizeRelatorioConteudo } from './validation'

type PdfSource = {
  processoTitulo: string
  clienteNome: string
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  const measure = (value: string) => font.widthOfTextAtSize(value, fontSize)

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next) <= maxWidth) {
      current = next
      continue
    }

    if (current) lines.push(current)

    if (measure(word) > maxWidth) {
      let chunk = ''
      for (const char of word) {
        const candidate = chunk + char
        if (measure(candidate) > maxWidth && chunk) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk = candidate
        }
      }
      current = chunk
    } else {
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function normalizeParagraphs(value: string | string[]) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

export async function gerarRelatorioPdfBytes(relatorio: RelatorioClienteDraft, fonte: PdfSource) {
  const conteudo = normalizeRelatorioConteudo(relatorio.conteudo)
  const pdf = await PDFDocument.create()
  const { regular: fontRegular, negrito: fontBold } = await embedCarlito(pdf)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const lineHeight = 16
  const sectionSpacing = 14

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function drawLine(text: string, font = fontRegular, size = TAM_TEXTO, color = rgb(0.13, 0.16, 0.2), x = margin) {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color,
    })
  }

  function ensureSpace(required: number) {
    if (y - required < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawWrappedText(text: string, size = TAM_TEXTO, font = fontRegular, leading = lineHeight) {
    const paragraphs = normalizeParagraphs(text)
    paragraphs.forEach((paragraph, index) => {
      const lines = wrapText(paragraph, font, size, contentWidth)
      lines.forEach(line => {
        ensureSpace(leading)
        drawLine(line, font, size)
        y -= leading
      })
      if (index < paragraphs.length - 1) {
        y -= 4
      }
    })
  }

  function drawSection(title: string, content: string | string[]) {
    const paragraphs = Array.isArray(content)
      ? content.filter(Boolean)
      : content.trim()
        ? content.split('\n').map(item => item.trim()).filter(Boolean)
        : []

    const estimatedHeight = 26 + Math.max(1, paragraphs.length) * lineHeight * 2
    ensureSpace(estimatedHeight)

    y -= 6
    drawLine(title, fontBold, TAM_TEXTO, rgb(0.08, 0.36, 0.37))
    y -= 18

    if (paragraphs.length === 0) {
      drawWrappedText('—')
      y -= sectionSpacing
      return
    }

    paragraphs.forEach(paragraph => {
      const bullet = paragraph.startsWith('-') ? paragraph : `• ${paragraph}`
      const lines = wrapText(bullet, fontRegular, TAM_TEXTO, contentWidth)
      lines.forEach(line => {
        ensureSpace(lineHeight)
        drawLine(line, fontRegular, TAM_TEXTO)
        y -= lineHeight
      })
    })

    y -= sectionSpacing
  }

  // Header
  const headerHeight = 104
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: rgb(0.08, 0.22, 0.29),
  })

  drawLine('Pessoa e do Val Advocacia', fontBold, 16, rgb(1, 1, 1), margin)
  y = pageHeight - margin - 28
  drawLine(relatorio.titulo, fontBold, 14, rgb(1, 1, 1))
  y -= 18
  drawLine(`${fonte.clienteNome} · ${fonte.processoTitulo}`, fontRegular, TAM_TEXTO, rgb(0.9, 0.95, 0.96))
  y -= 14
  drawLine(buildRelatorioPdfSubtitle(relatorio), fontRegular, TAM_TEXTO, rgb(0.9, 0.95, 0.96))

  y = pageHeight - headerHeight - 22

  // Body
  drawSection('RESUMO EXECUTIVO', relatorio.resumo_executivo || conteudo.resumoExecutivo)
  drawSection('PRINCIPAIS MOVIMENTAÇÕES', conteudo.principaisMovimentacoes)
  drawSection('SITUAÇÃO ATUAL', conteudo.situacaoAtual)
  drawSection('O QUE ISSO SIGNIFICA', conteudo.oQueIssoSignifica)
  drawSection('PRÓXIMOS PASSOS', conteudo.proximosPassos)
  drawSection('PROVIDÊNCIAS DO CLIENTE', conteudo.providenciasCliente || 'Nenhuma providência é necessária neste momento.')

  // Footer on every page
  const pages = pdf.getPages()
  pages.forEach((p, index) => {
    const footerY = 28
    p.drawText('Relatório gerado pelo Sistema PEDV', {
      x: margin,
      y: footerY + 14,
      size: TAM_TEXTO,
      font: fontRegular,
      color: rgb(0.42, 0.48, 0.55),
    })
    p.drawText('Revisado pela equipe jurídica', {
      x: margin,
      y: footerY,
      size: TAM_TEXTO,
      font: fontRegular,
      color: rgb(0.42, 0.48, 0.55),
    })
    p.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: pageWidth - margin - 84,
      y: footerY + 7,
      size: TAM_TEXTO,
      font: fontRegular,
      color: rgb(0.42, 0.48, 0.55),
    })
  })

  return pdf.save()
}
