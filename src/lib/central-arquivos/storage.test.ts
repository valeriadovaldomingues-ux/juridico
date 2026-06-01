import { describe, expect, it } from 'vitest'
import {
  assertAllowedCentralArquivoFile,
  assertAllowedCentralArquivosBatch,
  buildCentralArquivosStoragePath,
} from './storage'

function fileOf(name: string, type: string, size = 128) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('central-arquivos storage helpers', () => {
  it('aceita arquivos permitidos', () => {
    expect(() => assertAllowedCentralArquivoFile(fileOf('contrato.pdf', 'application/pdf'))).not.toThrow()
    expect(() => assertAllowedCentralArquivoFile(fileOf('imagem.jpg', 'image/jpeg'))).not.toThrow()
    expect(() => assertAllowedCentralArquivoFile(fileOf('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))).not.toThrow()
  })

  it('rejeita formato, mime e tamanho inválidos', () => {
    expect(() => assertAllowedCentralArquivoFile(fileOf('script.exe', 'application/octet-stream'))).toThrow('Formato de arquivo não permitido.')
    expect(() => assertAllowedCentralArquivoFile(fileOf('contrato.pdf', 'application/x-msdownload'))).toThrow('Tipo MIME não permitido.')
    expect(() => assertAllowedCentralArquivoFile(fileOf('vazio.pdf', 'application/pdf', 0))).toThrow('O arquivo está vazio.')
  })

  it('rejeita batch acima do limite total', () => {
    const huge = fileOf('grande.pdf', 'application/pdf', 1)
    Object.defineProperty(huge, 'size', {
      value: 101 * 1024 * 1024,
    })
    expect(() => assertAllowedCentralArquivosBatch([huge])).toThrow('O total de arquivos excede o limite de 100MB.')
  })

  it('gera storage path seguro sem path traversal', () => {
    const path = buildCentralArquivosStoragePath({
      originalName: '../../segredo/contrato final.pdf',
      folderId: '../pasta',
      prefix: 'docs',
    })

    expect(path).toContain('docs/')
    expect(path).not.toContain('..')
    expect(path).toMatch(/\.pdf$/)
  })
})
