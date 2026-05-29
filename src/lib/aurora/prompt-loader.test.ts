import { describe, expect, it } from 'vitest'
import { AuroraAccessError } from './security'
import { carregarPromptCompletoAurora } from './prompt-loader'

describe('carregarPromptCompletoAurora', () => {
  it('bloqueia carregamento direto para não sócio', async () => {
    await expect(
      carregarPromptCompletoAurora('olavo', 'rapido', 'gerente'),
    ).rejects.toBeInstanceOf(AuroraAccessError)
  })

  it('carrega prompt quando o papel é socio', async () => {
    const prompt = await carregarPromptCompletoAurora('principal', 'rapido', 'socio')

    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('carrega prompts novos de Atena e Olívia para socio', async () => {
    const atena = await carregarPromptCompletoAurora('atena', 'rapido', 'socio')
    const olivia = await carregarPromptCompletoAurora('olivia', 'rapido', 'socio')

    expect(atena).toContain('Atena')
    expect(olivia).toContain('Olívia')
  })
})
