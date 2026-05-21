import { describe, expect, it } from 'vitest'
import { AURORA_MOBILE_MODULE_LINKS, AURORA_MOBILE_QUICK_COMMANDS } from './aurora-mobile'

describe('aurora mobile config', () => {
  it('mantém os comandos rápidos esperados', () => {
    expect(AURORA_MOBILE_QUICK_COMMANDS.map(command => command.label)).toEqual([
      'Ver publicações de hoje',
      'Ver prazos de hoje',
      'Ver Gmail',
      'Buscar limpeza segura',
      'Resumo do dia',
    ])
  })

  it('mantém links para módulos relacionados', () => {
    expect(AURORA_MOBILE_MODULE_LINKS).toEqual([
      { label: 'Abrir Publicações', href: '/publicacoes' },
      { label: 'Abrir Gmail', href: '/integracoes/gmail' },
      { label: 'Abrir Monitoramento', href: '/monitoramento' },
    ])
  })
})
