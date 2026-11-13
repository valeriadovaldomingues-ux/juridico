import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { embedCarlito, TAM_TEXTO } from './fonte'

describe('fonte padrão dos PDFs (Carlito = Calibri)', () => {
  it('o tamanho padrão do texto é 12', () => {
    expect(TAM_TEXTO).toBe(12)
  })

  it('embute normal e negrito e escreve acentos e "ti" sem erro', async () => {
    const pdf = await PDFDocument.create()
    const { regular, negrito } = await embedCarlito(pdf)
    const texto = 'Petição, ação, ótimo: Débora Brito – Ç ã õ é'
    const pagina = pdf.addPage([595, 842])
    pagina.drawText(texto, { x: 72, y: 700, size: TAM_TEXTO, font: regular })
    pagina.drawText(texto, { x: 72, y: 680, size: TAM_TEXTO, font: negrito })
    expect(regular.widthOfTextAtSize(texto, TAM_TEXTO)).toBeGreaterThan(100)
    expect(negrito.widthOfTextAtSize('ti', TAM_TEXTO)).toBeGreaterThan(0)
    const lido = await PDFDocument.load(await pdf.save())
    expect(lido.getPageCount()).toBe(1)
  })
})
