import { describe, expect, it } from 'vitest'
import {
  agruparPorProcesso, classificarProcessos, dataDJEN, filtrarComunicacoes, montarAlertas, numeroDoItem,
  type ComunicacaoDJEN,
} from './comunicacoes'

const P1 = '00012345620245030001'
const P2 = '00098765420245030002'
const P3 = '00055555520245030003'

function item(extra: Partial<ComunicacaoDJEN> & { destinatarios: ComunicacaoDJEN['destinatarios'] }): ComunicacaoDJEN {
  return {
    numero_processo: P1, siglaTribunal: 'TRT3', tipoComunicacao: 'Intimação',
    data_disponibilizacao: '2026-11-10', nomeOrgao: '1ª Vara do Trabalho', link: 'https://exemplo/1', ...extra,
  }
}

describe('filtrarComunicacoes', () => {
  it('descarta homônimas difusas (Irricom Serviços × Soluções)', () => {
    const itens = [
      item({ destinatarios: [{ nome: 'IRRICOM SOLUCOES TECNOLOGICAS LTDA', polo: 'P' }] }),
      item({ numero_processo: P2, destinatarios: [{ nome: 'IRRICOM SERVICOS DE ENGENHARIA LTDA.', polo: 'P' }] }),
    ]
    const r = filtrarComunicacoes(itens, ['IRRICOM SERVICOS DE ENGENHARIA LTDA'])
    expect(r).toHaveLength(1)
    expect(numeroDoItem(r[0].item)).toBe(P2)
    expect(r[0].nomeEncontrado).toBe('IRRICOM SERVICOS DE ENGENHARIA LTDA.')
    expect(r[0].polo).toBe('P')
  })

  it('aceita qualquer um dos nomes monitorados e ignora itens sem destinatários', () => {
    const itens = [
      item({ destinatarios: [{ nome: 'Acme Comércio', polo: 'A' }] }),
      item({ numero_processo: P2, destinatarios: null }),
      item({ numero_processo: P3, destinatarios: [] }),
    ]
    const r = filtrarComunicacoes(itens, ['Acme Indústria Ltda', 'ACME COMERCIO LTDA'])
    expect(r).toHaveLength(1)
    expect(r[0].polo).toBe('A')
  })

  it('com o cliente em mais de um destinatário, prefere o polo passivo', () => {
    const r = filtrarComunicacoes(
      [item({ destinatarios: [{ nome: 'ACME', polo: 'A' }, { nome: 'Acme Ltda', polo: 'P' }] })],
      ['Acme'],
    )
    expect(r[0].polo).toBe('P')
  })

  it('polo desconhecido vira null', () => {
    const r = filtrarComunicacoes([item({ destinatarios: [{ nome: 'ACME', polo: 'X' }] })], ['Acme'])
    expect(r[0].polo).toBeNull()
  })
})

describe('numeroDoItem / dataDJEN', () => {
  it('lê número com máscara e ignora números que não têm 20 dígitos', () => {
    expect(numeroDoItem({ numero_processo: '0001234-56.2024.5.03.0001' })).toBe('00012345620245030001')
    expect(numeroDoItem({ numero_processo: '123', numeroprocessocommascara: '0001234-56.2024.5.03.0001' })).toBe('00012345620245030001')
    expect(numeroDoItem({ numero_processo: '123' })).toBeNull()
  })
  it('lê data ISO e DD/MM/AAAA', () => {
    expect(dataDJEN({ data_disponibilizacao: '2026-11-10' })).toBe('2026-11-10')
    expect(dataDJEN({ data_disponibilizacao: '2026-11-10T03:00:00.000Z' })).toBe('2026-11-10')
    expect(dataDJEN({ datadisponibilizacao: '10/11/2026' })).toBe('2026-11-10')
    expect(dataDJEN({})).toBeNull()
  })
})

describe('agruparPorProcesso', () => {
  it('uma linha por processo, com a publicação mais antiga do período', () => {
    const filtradas = filtrarComunicacoes([
      item({ data_disponibilizacao: '2026-11-12', tipoComunicacao: 'Intimação', link: 'https://exemplo/recente', destinatarios: [{ nome: 'ACME', polo: 'P' }] }),
      item({ data_disponibilizacao: '2026-11-10', tipoComunicacao: 'Lista de distribuição', link: 'https://exemplo/antiga', destinatarios: [{ nome: 'ACME', polo: 'P' }] }),
      item({ numero_processo: P2, destinatarios: [{ nome: 'ACME', polo: 'A' }] }),
      item({ numero_processo: 'sem-numero', destinatarios: [{ nome: 'ACME', polo: 'A' }] }),
    ], ['Acme'])
    const g = agruparPorProcesso(filtradas)
    expect(g).toHaveLength(2)
    const p1 = g.find(x => x.numero_processo === P1)!
    expect(p1).toMatchObject({
      data_disponibilizacao: '2026-11-10', tipo_comunicacao: 'Lista de distribuição',
      link: 'https://exemplo/antiga', polo: 'P', tribunal: 'TRT3', ocorrencias: 2,
    })
  })

  it('usa o polo de outra publicação quando a mais antiga não informa', () => {
    const g = agruparPorProcesso(filtrarComunicacoes([
      item({ data_disponibilizacao: '2026-11-10', destinatarios: [{ nome: 'ACME' }] }),
      item({ data_disponibilizacao: '2026-11-11', destinatarios: [{ nome: 'ACME', polo: 'P' }] }),
    ], ['Acme']))
    expect(g[0].polo).toBe('P')
  })
})

describe('classificarProcessos / montarAlertas', () => {
  const agrupados = agruparPorProcesso(filtrarComunicacoes([
    item({ numero_processo: P1, destinatarios: [{ nome: 'ACME', polo: 'P' }] }),
    item({ numero_processo: P2, destinatarios: [{ nome: 'ACME', polo: 'P' }] }),
  ], ['Acme']))

  it('processo já cadastrado (comparando só dígitos) é "conhecido"; o resto é novo', () => {
    const c = classificarProcessos(agrupados, new Set([P1]), 'cnpj')
    expect(c.find(x => x.numero_processo === P1)?.classificacao).toBe('processo_conhecido')
    expect(c.find(x => x.numero_processo === P2)?.classificacao).toBe('novo_processo')
  })

  it('CPF sempre marca possível homônimo; CNPJ não', () => {
    expect(classificarProcessos(agrupados, new Set(), 'cpf').every(x => x.possivel_homonimo)).toBe(true)
    expect(classificarProcessos(agrupados, new Set(), 'cnpj').every(x => !x.possivel_homonimo)).toBe(true)
  })

  it('por padrão só gera alerta de processo novo', () => {
    const a = montarAlertas('mon-1', classificarProcessos(agrupados, new Set([P1]), 'cnpj'))
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ monitoramento_id: 'mon-1', numero_processo: P2, classificacao: 'novo_processo', polo: 'P' })
  })

  it('pode incluir os conhecidos quando pedido', () => {
    const a = montarAlertas('mon-1', classificarProcessos(agrupados, new Set([P1]), 'cnpj'), { incluirConhecidos: true })
    expect(a.map(x => x.classificacao).sort()).toEqual(['novo_processo', 'processo_conhecido'])
  })

  it('é idempotente: reprocessar os mesmos dados não duplica números', () => {
    const c = classificarProcessos(agrupados, new Set(), 'cnpj')
    const a = montarAlertas('mon-1', [...c, ...c])
    expect(a.map(x => x.numero_processo).sort()).toEqual([P1, P2])
    expect(montarAlertas('mon-1', c)).toEqual(montarAlertas('mon-1', c))
  })
})
