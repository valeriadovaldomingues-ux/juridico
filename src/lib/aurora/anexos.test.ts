import { describe, expect, it } from 'vitest'
import { montarContextoAnexosAurora } from './anexos'

describe('montarContextoAnexosAurora', () => {
  it('descreve anexos com metadados mínimos e indicação de destino', () => {
    const contexto = montarContextoAnexosAurora([
      {
        id: 'doc-1',
        nome_original: 'contrato.pdf',
        tipo_mime: 'application/pdf',
        extensao: 'pdf',
        tamanho_bytes: 1024,
        storage_bucket: 'central-arquivos',
        storage_path: 'docs/2026/06/01/contrato.pdf',
        categoria: 'anexo_conversa_aurora',
        pasta_id: 'pasta-1',
        visibilidade: 'interna',
      },
    ], true)

    expect(contexto).toContain('CONTEXTO DO SISTEMA - ANEXOS DA CONVERSA DA AURORA')
    expect(contexto).toContain('contrato.pdf')
    expect(contexto).toContain('salvo também no Dossiê Aurora')
    expect(contexto).toContain('anexo_conversa_aurora')
  })

  it('retorna undefined quando não há anexos', () => {
    expect(montarContextoAnexosAurora([], false)).toBeUndefined()
  })
})
