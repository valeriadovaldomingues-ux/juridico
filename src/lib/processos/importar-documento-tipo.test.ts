import { describe, expect, it, vi } from 'vitest'

vi.mock('officeparser', () => ({ parseOffice: vi.fn() }))
vi.mock('@/lib/ai/service', () => ({ completarJSON: vi.fn() }))

import { tipoArquivoParaLeitor } from './importar-documento.server'

const bytes = (...b: number[]) => new Uint8Array(b)

describe('tipoArquivoParaLeitor', () => {
  it('reconhece PDF e DOCX pelos primeiros bytes, mesmo com nome estranho', () => {
    expect(tipoArquivoParaLeitor(bytes(0x25, 0x50, 0x44, 0x46, 1), 'ata.bin')).toBe('pdf')
    expect(tipoArquivoParaLeitor(bytes(0x50, 0x4b, 3, 4), 'ata.docx')).toBe('docx')
    expect(tipoArquivoParaLeitor(bytes(0x50, 0x4b, 3, 4), 'ata (1).DOCX')).toBe('docx')
  })
  it('sem assinatura reconhecida usa a extensão; DOC legado fica sem aviso', () => {
    expect(tipoArquivoParaLeitor(bytes(1, 2, 3, 4), 'ata.pdf')).toBe('pdf')
    expect(tipoArquivoParaLeitor(bytes(0xd0, 0xcf, 0x11, 0xe0), 'ata.doc')).toBeUndefined()
  })
})
