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

  it('cataloga TRT1 a TRT24 com DJEN ativo nos TRTs validados', async () => {
    const { listarFontesMonitoramento } = await import('./index')

    const trts = listarFontesMonitoramento().filter(fonte => fonte.ramo === 'trabalhista')

    expect(trts).toHaveLength(24)
    expect(trts[0]?.id).toBe('trt1')
    expect(trts[23]?.id).toBe('trt24')
    expect(trts.filter(fonte => Number(fonte.id.replace('trt', '')) <= 20).every(fonte => fonte.status === 'ativo')).toBe(true)
    expect(trts.filter(fonte => Number(fonte.id.replace('trt', '')) >= 21).every(fonte => fonte.status === 'pendente')).toBe(true)
  })

  it('mapeia TRT3/MG como piloto trabalhista ativo parcial por DEJT e DJEN', async () => {
    const { listarFontesMonitoramento, fontePodeExecutar } = await import('./index')
    const { CANAIS_TRT3_MG } = await import('./trt3-mg')

    const trt3 = listarFontesMonitoramento().find(fonte => fonte.id === 'trt3')

    expect(trt3?.nome).toBe('TRT3/MG')
    expect(trt3?.ramo).toBe('trabalhista')
    expect(trt3?.status).toBe('ativo')
    expect(trt3?.descricao).toContain('DEJT')
    expect(trt3?.descricao).toContain('DJEN')
    expect(trt3?.descricao).toContain('PJe-JT')
    expect(fontePodeExecutar(trt3!)).toBe(true)
    expect(CANAIS_TRT3_MG.map(canal => canal.id)).toEqual(['dejt', 'djen', 'pje-jt'])
    expect(CANAIS_TRT3_MG.find(canal => canal.id === 'dejt')?.status).toBe('ativo')
    expect(CANAIS_TRT3_MG.find(canal => canal.id === 'djen')?.status).toBe('ativo')
    expect(CANAIS_TRT3_MG.find(canal => canal.id === 'pje-jt')?.status).toBe('requer_credencial')
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

    expect(fontes.map(fonte => fonte.id)).toEqual([
      'tjmg-dje',
      'trt1',
      'trt2',
      'trt3',
      'trt4',
      'trt5',
      'trt6',
      'trt7',
      'trt8',
      'trt9',
      'trt10',
      'trt11',
      'trt12',
      'trt13',
      'trt14',
      'trt15',
      'trt16',
      'trt17',
      'trt18',
      'trt19',
      'trt20',
    ])
  })

  it('seleciona TRT3 pelo alias trt3-dejt e seleciona DJEN como fonte executável', async () => {
    const { selecionarFontesMonitoramento, fontePodeExecutar } = await import('./index')

    expect(selecionarFontesMonitoramento({ fonte: 'trt3-dejt' }).map(fonte => fonte.id)).toEqual(['trt3'])
    const djen = selecionarFontesMonitoramento({ fonte: 'trt3-djen' })[0]
    expect(djen?.id).toBe('trt3-djen')
    expect(djen?.status).toBe('ativo')
    expect(fontePodeExecutar(djen!)).toBe(true)
  })

  it('expõe matriz técnica das fontes pendentes e ativas parciais', async () => {
    const { MATRIZ_FONTES_MONITORAMENTO } = await import('./index')

    const datajud = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'datajud-cnj')
    const trt3 = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'trt3')
    const trt21 = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'trt21')
    const esajTjsp = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'esaj-tjsp')

    expect(trt3?.status).toBe('ativo_parcial')
    expect(trt3?.capturaPublicacaoReal).toBe(true)
    expect(trt21?.status).toBe('pendente')
    expect(trt21?.motivo).toContain('429')
    expect(datajud?.capturaPublicacaoReal).toBe(false)
    expect(esajTjsp?.status).toBe('pendente')
  })
})
