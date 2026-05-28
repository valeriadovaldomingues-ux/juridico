import { describe, expect, it } from 'vitest'
import { redigirDetalhesSensiveis, contemCampoSensivel } from './audit'
import { getProcessualProvider, listarProvidersProcessuais } from './provider'

describe('integracoes processuais providers', () => {
  it('executa provider mock sem chamadas externas', async () => {
    const provider = getProcessualProvider('mock')
    const resultado = await provider.sincronizarProcesso('0000000-00.2026.8.13.0000')

    expect(resultado.provider).toBe('mock')
    expect(resultado.processo?.numeroCnj).toBe('0000000-00.2026.8.13.0000')
    expect(resultado.movimentacoes.length).toBeGreaterThan(0)
    expect(resultado.publicacoes.length).toBeGreaterThan(0)
  })

  it('lista provider futuro sem expor variaveis de ambiente', () => {
    const providers = listarProvidersProcessuais()
    const serialized = JSON.stringify(providers)

    expect(providers.map(provider => provider.id)).toContain('jusbrasil')
    expect(serialized).not.toContain('JUSBRASIL_API_TOKEN')
    expect(serialized).not.toContain(process.env.JUSBRASIL_API_TOKEN ?? 'valor-inexistente-para-teste')
  })

  it('detecta e redige campos sensiveis em detalhes de log', () => {
    const detalhes = {
      numeroCnj: '0000000-00.2026.8.13.0000',
      token: 'token-real',
      nested: { senhaTribunal: 'senha-real', total: 1 },
    }

    expect(contemCampoSensivel(detalhes)).toBe(true)
    expect(redigirDetalhesSensiveis(detalhes)).toEqual({
      numeroCnj: '0000000-00.2026.8.13.0000',
      token: '[redigido]',
      nested: { senhaTribunal: '[redigido]', total: 1 },
    })
  })
})
