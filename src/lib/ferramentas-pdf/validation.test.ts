import { describe, expect, it } from 'vitest'
import { FerramentasPdfError } from './errors'
import {
  MAX_PDF_FILE_BYTES,
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_FILES,
  assertImageUploadLimits,
  assertValidPdfFile,
  assertValidImageFile,
  parsePageOrder,
  parsePageRange,
  parsePageSet,
  sanitizeFilenameBase,
} from './validation'

function pdfFile(name = 'arquivo.pdf', size = 1024) {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' })
}

describe('Ferramentas PDF validation', () => {
  it('aceita pdf válido', () => {
    expect(() => assertValidPdfFile(pdfFile())).not.toThrow()
  })

  it('rejeita arquivo não-pdf', () => {
    expect(() => assertValidPdfFile(new File(['abc'], 'texto.txt', { type: 'text/plain' }))).toThrow(FerramentasPdfError)
  })

  it('rejeita arquivo vazio', () => {
    expect(() => assertValidPdfFile(pdfFile('vazio.pdf', 0))).toThrow('vazio')
  })

  it('rejeita arquivo maior que o limite', () => {
    expect(() => assertValidPdfFile(pdfFile('grande.pdf', MAX_PDF_FILE_BYTES + 1))).toThrow('25MB')
  })

  it('aceita imagem válida', () => {
    expect(() => assertValidImageFile(new File([new Uint8Array(10)], 'foto.jpg', { type: 'image/jpeg' }))).not.toThrow()
    expect(() => assertValidImageFile(new File([new Uint8Array(10)], 'foto.jpeg', { type: 'image/jpeg' }))).not.toThrow()
    expect(() => assertValidImageFile(new File([new Uint8Array(10)], 'foto.png', { type: 'image/png' }))).not.toThrow()
  })

  it('rejeita imagem inválida ou vazia', () => {
    expect(() => assertValidImageFile(new File([new Uint8Array(10)], 'foto.gif', { type: 'image/gif' }))).toThrow('JPG, JPEG ou PNG')
    expect(() => assertValidImageFile(new File([new Uint8Array(0)], 'vazia.jpg', { type: 'image/jpeg' }))).toThrow('vazia')
    expect(() => assertValidImageFile({ name: 'gigante.jpg', type: 'image/jpeg', size: MAX_IMAGE_FILE_BYTES + 1 } as File)).toThrow('25MB')
  })

  it('respeita limites de upload de imagens', () => {
    const files = Array.from({ length: MAX_IMAGE_FILES }, (_, index) => new File([new Uint8Array(10)], `foto-${index}.png`, { type: 'image/png' }))
    expect(() => assertImageUploadLimits(files)).not.toThrow()
    expect(() => assertImageUploadLimits([...files, new File([new Uint8Array(10)], 'extra.png', { type: 'image/png' })])).toThrow('20')
    expect(() => assertImageUploadLimits([
      { name: 'gigante.png', type: 'image/png', size: 60 * 1024 * 1024 } as File,
      { name: 'gigante2.png', type: 'image/png', size: 50 * 1024 * 1024 } as File,
    ])).toThrow('100MB')
  })

  it('faz parse de intervalo de páginas', () => {
    expect(parsePageRange('1-3')).toEqual({ start: 1, end: 3 })
  })

  it('faz parse de conjunto de páginas', () => {
    expect(parsePageSet('1,3,5')).toEqual([1, 3, 5])
    expect(parsePageSet('2-4')).toEqual([2, 3, 4])
  })

  it('faz parse da nova ordem', () => {
    expect(parsePageOrder('3,1,2,4')).toEqual([3, 1, 2, 4])
  })

  it('sanitiza nomes de arquivo', () => {
    expect(sanitizeFilenameBase('../Meu arquivo final.pdf')).toBe('Meu-arquivo-final')
  })
})
