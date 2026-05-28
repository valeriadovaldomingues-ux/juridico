import { describe, expect, it } from 'vitest'
import { listarAgentesAurora } from './registry'

describe('AURORA_AGENT_REGISTRY', () => {
  it('mantém somente os agentes previstos na fase 1', () => {
    const ids = listarAgentesAurora().map(agent => agent.id)

    expect(ids).toEqual([
      'principal',
      'olavo',
      'stella',
      'oraculo',
      'atlas',
      'clara',
      'dominic',
    ])
    expect(ids).not.toContain('lívia')
  })

  it('mantém metadados leves para roteamento', () => {
    const principal = listarAgentesAurora()[0]

    expect(principal.promptCompacto).toContain('Classifique a intenção')
    expect(principal.keywords.length).toBeGreaterThan(0)
    expect(principal.ferramentasPermitidas.length).toBeGreaterThan(0)
  })
})
