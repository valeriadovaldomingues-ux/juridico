import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib'
import { compressPdf, imageToPdf, mergePdfs, removePagesPdf, reorderPdf, rotatePdf, splitPdf } from './service'

async function createPdf(pageCount: number, name: string, widths?: number[]) {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    const width = widths?.[index] ?? 200 + index * 10
    pdf.addPage([width, 300])
  }
  const bytes = await pdf.save()
  return new File([bytes], name, { type: 'application/pdf' })
}

function createPngFile(name = 'imagem.png') {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z5UQAAAAASUVORK5CYII=',
    'base64',
  )
  return new File([bytes], name, { type: 'image/png' })
}

function createJpegFile(name = 'imagem.jpg') {
  const bytes = readFileSync('public/logo-pedv-tv.jpeg')
  return new File([bytes], name, { type: 'image/jpeg' })
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

  it('converte imagens em pdf com uma pagina por imagem', async () => {
    const result = await imageToPdf([createJpegFile('a.jpg'), createJpegFile('b.jpeg'), createPngFile('c.png')])
    const loaded = await PDFDocument.load(result.bytes)
    const resources = loaded.getPages()[0].node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)

    expect(result.pageCount).toBe(3)
    expect(loaded.getPageCount()).toBe(3)
    expect(resources).toBeTruthy()
    expect(resources?.keys().length).toBeGreaterThan(0)
  })

  it('comprime pdf localmente sem chamar serviço externo', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await compressPdf(await createPdf(2, 'origem.pdf'))
    const loaded = await PDFDocument.load(result.bytes)

    expect(result.pageCount).toBe(2)
    expect(loaded.getPageCount()).toBe(2)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.notice).toBeTruthy()
  })

  it('rejeita imagem corrompida ao converter para pdf', async () => {
    await expect(imageToPdf([new File([new Uint8Array([1, 2, 3])], 'ruim.jpg', { type: 'image/jpeg' })])).rejects.toThrow('arquivo pode estar corrompido')
  })

  it('rejeita pdf corrompido ao comprimir', async () => {
    await expect(compressPdf(new File([new Uint8Array([1, 2, 3])], 'ruim.pdf', { type: 'application/pdf' }))).rejects.toThrow('corrompido')
  })
})
