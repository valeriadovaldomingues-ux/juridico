import { afterEach, describe, expect, it, vi } from 'vitest'

describe('fontes de monitoramento', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mantém TJMG DJe como fonte ativa', async () => {
    const { listarFontesMonitoramento } = await import('./index')

    const fontes = listarFontesMonitoramento()
    const tjmg = fontes.find(fonte => fonte.id === 'tjmg-dje')

    expect(tjmg?.status).toBe('ativo')
    expect(tjmg?.tribunal).toBe('TJMG')
    expect(typeof tjmg?.executar).toBe('function')
  })

  it('cataloga TRT1 a TRT24 como pendentes', async () => {
    const { listarFontesMonitoramento } = await import('./index')

    const trts = listarFontesMonitoramento().filter(fonte => fonte.ramo === 'trabalhista')

    expect(trts).toHaveLength(24)
    expect(trts[0]?.id).toBe('trt1')
    expect(trts[23]?.id).toBe('trt24')
    expect(trts.every(fonte => fonte.status === 'pendente')).toBe(true)
  })

  it('cataloga TRFs e TJs nacionais sem fingir captura ativa', async () => {
    const { listarFontesMonitoramento } = await import('./index')

    const fontes = listarFontesMonitoramento()
    const trfs = fontes.filter(fonte => /^trf\d$/.test(fonte.id))
    const tjsp = fontes.find(fonte => fonte.id === 'tjsp')

    expect(trfs).toHaveLength(6)
    expect(trfs.every(fonte => fonte.status === 'pendente')).toBe(true)
    expect(tjsp?.status).toBe('pendente')
  })

  it('cataloga e-SAJ como fonte estadual pendente sem execução ativa', async () => {
    const { listarFontesMonitoramento, fontePodeExecutar } = await import('./index')

    const esaj = listarFontesMonitoramento().find(fonte => fonte.id === 'esaj')

    expect(esaj?.nome).toBe('e-SAJ')
    expect(esaj?.ramo).toBe('estadual')
    expect(esaj?.status).toBe('pendente')
    expect(esaj?.descricao).toContain('Requer implementação específica por tribunal')
    expect(esaj?.descricao).toContain('TJSP')
    expect(fontePodeExecutar(esaj!)).toBe(false)
  })

  it('marca DataJud como requer credencial quando não há DATAJUD_API_KEY', async () => {
    vi.stubEnv('DATAJUD_API_KEY', '')
    vi.resetModules()
    const { listarFontesMonitoramento } = await import('./index')

    const datajud = listarFontesMonitoramento().find(fonte => fonte.id === 'datajud-cnj')

    expect(datajud?.status).toBe('requer_credencial')
  })

  it('marca DataJud como preparado quando há DATAJUD_API_KEY', async () => {
    vi.stubEnv('DATAJUD_API_KEY', 'token-de-teste')
    vi.resetModules()
    const { listarFontesMonitoramento } = await import('./index')

    const datajud = listarFontesMonitoramento().find(fonte => fonte.id === 'datajud-cnj')

    expect(datajud?.status).toBe('preparado')
  })

  it('seleciona apenas fontes ativas quando não há filtro', async () => {
    const { selecionarFontesMonitoramento } = await import('./index')

    const fontes = selecionarFontesMonitoramento()

    expect(fontes.map(fonte => fonte.id)).toEqual(['tjmg-dje'])
  })
})
