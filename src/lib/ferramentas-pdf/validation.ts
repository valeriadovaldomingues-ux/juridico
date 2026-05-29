import { FerramentasPdfError } from './errors'

export const MAX_PDF_FILE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024
export const MAX_MERGE_FILES = 20
export const MAX_IMAGE_FILES = 20
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024

function stripExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, '')
}

export function sanitizeFilenameBase(filename: string): string {
  const base = stripExtension(filename).split(/[\\/]/).pop() ?? 'arquivo'
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'arquivo'
}

export function buildDownloadFilename(sourceFilename: string, suffix: string): string {
  return `${sanitizeFilenameBase(sourceFilename)}${suffix}.pdf`
}

export function assertValidPdfFile(file: File, maxBytes = MAX_PDF_FILE_BYTES): void {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new FerramentasPdfError('invalid_file', 'Envie apenas arquivos PDF.')
  }

  if (file.type !== 'application/pdf') {
    throw new FerramentasPdfError('invalid_file', 'O arquivo enviado precisa ser um PDF válido.')
  }

  if (file.size <= 0) {
    throw new FerramentasPdfError('empty_file', 'O arquivo PDF está vazio.')
  }

  if (file.size > maxBytes) {
    throw new FerramentasPdfError(
      'file_too_large',
      `O arquivo "${file.name}" excede o limite permitido de 25MB.`,
    )
  }
}

export function assertValidImageFile(file: File, maxBytes = MAX_IMAGE_FILE_BYTES): void {
  const extension = file.name.toLowerCase().match(/\.(jpg|jpeg|png)$/)?.[1]
  const mimeType = file.type.toLowerCase()

  if (!extension) {
    throw new FerramentasPdfError('invalid_file', 'Envie apenas imagens JPG, JPEG ou PNG.')
  }

  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
    throw new FerramentasPdfError('invalid_file', 'Envie apenas imagens JPG, JPEG ou PNG.')
  }

  if (file.size <= 0) {
    throw new FerramentasPdfError('empty_file', 'A imagem está vazia.')
  }

  if (file.size > maxBytes) {
    throw new FerramentasPdfError(
      'file_too_large',
      `A imagem "${file.name}" excede o limite permitido de 25MB.`,
    )
  }
}

export function assertImageUploadLimits(files: File[]): void {
  if (files.length === 0) {
    throw new FerramentasPdfError('invalid_file', 'Envie pelo menos uma imagem.')
  }

  if (files.length > MAX_IMAGE_FILES) {
    throw new FerramentasPdfError(
      'too_many_files',
      `A conversão aceita no máximo ${MAX_IMAGE_FILES} imagens por vez.`,
    )
  }

  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_TOTAL_BYTES) {
    throw new FerramentasPdfError(
      'file_too_large',
      'O total das imagens ultrapassa o limite de 100MB por operação.',
    )
  }
}

export function assertMergeLimits(files: File[]): void {
  if (files.length === 0) {
    throw new FerramentasPdfError('invalid_file', 'Envie pelo menos um PDF.')
  }

  if (files.length > MAX_MERGE_FILES) {
    throw new FerramentasPdfError(
      'too_many_files',
      `O merge aceita no máximo ${MAX_MERGE_FILES} arquivos por vez.`,
    )
  }

  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_TOTAL_BYTES) {
    throw new FerramentasPdfError(
      'file_too_large',
      'O total dos arquivos ultrapassa o limite de 100MB por operação.',
    )
  }
}

function parsePositiveInteger(text: string): number {
  const value = Number.parseInt(text, 10)
  if (!Number.isInteger(value) || value < 1) {
    throw new FerramentasPdfError('invalid_pages', 'Informe números de página válidos.')
  }
  return value
}

export function parsePageRange(text: string): { start: number; end: number } {
  const normalized = text.replace(/\s+/g, '')
  const match = normalized.match(/^(\d+)-(\d+)$/)
  if (!match) {
    throw new FerramentasPdfError('invalid_pages', 'Use um intervalo válido como 1-3.')
  }

  const start = parsePositiveInteger(match[1])
  const end = parsePositiveInteger(match[2])
  if (end < start) {
    throw new FerramentasPdfError('invalid_pages', 'O intervalo de páginas é inválido.')
  }

  return { start, end }
}

export function parsePageSet(text: string): number[] {
  const normalized = text.replace(/\s+/g, '')
  if (!normalized) {
    throw new FerramentasPdfError('invalid_pages', 'Informe as páginas que deseja processar.')
  }

  const pages = new Set<number>()

  for (const token of normalized.split(',')) {
    if (!token) continue
    if (token.includes('-')) {
      const { start, end } = parsePageRange(token)
      for (let page = start; page <= end; page += 1) {
        pages.add(page)
      }
      continue
    }

    pages.add(parsePositiveInteger(token))
  }

  if (pages.size === 0) {
    throw new FerramentasPdfError('invalid_pages', 'Informe páginas válidas.')
  }

  return [...pages].sort((a, b) => a - b)
}

export function parsePageOrder(text: string): number[] {
  const normalized = text.replace(/\s+/g, '')
  if (!normalized) {
    throw new FerramentasPdfError('invalid_pages', 'Informe uma nova ordem de páginas.')
  }

  const order = normalized.split(',').map(parsePositiveInteger)
  if (order.length === 0) {
    throw new FerramentasPdfError('invalid_pages', 'Informe uma nova ordem de páginas.')
  }

  return order
}
