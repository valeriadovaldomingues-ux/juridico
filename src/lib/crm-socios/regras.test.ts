import { describe, expect, it } from 'vitest'
import {
  CRM_SOCIOS_DIAS_PARADA, ETAPAS, ETAPA_IDS, ETAPA_LABEL,
} from './constants'
import {
  acaoHoje, acaoVencida, dataISOLocal, diasDesde, diasSemInteracao, ehDataISO, ehEtapaTerminal, ehEtapaValida,
  estaParada, filtrarOportunidades, proximasAcoes, resumoFunil, statusDaEtapa, sugerirEtapaPorProposta,
  totaisPorEtapa, validarMovimento, type OportunidadeBase,
} from './regras'

// "Hoje" fixo: 15/11/2026, meio-dia (hora local).
const HOJE = new Date(2026, 10, 15, 12, 0, 0)

function diasAtras(n: number): string {
  return new Date(2026, 10, 15 - n, 12, 0, 0).toISOString()
}
function dataEm(n: number): string {
  return dataISOLocal(new Date(2026, 10, 15 + n, 12, 0, 0))
}

let seq = 0
function op(parcial: Partial<OportunidadeBase> = {}): OportunidadeBase {
  seq += 1
  return {
    id: `id-${seq}`,
    nome: `Oportunidade ${seq}`,
    etapa: 'contato_inicial',
    status: 'aberto',
    valor_estimado: null,
    responsavel_id: null,
    proxima_acao: null,
    proxima_acao_data: null,
    ultimo_contato_em: diasAtras(1),
    created_at: diasAtras(30),
    ...parcial,
  }
}

describe('etapas', () => {
  it('o funil tem as 7 etapas pedidas, na ordem', () => {
    expect(ETAPA_IDS).toEqual([
      'contato_inicial', 'reuniao_marcada', 'reuniao_feita', 'proposta_enviada', 'negociacao', 'fechado', 'perdido',
    ])
    expect(ETAPA_LABEL.fechado).toBe('Fechado (ganho)')
    expect(ETAPAS.filter(e => e.terminal).map(e => e.id)).toEqual(['fechado', 'perdido'])
  })

  it('ehEtapaValida aceita só etapas conhecidas', () => {
    expect(ehEtapaValida('negociacao')).toBe(true)
    expect(ehEtapaValida('diagnostico')).toBe(false)
    expect(ehEtapaValida(undefined)).toBe(false)
    expect(ehEtapaValida(3)).toBe(false)
  })

  it('status deriva da etapa', () => {
    expect(statusDaEtapa('fechado')).toBe('ganho')
    expect(statusDaEtapa('perdido')).toBe('perdido')
    for (const e of ['contato_inicial', 'reuniao_marcada', 'reuniao_feita', 'proposta_enviada', 'negociacao'] as const) {
      expect(statusDaEtapa(e)).toBe('aberto')
    }
  })

  it('terminais: fechado e perdido', () => {
    expect(ehEtapaTerminal('fechado')).toBe(true)
    expect(ehEtapaTerminal('perdido')).toBe(true)
    expect(ehEtapaTerminal('negociacao')).toBe(false)
  })
})

describe('validarMovimento (transições)', () => {
  it('rejeita etapa inexistente', () => {
    expect(validarMovimento('contato_inicial', 'qualquer')).toEqual({ ok: false, erro: 'Etapa inválida.' })
  })

  it('qualquer etapa aberta pode ir para outra (quadro livre, para frente ou para trás)', () => {
    const r = validarMovimento('negociacao', 'reuniao_marcada')
    expect(r).toMatchObject({ ok: true, etapa: 'reuniao_marcada', status: 'aberto', fechada: false, reaberta: false })
  })

  it('fechar vira ganho, marca fechada e zera o motivo', () => {
    expect(validarMovimento('negociacao', 'fechado', 'lixo')).toMatchObject({
      ok: true, etapa: 'fechado', status: 'ganho', fechada: true, motivo_perda: null,
    })
  })

  it('perder exige motivo', () => {
    expect(validarMovimento('negociacao', 'perdido')).toEqual({ ok: false, erro: 'Informe o motivo da perda.' })
    expect(validarMovimento('negociacao', 'perdido', '   ')).toEqual({ ok: false, erro: 'Informe o motivo da perda.' })
    expect(validarMovimento('negociacao', 'perdido', null)).toMatchObject({ ok: false })
  })

  it('perder com motivo: status perdido, motivo aparado, fechada', () => {
    expect(validarMovimento('proposta_enviada', 'perdido', '  sem orçamento ')).toMatchObject({
      ok: true, status: 'perdido', motivo_perda: 'sem orçamento', fechada: true,
    })
  })

  it('reabrir: sair de fechado/perdido para etapa aberta marca reaberta e limpa o motivo', () => {
    expect(validarMovimento('perdido', 'reuniao_feita', 'motivo antigo')).toMatchObject({
      ok: true, status: 'aberto', reaberta: true, fechada: false, motivo_perda: null,
    })
    expect(validarMovimento('fechado', 'negociacao')).toMatchObject({ ok: true, reaberta: true })
  })

  it('de fechado para perdido não é "reaberta"', () => {
    expect(validarMovimento('fechado', 'perdido', 'desistiu')).toMatchObject({ ok: true, reaberta: false })
  })
})

