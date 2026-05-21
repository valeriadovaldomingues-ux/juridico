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
    expect(trts.every(fonte => fonte.status === 'ativo')).toBe(true)
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

  it('cataloga TRFs, tribunais superiores e TJs nacionais validados ativos via DJEN/CNJ', async () => {
    const { listarFontesMonitoramento } = await import('./index')

    const fontes = listarFontesMonitoramento()
    const trfs = fontes.filter(fonte => /^trf\d$/.test(fonte.id))
    const superiores = ['stf', 'stj', 'tst'].map(id => fontes.find(fonte => fonte.id === id))
    const tjsAtivos = [
      'tjac', 'tjal', 'tjam', 'tjap', 'tjba', 'tjce', 'tjdft', 'tjes', 'tjgo',
      'tjma', 'tjms', 'tjmt', 'tjpa', 'tjpb', 'tjpe', 'tjpi', 'tjpr', 'tjrj',
      'tjrn', 'tjro', 'tjrr', 'tjrs', 'tjsc', 'tjse', 'tjsp', 'tjto',
    ].map(id => fontes.find(fonte => fonte.id === id))

    expect(trfs).toHaveLength(6)
    expect(trfs.every(fonte => fonte.status === 'ativo')).toBe(true)
    expect(trfs.every(fonte => fonte.descricao.includes('DJEN/CNJ'))).toBe(true)
    expect(superiores.every(fonte => fonte?.status === 'ativo')).toBe(true)
    expect(superiores.every(fonte => fonte?.ramo === 'superior')).toBe(true)
    expect(superiores.every(fonte => fonte?.descricao.includes('DJEN/CNJ'))).toBe(true)
    expect(tjsAtivos.every(fonte => fonte?.status === 'ativo')).toBe(true)
    expect(tjsAtivos.every(fonte => fonte?.descricao.includes('DJEN/CNJ'))).toBe(true)
    expect(fontes.find(fonte => fonte.id === 'tjsp')?.descricao).toContain('e-SAJ direto permanece pendente')
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
      'trt21',
      'trt22',
      'trt23',
      'trt24',
      'trf1',
      'trf2',
      'trf3',
      'trf4',
      'trf5',
      'trf6',
      'stf',
      'stj',
      'tst',
      'tjac',
      'tjal',
      'tjam',
      'tjap',
      'tjba',
      'tjce',
      'tjdft',
      'tjes',
      'tjgo',
      'tjma',
      'tjms',
      'tjmt',
      'tjpa',
      'tjpb',
      'tjpe',
      'tjpi',
      'tjpr',
      'tjrj',
      'tjrn',
      'tjro',
      'tjrr',
      'tjrs',
      'tjsc',
      'tjse',
      'tjsp',
      'tjto',
    ])
  })

  it('seleciona múltiplas fontes explícitas sem duplicar resultados', async () => {
    const { selecionarFontesMonitoramento } = await import('./index')

    const fontes = selecionarFontesMonitoramento({
      fontes: ['tjmg-dje', 'trt3', 'trf6', 'trf6', 'fonte-inexistente'],
    })

    expect(fontes.map(fonte => fonte.id)).toEqual(['tjmg-dje', 'trt3', 'trf6'])
  })

  it('seleciona TRFs, superiores e TJs ativos pelo DJEN/CNJ e mantém e-SAJ/TJSP direto pendente', async () => {
    const { selecionarFontesMonitoramento, fontePodeExecutar } = await import('./index')

    const trf1 = selecionarFontesMonitoramento({ fonte: 'trf1' })[0]
    const trf1PorTribunal = selecionarFontesMonitoramento({ tribunal: 'TRF1' })[0]
    const stj = selecionarFontesMonitoramento({ fonte: 'stj' })[0]
    const stjPorTribunal = selecionarFontesMonitoramento({ tribunal: 'STJ' })[0]
    const tjac = selecionarFontesMonitoramento({ fonte: 'tjac' })[0]
    const tjacPorTribunal = selecionarFontesMonitoramento({ tribunal: 'TJAC' })[0]
    const tjro = selecionarFontesMonitoramento({ fonte: 'tjro' })[0]
    const tjsp = selecionarFontesMonitoramento({ fonte: 'tjsp' })[0]
    const porTribunal = selecionarFontesMonitoramento({ tribunal: 'TJSP' })[0]
    const esajTjsp = selecionarFontesMonitoramento({ fonte: 'esaj-tjsp' })[0]

    expect(trf1?.id).toBe('trf1')
    expect(trf1?.status).toBe('ativo')
    expect(fontePodeExecutar(trf1!)).toBe(true)
    expect(trf1PorTribunal?.id).toBe('trf1')
    expect(stj?.id).toBe('stj')
    expect(stj?.status).toBe('ativo')
    expect(stj?.ramo).toBe('superior')
    expect(fontePodeExecutar(stj!)).toBe(true)
    expect(stjPorTribunal?.id).toBe('stj')
    expect(tjac?.id).toBe('tjac')
    expect(tjac?.status).toBe('ativo')
    expect(fontePodeExecutar(tjac!)).toBe(true)
    expect(tjacPorTribunal?.id).toBe('tjac')
    expect(tjro?.status).toBe('ativo')
    expect(fontePodeExecutar(tjro!)).toBe(true)
    expect(tjsp?.id).toBe('tjsp')
    expect(tjsp?.status).toBe('ativo')
    expect(fontePodeExecutar(tjsp!)).toBe(true)
    expect(porTribunal?.id).toBe('tjsp')
    expect(esajTjsp?.status).toBe('pendente')
    expect(esajTjsp?.descricao).toContain('estado de sessão')
    expect(fontePodeExecutar(esajTjsp!)).toBe(false)
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
    const trt24 = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'trt24')
    const trf1 = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'trf1')
    const stf = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'stf')
    const stj = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'stj')
    const tjac = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'tjac')
    const tjro = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'tjro')
    const tjsp = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'tjsp')
    const esajTjsp = MATRIZ_FONTES_MONITORAMENTO.find(item => item.id === 'esaj-tjsp')

    expect(trt3?.status).toBe('ativo_parcial')
    expect(trt3?.capturaPublicacaoReal).toBe(true)
    expect(trt24?.status).toBe('ativo')
    expect(trt24?.motivo).toContain('Revalidação controlada')
    expect(trf1?.status).toBe('ativo')
    expect(trf1?.capturaPublicacaoReal).toBe(true)
    expect(trf1?.motivo).toContain('HTTP 200')
    expect(stf?.status).toBe('ativo')
    expect(stf?.motivo).toContain('sem publicações retornadas')
    expect(stf?.capturaPublicacaoReal).toBe(true)
    expect(stj?.status).toBe('ativo')
    expect(stj?.capturaPublicacaoReal).toBe(true)
    expect(datajud?.capturaPublicacaoReal).toBe(false)
    expect(tjac?.status).toBe('ativo')
    expect(tjac?.capturaPublicacaoReal).toBe(true)
    expect(tjro?.status).toBe('ativo')
    expect(tjro?.motivo).toContain('HTTP 200')
    expect(tjro?.capturaPublicacaoReal).toBe(true)
    expect(tjsp?.status).toBe('ativo_parcial')
    expect(tjsp?.capturaPublicacaoReal).toBe(true)
    expect(esajTjsp?.status).toBe('pendente')
    expect(esajTjsp?.capturaPublicacaoReal).toBe(false)
  })
})
