import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  FERRAMENTAS_PDF_ALLOWED_ROLES,
  createPdfDownloadResponse,
  imageToPdf,
  isFerramentasPdfSupportedTool,
  compressPdf,
  mergePdfs,
  removePagesPdf,
  reorderPdf,
  rotatePdf,
  splitPdf,
} from '@/lib/ferramentas-pdf'
import { FerramentasPdfError, isFerramentasPdfError } from '@/lib/ferramentas-pdf/errors'

export const runtime = 'nodejs'

function getText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return value instanceof File ? value : null
}

async function processTool(tool: string, formData: FormData): Promise<Response> {
  if (!isFerramentasPdfSupportedTool(tool)) {
    return NextResponse.json({ error: 'Ferramenta inválida.' }, { status: 404 })
  }

  switch (tool) {
    case 'merge': {
      const files = formData.getAll('files').filter((item): item is File => item instanceof File)
      if (files.length === 0) {
        throw new FerramentasPdfError('invalid_file', 'Envie pelo menos um PDF.')
      }
      return createPdfDownloadResponse(await mergePdfs(files))
    }
    case 'split': {
      const file = getFile(formData, 'file')
      if (!file) {
        throw new FerramentasPdfError('invalid_file', 'Envie um PDF válido.')
      }
      return createPdfDownloadResponse(await splitPdf(file, getText(formData, 'intervalo')))
    }
    case 'remove-pages': {
      const file = getFile(formData, 'file')
      if (!file) {
        throw new FerramentasPdfError('invalid_file', 'Envie um PDF válido.')
      }
      return createPdfDownloadResponse(await removePagesPdf(file, getText(formData, 'paginas')))
    }
    case 'rotate': {
      const file = getFile(formData, 'file')
      if (!file) {
        throw new FerramentasPdfError('invalid_file', 'Envie um PDF válido.')
      }
      const rotation = Number(getText(formData, 'rotacao')) as 90 | 180 | 270
      if (![90, 180, 270].includes(rotation)) {
        throw new FerramentasPdfError('invalid_pages', 'Escolha uma rotação válida.')
      }
      return createPdfDownloadResponse(await rotatePdf(file, rotation))
    }
    case 'reorder': {
      const file = getFile(formData, 'file')
      if (!file) {
        throw new FerramentasPdfError('invalid_file', 'Envie um PDF válido.')
      }
      return createPdfDownloadResponse(await reorderPdf(file, getText(formData, 'ordem')))
    }
    case 'image-to-pdf': {
      const files = formData.getAll('files').filter((item): item is File => item instanceof File)
      if (files.length === 0) {
        throw new FerramentasPdfError('invalid_file', 'Envie pelo menos uma imagem.')
      }
      return createPdfDownloadResponse(await imageToPdf(files))
    }
    case 'compress': {
      const file = getFile(formData, 'file')
      if (!file) {
        throw new FerramentasPdfError('invalid_file', 'Envie um PDF válido.')
      }
      return createPdfDownloadResponse(await compressPdf(file))
    }
    default:
      return NextResponse.json({ error: 'Ferramenta inválida.' }, { status: 404 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ tool: string }> }) {
  const auth = await apiGuard([...FERRAMENTAS_PDF_ALLOWED_ROLES])
  if (auth instanceof Response) return auth

  const { tool } = await context.params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    return await processTool(tool, formData)
  } catch (error) {
    if (isFerramentasPdfError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Erro ao processar o PDF.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
