import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { mergePdfs, removePagesPdf, reorderPdf, rotatePdf, splitPdf } from './service'

async function createPdf(pageCount: number, name: string, widths?: number[]) {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    const width = widths?.[index] ?? 200 + index * 10
    pdf.addPage([width, 300])
  }
  const bytes = await pdf.save()
  return new File([bytes], name, { type: 'application/pdf' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Ferramentas PDF service', () => {
  it('junta múltiplos PDFs em um arquivo só', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await mergePdfs([
      await createPdf(1, 'a.pdf'),
      await createPdf(2, 'b.pdf'),
    ])

    expect(result.pageCount).toBe(3)
    expect(result.filename).toContain('juntado')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('separa um intervalo de páginas', async () => {
    const result = await splitPdf(await createPdf(5, 'origem.pdf'), '2-4')
    const loaded = await PDFDocument.load(result.bytes)

    expect(result.pageCount).toBe(3)
    expect(loaded.getPageCount()).toBe(3)
  })

  it('remove páginas informadas', async () => {
    const result = await removePagesPdf(await createPdf(5, 'origem.pdf'), '1,3,5')
    const loaded = await PDFDocument.load(result.bytes)

    expect(result.pageCount).toBe(2)
    expect(loaded.getPageCount()).toBe(2)
  })

  it('gira todas as páginas', async () => {
    const result = await rotatePdf(await createPdf(1, 'origem.pdf'), 180)
    const loaded = await PDFDocument.load(result.bytes)

    expect(loaded.getPages()[0].getRotation().angle).toBe(180)
  })

  it('reorganiza páginas na nova ordem', async () => {
    const result = await reorderPdf(await createPdf(4, 'origem.pdf', [200, 210, 220, 230]), '3,1,2,4')
    const loaded = await PDFDocument.load(result.bytes)
    const widths = loaded.getPages().map(page => page.getWidth())

    expect(result.pageCount).toBe(4)
    expect(widths).toEqual([220, 200, 210, 230])
  })
})