describe('sugerirEtapaPorProposta', () => {
  it('proposta aceita sugere "Fechado (ganho)" (nunca fecha sozinho)', () => {
    expect(sugerirEtapaPorProposta('aceita', 'negociacao')).toBe('fechado')
    expect(sugerirEtapaPorProposta('aceita', 'proposta_enviada')).toBe('fechado')
    expect(sugerirEtapaPorProposta('aceita', 'perdido')).toBe('fechado')
  })

  it('já ganha: não sugere nada', () => {
    expect(sugerirEtapaPorProposta('aceita', 'fechado')).toBeNull()
  })

  it('proposta enviada sugere "Proposta enviada" só se a oportunidade estiver antes dessa etapa', () => {
    expect(sugerirEtapaPorProposta('enviada', 'contato_inicial')).toBe('proposta_enviada')
    expect(sugerirEtapaPorProposta('enviada', 'reuniao_feita')).toBe('proposta_enviada')
    expect(sugerirEtapaPorProposta('enviada', 'proposta_enviada')).toBeNull()
    expect(sugerirEtapaPorProposta('enviada', 'negociacao')).toBeNull()
    expect(sugerirEtapaPorProposta('enviada', 'fechado')).toBeNull()
  })

  it('rascunho e recusada não sugerem nada', () => {
    expect(sugerirEtapaPorProposta('rascunho', 'reuniao_feita')).toBeNull()
    expect(sugerirEtapaPorProposta('recusada', 'negociacao')).toBeNull()
  })
})

