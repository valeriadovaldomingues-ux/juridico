import { degrees, PDFDocument } from 'pdf-lib'
import { FerramentasPdfError, isFerramentasPdfError } from './errors'
import {
  assertMergeLimits,
  assertValidPdfFile,
  buildDownloadFilename,
  parsePageOrder,
  parsePageRange,
  parsePageSet,
  sanitizeFilenameBase,
} from './validation'
import type { FerramentasPdfActionResult, FerramentasPdfReadOnlyToolName } from './types'

async function loadPdfDocument(file: File): Promise<{
  document: PDFDocument
  pageCount: number
  sourceFilename: string
}> {
  assertValidPdfFile(file)

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const document = await PDFDocument.load(bytes)
    return {
      document,
      pageCount: document.getPageCount(),
      sourceFilename: file.name,
    }
  } catch (error) {
    if (isFerramentasPdfError(error)) throw error
    throw new FerramentasPdfError('corrupted_pdf', 'Não foi possível ler esse PDF. O arquivo pode estar corrompido.')
  }
}

async function finishPdf(document: PDFDocument, filename: string): Promise<FerramentasPdfActionResult> {
  const bytes = await document.save()
  return {
    bytes,
    filename,
    pageCount: document.getPageCount(),
  }
}

export async function mergePdfs(files: File[]): Promise<FerramentasPdfActionResult> {
  assertMergeLimits(files)

  const output = await PDFDocument.create()

  for (const file of files) {
    const { document } = await loadPdfDocument(file)
    const indices = document.getPageIndices()
    const copiedPages = await output.copyPages(document, indices)
    copiedPages.forEach(page => output.addPage(page))
  }

  const firstName = files[0]?.name ?? 'pdf'
  return finishPdf(output, buildDownloadFilename(firstName, '-juntado'))
}

export async function splitPdf(file: File, intervalo: string): Promise<FerramentasPdfActionResult> {
  const { document, pageCount, sourceFilename } = await loadPdfDocument(file)
  const { start, end } = parsePageRange(intervalo)

  if (start > pageCount || end > pageCount) {
    throw new FerramentasPdfError('invalid_pages', `O arquivo tem apenas ${pageCount} páginas.`)
  }

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(document, Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index))
  copiedPages.forEach(page => output.addPage(page))

  return finishPdf(output, buildDownloadFilename(sourceFilename, `-paginas-${start}-${end}`))
}

export async function removePagesPdf(file: File, paginas: string): Promise<FerramentasPdfActionResult> {
  const { document, pageCount, sourceFilename } = await loadPdfDocument(file)
  const pagesToRemove = new Set(parsePageSet(paginas))

  for (const page of pagesToRemove) {
    if (page > pageCount) {
      throw new FerramentasPdfError('invalid_pages', `O arquivo tem apenas ${pageCount} páginas.`)
    }
  }

  const keepIndices = document.getPageIndices().filter(index => !pagesToRemove.has(index + 1))
  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(document, keepIndices)
  copiedPages.forEach(page => output.addPage(page))

  return finishPdf(output, buildDownloadFilename(sourceFilename, '-sem-paginas'))
}

export async function rotatePdf(file: File, rotacao: 90 | 180 | 270): Promise<FerramentasPdfActionResult> {
  const { document, sourceFilename } = await loadPdfDocument(file)
  const pages = document.getPages()
  const angle = degrees(rotacao)

  pages.forEach(page => {
    page.setRotation(angle)
  })

  return finishPdf(document, buildDownloadFilename(sourceFilename, `-rotacionado-${rotacao}`))
}

export async function reorderPdf(file: File, ordem: string): Promise<FerramentasPdfActionResult> {
  const { document, pageCount, sourceFilename } = await loadPdfDocument(file)
  const order = parsePageOrder(ordem)
  const expected = new Set(Array.from({ length: pageCount }, (_, index) => index + 1))
  const given = new Set(order)

  if (order.length !== pageCount || given.size !== pageCount || [...expected].some(page => !given.has(page))) {
    throw new FerramentasPdfError(
      'invalid_pages',
      `A nova ordem deve conter exatamente as ${pageCount} páginas do arquivo, sem repetir números.`,
    )
  }

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(document, order.map(page => page - 1))
  copiedPages.forEach(page => output.addPage(page))

  return finishPdf(output, buildDownloadFilename(sourceFilename, '-reorganizado'))
}

export function createPdfDownloadResponse(result: FerramentasPdfActionResult): Response {
  const body = Buffer.from(result.bytes) as BodyInit

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${sanitizeFilenameBase(result.filename)}.pdf"`,
      'cache-control': 'no-store',
      'x-ferramentas-pdf-pages': String(result.pageCount),
    },
  })
}

export function isFerramentasPdfReadOnlyTool(tool: string): tool is FerramentasPdfReadOnlyToolName {
  return tool === 'merge'
    || tool === 'split'
    || tool === 'remove-pages'
    || tool === 'rotate'
    || tool === 'reorder'
}
