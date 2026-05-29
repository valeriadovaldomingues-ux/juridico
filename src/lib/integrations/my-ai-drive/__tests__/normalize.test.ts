import { describe, expect, it } from 'vitest'
import { normalizeFileName, normalizePath, normalizeSearchResult } from '../normalize'

describe('My AI Drive normalize', () => {
  it('remove caracteres perigosos mantendo nome legível', () => {
    expect(normalizeFileName('  ../Contrato: Final??.pdf  ')).toBe('Contrato Final.pdf')
    expect(normalizeFileName('Pasta\\Subpasta/arquivo final')).toBe('Pasta Subpasta arquivo final')
  })

  it('normaliza caminho e evita traversal', () => {
    expect(normalizePath('pasta//subpasta/arquivo.pdf')).toBe('/pasta/subpasta/arquivo.pdf')
  })

  it('normaliza resultado de busca', () => {
    const result = normalizeSearchResult({
      status: 'stub',
      operation: 'search_files',
      message: '  resposta  ',
      files: [{ id: '1', name: '  arquivo??.pdf ', path: '/docs//../arquivo.pdf' }],
      folders: [{ id: '2', name: 'Pasta\\Legal', path: '/docs/pasta legal' }],
      totalCount: 1,
    })

    expect(result.message).toBe('resposta')
    expect(result.files[0]?.name).toBe('arquivo.pdf')
    expect(result.folders[0]?.name).toBe('Pasta Legal')
    expect(result.folders[0]?.path).toBe('/docs/pasta legal')
  })
})
