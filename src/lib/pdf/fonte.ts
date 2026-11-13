import fontkit from '@pdf-lib/fontkit'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { PDFDocument, PDFFont } from 'pdf-lib'

// Fonte padrão de todos os PDFs do PEDV: Calibri 12 (pedido da Valéria, 12/11/2026).
// O Calibri é da Microsoft e não pode ser embutido; usamos o Carlito (licença OFL), que tem as mesmas medidas e o mesmo desenho.
// Os arquivos ficam em public/fonts (licença em OFL-Carlito.txt).
export const TAM_TEXTO = 12

export interface FontesCarlito { regular: PDFFont; negrito: PDFFont }

const cache = new Map<string, Buffer>()
async function lerFonte(arquivo: string): Promise<Buffer> {
  const guardada = cache.get(arquivo)
  if (guardada) return guardada
  const bytes = await fs.readFile(path.join(process.cwd(), 'public/fonts', arquivo))
  cache.set(arquivo, bytes)
  return bytes
}

/**
 * Registra o fontkit e embute o Carlito normal e negrito.
 * Fonte inteira (sem subset): o recorte do fontkit perde letras no Carlito. Ligaturas desligadas: a ligatura "ti" saía em branco
 * ("petição" virava "peti ção").
 */
export async function embedCarlito(pdf: PDFDocument): Promise<FontesCarlito> {
  pdf.registerFontkit(fontkit)
  const opcoes = { subset: false, features: { liga: false, clig: false, dlig: false, calt: false } }
  const [regular, negrito] = await Promise.all(
    ['Carlito-Regular.ttf', 'Carlito-Bold.ttf'].map(async arquivo => pdf.embedFont(await lerFonte(arquivo), opcoes)),
  )
  return { regular, negrito }
}