describe('datas', () => {
  it('dataISOLocal usa a data local (não UTC)', () => {
    expect(dataISOLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('ehDataISO valida calendário real', () => {
    expect(ehDataISO('2026-02-28')).toBe(true)
    expect(ehDataISO('2026-02-30')).toBe(false)
    expect(ehDataISO('15/11/2026')).toBe(false)
    expect(ehDataISO(20261115)).toBe(false)
  })

  it('diasDesde conta dias inteiros e nunca fica negativo', () => {
    expect(diasDesde(diasAtras(0), HOJE)).toBe(0)
    expect(diasDesde(diasAtras(14), HOJE)).toBe(14)
    expect(diasDesde(dataEm(3), HOJE)).toBe(0)
    expect(diasDesde('lixo', HOJE)).toBe(0)
  })
})

describe('parada (sem interação há X dias)', () => {
  it('o limite padrão é 14 dias', () => {
    expect(CRM_SOCIOS_DIAS_PARADA).toBe(14)
  })

  it('13 dias não é parada; 14 é', () => {
    expect(estaParada(op({ ultimo_contato_em: diasAtras(13) }), HOJE)).toBe(false)
    expect(estaParada(op({ ultimo_contato_em: diasAtras(14) }), HOJE)).toBe(true)
    expect(estaParada(op({ ultimo_contato_em: diasAtras(40) }), HOJE)).toBe(true)
  })

  it('sem nenhum contato registrado, vale a data de criação', () => {
    expect(estaParada(op({ ultimo_contato_em: null, created_at: diasAtras(20) }), HOJE)).toBe(true)
    expect(estaParada(op({ ultimo_contato_em: null, created_at: diasAtras(2) }), HOJE)).toBe(false)
    expect(diasSemInteracao(op({ ultimo_contato_em: null, created_at: diasAtras(9) }), HOJE)).toBe(9)
  })

  it('ganha e perdida nunca são "paradas"', () => {
    expect(estaParada(op({ status: 'ganho', etapa: 'fechado', ultimo_contato_em: diasAtras(90) }), HOJE)).toBe(false)
    expect(estaParada(op({ status: 'perdido', etapa: 'perdido', ultimo_contato_em: diasAtras(90) }), HOJE)).toBe(false)
  })

  it('o limite é configurável', () => {
    expect(estaParada(op({ ultimo_contato_em: diasAtras(8) }), HOJE, 7)).toBe(true)
  })
})

describe('ação vencida', () => {
  it('data anterior a hoje = vencida; hoje e futuro não', () => {
    expect(acaoVencida(op({ proxima_acao_data: dataEm(-1) }), HOJE)).toBe(true)
    expect(acaoVencida(op({ proxima_acao_data: dataEm(0) }), HOJE)).toBe(false)
    expect(acaoVencida(op({ proxima_acao_data: dataEm(5) }), HOJE)).toBe(false)
  })

  it('sem data não é vencida', () => {
    expect(acaoVencida(op({ proxima_acao_data: null }), HOJE)).toBe(false)
  })

  it('só vale para oportunidade aberta', () => {
    expect(acaoVencida(op({ status: 'ganho', etapa: 'fechado', proxima_acao_data: dataEm(-10) }), HOJE)).toBe(false)
    expect(acaoVencida(op({ status: 'perdido', etapa: 'perdido', proxima_acao_data: dataEm(-10) }), HOJE)).toBe(false)
  })

  it('acaoHoje', () => {
    expect(acaoHoje(op({ proxima_acao_data: dataEm(0) }), HOJE)).toBe(true)
    expect(acaoHoje(op({ proxima_acao_data: dataEm(1) }), HOJE)).toBe(false)
  })
})

describe('totais por etapa', () => {
  const ops = [
    op({ etapa: 'contato_inicial', valor_estimado: 1000, ultimo_contato_em: diasAtras(20) }),                       // parada
    op({ etapa: 'contato_inicial', valor_estimado: 500, proxima_acao_data: dataEm(-2) }),                            // vencida
    op({ etapa: 'contato_inicial', valor_estimado: null }),                                                           // sem valor
    op({ etapa: 'negociacao', valor_estimado: 7000.5, ultimo_contato_em: diasAtras(30), proxima_acao_data: dataEm(-1) }), // parada + vencida
    op({ etapa: 'fechado', status: 'ganho', valor_estimado: 3000, ultimo_contato_em: diasAtras(100) }),
    op({ etapa: 'perdido', status: 'perdido', valor_estimado: 2000 }),
  ]
  const t = totaisPorEtapa(ops, HOJE)

  it('conta e soma valores por etapa', () => {
    expect(t.contato_inicial).toMatchObject({ qtd: 3, valor: 1500 })
    expect(t.negociacao).toMatchObject({ qtd: 1, valor: 7000.5 })
    expect(t.fechado).toMatchObject({ qtd: 1, valor: 3000 })
    expect(t.perdido).toMatchObject({ qtd: 1, valor: 2000 })
  })

  it('etapas sem oportunidades vêm zeradas (todas as colunas existem)', () => {
    expect(Object.keys(t)).toEqual([...ETAPA_IDS])
    expect(t.reuniao_marcada).toEqual({ qtd: 0, valor: 0, paradas: 0, vencidas: 0 })
  })

  it('destaca paradas e ações vencidas por etapa', () => {
    expect(t.contato_inicial).toMatchObject({ paradas: 1, vencidas: 1 })
    expect(t.negociacao).toMatchObject({ paradas: 1, vencidas: 1 })
  })

  it('ganhas/perdidas não contam como paradas nem vencidas', () => {
    expect(t.fechado).toMatchObject({ paradas: 0, vencidas: 0 })
    expect(t.perdido).toMatchObject({ paradas: 0, vencidas: 0 })
  })

  it('lista vazia → tudo zero', () => {
    expect(totaisPorEtapa([], HOJE).negociacao).toEqual({ qtd: 0, valor: 0, paradas: 0, vencidas: 0 })
  })
})

describe('resumo do funil', () => {
  it('abertas, valor em aberto, ganhas, perdidas, paradas e vencidas', () => {
    const r = resumoFunil([
      op({ valor_estimado: 1000, ultimo_contato_em: diasAtras(20) }),
      op({ valor_estimado: 2000, proxima_acao_data: dataEm(-3) }),
      op({ etapa: 'fechado', status: 'ganho', valor_estimado: 5000 }),
      op({ etapa: 'perdido', status: 'perdido', valor_estimado: 800 }),
    ], HOJE)
    expect(r).toEqual({ abertas: 2, valorEmAberto: 3000, ganhas: 1, valorGanho: 5000, perdidas: 1, paradas: 1, acoesVencidas: 1 })
  })
})

describe('próximas ações', () => {
  it('pega as 5 mais urgentes, vencidas primeiro', () => {
    const ops = [
      op({ nome: 'F', proxima_acao_data: dataEm(10) }),
      op({ nome: 'A', proxima_acao_data: dataEm(-5) }),
      op({ nome: 'C', proxima_acao_data: dataEm(0) }),
      op({ nome: 'B', proxima_acao_data: dataEm(-1) }),
      op({ nome: 'E', proxima_acao_data: dataEm(7) }),
      op({ nome: 'D', proxima_acao_data: dataEm(3) }),
      op({ nome: 'sem data', proxima_acao_data: null }),
    ]
    expect(proximasAcoes(ops).map(o => o.nome)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('ignora ganhas e perdidas', () => {
    const ops = [
      op({ nome: 'ganha', status: 'ganho', etapa: 'fechado', proxima_acao_data: dataEm(-1) }),
      op({ nome: 'perdida', status: 'perdido', etapa: 'perdido', proxima_acao_data: dataEm(-1) }),
      op({ nome: 'aberta', proxima_acao_data: dataEm(1) }),
    ]
    expect(proximasAcoes(ops).map(o => o.nome)).toEqual(['aberta'])
  })

  it('empate de data: maior valor primeiro, depois nome', () => {
    const d = dataEm(2)
    const ops = [
      op({ nome: 'Zeta', proxima_acao_data: d, valor_estimado: 100 }),
      op({ nome: 'Alfa', proxima_acao_data: d, valor_estimado: 100 }),
      op({ nome: 'Grande', proxima_acao_data: d, valor_estimado: 9000 }),
    ]
    expect(proximasAcoes(ops).map(o => o.nome)).toEqual(['Grande', 'Alfa', 'Zeta'])
  })

  it('respeita o limite pedido e não altera a lista original', () => {
    const ops = [op({ proxima_acao_data: dataEm(2) }), op({ proxima_acao_data: dataEm(1) }), op({ proxima_acao_data: dataEm(3) })]
    const copia = [...ops]
    expect(proximasAcoes(ops, 2)).toHaveLength(2)
    expect(ops).toEqual(copia)
  })
})

describe('busca e filtros (lista)', () => {
  const ops = [
    op({ nome: 'Construtora Álvares', etapa: 'negociacao', responsavel_id: 'val', contato_nome: 'João', area_interesse: 'Societário' }),
    op({ nome: 'Maria Souza', etapa: 'contato_inicial', responsavel_id: 'cris', indicado_por: 'Dr. Paulo' }),
    op({ nome: 'Padaria Boa', etapa: 'fechado', status: 'ganho', responsavel_id: 'val' }),
    op({ nome: 'Velha', etapa: 'contato_inicial', responsavel_id: 'val', ultimo_contato_em: diasAtras(40) }),
    op({ nome: 'Atrasada', etapa: 'reuniao_feita', responsavel_id: 'cris', proxima_acao_data: dataEm(-4) }),
  ]
  const nomes = (r: OportunidadeBase[]) => r.map(o => o.nome)

  it('sem filtros devolve tudo', () => {
    expect(filtrarOportunidades(ops, {}, HOJE)).toHaveLength(5)
  })

  it('busca ignora acentos e maiúsculas, em vários campos', () => {
    expect(nomes(filtrarOportunidades(ops, { busca: 'alvares' }, HOJE))).toEqual(['Construtora Álvares'])
    expect(nomes(filtrarOportunidades(ops, { busca: 'SOCIETARIO' }, HOJE))).toEqual(['Construtora Álvares'])
    expect(nomes(filtrarOportunidades(ops, { busca: 'paulo' }, HOJE))).toEqual(['Maria Souza'])
  })

  it('filtra por etapa, responsável e status', () => {
    expect(nomes(filtrarOportunidades(ops, { etapa: 'contato_inicial' }, HOJE))).toEqual(['Maria Souza', 'Velha'])
    expect(nomes(filtrarOportunidades(ops, { responsavelId: 'cris' }, HOJE))).toEqual(['Maria Souza', 'Atrasada'])
    expect(nomes(filtrarOportunidades(ops, { status: 'ganho' }, HOJE))).toEqual(['Padaria Boa'])
  })

  it('combina filtros (E)', () => {
    expect(nomes(filtrarOportunidades(ops, { etapa: 'contato_inicial', responsavelId: 'val' }, HOJE))).toEqual(['Velha'])
  })

  it('filtro de alerta: paradas e ações vencidas', () => {
    expect(nomes(filtrarOportunidades(ops, { alerta: 'paradas' }, HOJE))).toEqual(['Velha'])
    expect(nomes(filtrarOportunidades(ops, { alerta: 'vencidas' }, HOJE))).toEqual(['Atrasada'])
  })

  it('valores vazios dos selects ("") não filtram', () => {
    expect(filtrarOportunidades(ops, { etapa: '', status: '', responsavelId: '', alerta: '', busca: '' }, HOJE)).toHaveLength(5)
  })
})
