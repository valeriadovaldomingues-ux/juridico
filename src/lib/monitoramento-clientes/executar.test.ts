import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  desdeDoDocumento, documentoNaVigencia, executarMonitoramentoClientes, nomesDoDocumento,
  type DocumentoMonitorado,
} from './executar'

const P1 = '00012345620245030001'
const P2 = '00098765420245030002'
const P3 = '00055555520245030003'

// ─── Banco falso em memória (só o que a rotina usa) ──────────────────────────

interface Estado {
  docs: Array<Partial<DocumentoMonitorado>>
  processos: Array<{ numero_processo: string | null }>
  alertas: Array<Record<string, unknown>>
  atualizacoes: Array<{ id: string; ultima_busca_em: string }>
  erroUpsert?: { message: string }
}

function bancoFalso(estado: Estado) {
  let seq = 0
  return {
    from(tabela: string) {
      const q: { op: string; payload?: unknown; opts?: { onConflict?: string; ignoreDuplicates?: boolean }; eqId?: string; range?: [number, number] } = { op: 'select' }
      const exec = () => {
        if (tabela === 'monitoramento_documentos' && q.op === 'select') return { data: estado.docs, error: null }
        if (tabela === 'monitoramento_documentos' && q.op === 'update') {
          estado.atualizacoes.push({ id: q.eqId!, ultima_busca_em: (q.payload as { ultima_busca_em: string }).ultima_busca_em })
          return { data: null, error: null }
        }
        if (tabela === 'processos') {
          const [de, ate] = q.range ?? [0, 999]
          return { data: estado.processos.slice(de, ate + 1), error: null }
        }
        if (tabela === 'monitoramento_alertas' && q.op === 'upsert') {
          if (estado.erroUpsert) return { data: null, error: estado.erroUpsert }
          const novos: Array<{ id: string; numero_processo: string }> = []
          for (const linha of q.payload as Array<Record<string, unknown>>) {
            // unique (monitoramento_id, numero_processo) + on conflict do nothing
            const existe = estado.alertas.some(a => a.monitoramento_id === linha.monitoramento_id && a.numero_processo === linha.numero_processo)
            if (existe) continue
            const id = `alerta-${++seq}`
            estado.alertas.push({ id, ...linha })
            novos.push({ id, numero_processo: linha.numero_processo as string })
          }
          return { data: novos, error: null }
        }
        throw new Error(`consulta não prevista: ${tabela}/${q.op}`)
      }
      const b: Record<string, unknown> = {
        select: () => b, eq: (col: string, val: string) => { if (col === 'id') q.eqId = val; return b },
        not: () => b, order: () => b,
        range: (de: number, ate: number) => { q.range = [de, ate]; return b },
        upsert: (payload: unknown, opts: { onConflict?: string; ignoreDuplicates?: boolean }) => { q.op = 'upsert'; q.payload = payload; q.opts = opts; return b },
        update: (payload: unknown) => { q.op = 'update'; q.payload = payload; return b },
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(exec).then(res, rej),
      }
      return b
    },
  } as unknown as SupabaseClient
}

function doc(extra: Partial<DocumentoMonitorado> = {}): Partial<DocumentoMonitorado> {
  return {
    id: 'doc-1', cliente_id: null, documento: '11222333000181', tipo: 'cnpj',
    nome_principal: 'Acme Comércio Ltda', nomes_busca: [], ativo: true,
    vigencia_inicio: null, vigencia_fim: null, ultima_busca_em: null, ...extra,
  }
}

function itemDjen(numero: string, nome: string, polo: 'A' | 'P' = 'P', data = '2026-11-12') {
  return {
    numero_processo: numero, siglaTribunal: 'TRT3', tipoComunicacao: 'Intimação', data_disponibilizacao: data,
    nomeOrgao: '1ª Vara', link: `https://djen/${numero}`, destinatarios: [{ nome, polo }],
  }
}

/** fetch falso: devolve os itens por nome pesquisado (uma página só). */
function fetchPorNome(porNome: Record<string, unknown[]>) {
  return vi.fn(async (url: string | URL | Request) => {
    const nome = new URL(String(url)).searchParams.get('nomeParte') ?? ''
    const items = porNome[nome] ?? []
    return { ok: true, status: 200, json: async () => ({ count: items.length, items }) } as unknown as Response
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

const base = { ate: '2026-11-13', pausaMs: 0, sleep: async () => {} }

describe('executarMonitoramentoClientes', () => {
  it('cria alerta só para processo novo do cliente (filtra homônimas e processos já cadastrados)', async () => {
    const estado: Estado = {
      docs: [doc()],
      processos: [{ numero_processo: '0001234-56.2024.5.03.0001' }, { numero_processo: null }], // P1 já cadastrado (com máscara)
      alertas: [], atualizacoes: [],
    }
    const fetchFn = fetchPorNome({
      'Acme Comércio Ltda': [
        itemDjen(P1, 'ACME COMERCIO LTDA'),          // conhecido → sem alerta
        itemDjen(P2, 'ACME COMERCIO LTDA.', 'P'),     // novo
        itemDjen(P3, 'ACME COMERCIAL DO SUL LTDA'),   // difuso (outro nome) → descartado
      ],
    })

    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })

    expect(r).toMatchObject({ documentos: 1, consultas: 1, encontrados: 2, novos: 1, falhas: 0, interrompido: false })
    expect(estado.alertas).toHaveLength(1)
    expect(estado.alertas[0]).toMatchObject({
      monitoramento_id: 'doc-1', numero_processo: P2, polo: 'P', classificacao: 'novo_processo',
      possivel_homonimo: false, tribunal: 'TRT3', link: `https://djen/${P2}`,
    })
    expect(r.alertas[0]).toMatchObject({ cliente: 'Acme Comércio Ltda', numero_processo: P2 })
    expect(estado.atualizacoes).toHaveLength(1)
  })

  it('é idempotente: rodar de novo com os mesmos dados não cria alerta repetido', async () => {
    const estado: Estado = { docs: [doc()], processos: [], alertas: [], atualizacoes: [] }
    const fetchFn = fetchPorNome({ 'Acme Comércio Ltda': [itemDjen(P2, 'ACME COMERCIO LTDA')] })
    const supabase = bancoFalso(estado)

    const r1 = await executarMonitoramentoClientes({ ...base, supabase, fetchFn })
    const r2 = await executarMonitoramentoClientes({ ...base, supabase, fetchFn })

    expect(r1.novos).toBe(1)
    expect(r2.novos).toBe(0)
    expect(r2.encontrados).toBe(1)
    expect(estado.alertas).toHaveLength(1)
  })

  it('CPF marca possível homônimo; busca cada nome alternativo e junta os resultados', async () => {
    const estado: Estado = {
      docs: [doc({ documento: '52998224725', tipo: 'cpf', nome_principal: 'Maria da Silva', nomes_busca: ['Maria Silva Souza'] })],
      processos: [], alertas: [], atualizacoes: [],
    }
    const fetchFn = fetchPorNome({
      'Maria da Silva': [itemDjen(P1, 'MARIA DA SILVA')],
      'Maria Silva Souza': [itemDjen(P2, 'MARIA SILVA SOUZA', 'A')],
    })
    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })
    expect(r.consultas).toBe(2)
    expect(r.novos).toBe(2)
    expect(estado.alertas.every(a => a.possivel_homonimo === true)).toBe(true)
  })

  it('falha na consulta: conta falha, não avança ultima_busca_em e segue para os outros documentos', async () => {
    const estado: Estado = {
      docs: [doc({ id: 'doc-a', nome_principal: 'Cliente A' }), doc({ id: 'doc-b', documento: '11444777000161', nome_principal: 'Cliente B' })],
      processos: [], alertas: [], atualizacoes: [],
    }
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const nome = new URL(String(url)).searchParams.get('nomeParte')
      if (nome === 'Cliente A') return { ok: false, status: 500, json: async () => ({}) } as unknown as Response
      return { ok: true, status: 200, json: async () => ({ count: 1, items: [itemDjen(P1, 'CLIENTE B')] }) } as unknown as Response
    }) as unknown as typeof fetch

    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })

    expect(r.falhas).toBe(1)
    expect(r.erros[0]).toContain('Cliente A')
    expect(r.novos).toBe(1)
    expect(estado.atualizacoes.map(a => a.id)).toEqual(['doc-b'])
  })

  it('403 do WAF interrompe a rodada para não insistir', async () => {
    const estado: Estado = { docs: [doc({ id: 'doc-a' }), doc({ id: 'doc-b', documento: '11444777000161', nome_principal: 'Outro' })], processos: [], alertas: [], atualizacoes: [] }
    const fetchFn = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch

    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })

    expect(r.interrompido).toBe(true)
    expect(r.documentos).toBe(1)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(estado.atualizacoes).toHaveLength(0)
  })

  it('falha ao gravar alertas conta como falha e não avança a última busca', async () => {
    const estado: Estado = { docs: [doc()], processos: [], alertas: [], atualizacoes: [], erroUpsert: { message: 'boom' } }
    const fetchFn = fetchPorNome({ 'Acme Comércio Ltda': [itemDjen(P2, 'ACME COMERCIO LTDA')] })
    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })
    expect(r.falhas).toBe(1)
    expect(r.novos).toBe(0)
    expect(estado.atualizacoes).toHaveLength(0)
  })

  it('ignora documentos fora da vigência e respeita o orçamento de tempo', async () => {
    const estado: Estado = {
      docs: [
        doc({ id: 'vencido', vigencia_fim: '2026-10-01' }),
        doc({ id: 'futuro', documento: '11444777000161', vigencia_inicio: '2027-01-01' }),
        doc({ id: 'ok-1', documento: '52998224725', tipo: 'cpf', nome_principal: 'Fulano de Tal' }),
        doc({ id: 'ok-2', documento: '11111111111', tipo: 'cpf', nome_principal: 'Beltrano de Tal' }),
      ],
      processos: [], alertas: [], atualizacoes: [],
    }
    const fetchFn = fetchPorNome({})
    let t = 0
    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn, orcamentoMs: 100, agora: () => (t += 80) })
    expect(r.documentos).toBe(1) // o 2º já estoura o orçamento
    expect(r.interrompido).toBe(true)
    expect(estado.atualizacoes.map(a => a.id)).toEqual(['ok-1'])
  })

  it('sem documentos ativos não consulta nada', async () => {
    const estado: Estado = { docs: [], processos: [], alertas: [], atualizacoes: [] }
    const fetchFn = fetchPorNome({})
    const r = await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })
    expect(r).toMatchObject({ documentos: 0, consultas: 0, novos: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('janela padrão de 3 dias; documento nunca buscado faz backfill de 30 dias', async () => {
    const estado: Estado = {
      docs: [
        doc({ id: 'novo', nome_principal: 'Nunca Buscado' }),
        doc({ id: 'antigo', documento: '11444777000161', nome_principal: 'Ja Buscado', ultima_busca_em: '2026-11-12T14:00:00.000Z' }),
      ],
      processos: [], alertas: [], atualizacoes: [],
    }
    const fetchFn = fetchPorNome({})
    await executarMonitoramentoClientes({ ...base, supabase: bancoFalso(estado), fetchFn })
    const inicios = Object.fromEntries((fetchFn.mock.calls as Array<[string]>).map(([u]) => {
      const p = new URL(u).searchParams
      return [p.get('nomeParte'), p.get('dataDisponibilizacaoInicio')]
    }))
    expect(inicios['Nunca Buscado']).toBe('2026-10-14') // 13/11 − 30 dias
    expect(inicios['Ja Buscado']).toBe('2026-11-10')    // 13/11 − 3 dias (a janela padrão já cobre desde 11/11)
  })
})

describe('funções auxiliares', () => {
  it('documentoNaVigencia', () => {
    expect(documentoNaVigencia({ vigencia_inicio: null, vigencia_fim: null }, '2026-11-13')).toBe(true)
    expect(documentoNaVigencia({ vigencia_inicio: '2026-11-14', vigencia_fim: null }, '2026-11-13')).toBe(false)
    expect(documentoNaVigencia({ vigencia_inicio: null, vigencia_fim: '2026-11-12' }, '2026-11-13')).toBe(false)
    expect(documentoNaVigencia({ vigencia_inicio: '2026-01-01', vigencia_fim: '2026-11-13' }, '2026-11-13')).toBe(true)
  })

  it('desdeDoDocumento: backfill, catch-up após dias sem rodar, vigência e desde manual', () => {
    const ate = '2026-11-13'
    const desde = '2026-11-10'
    expect(desdeDoDocumento({ ultima_busca_em: null, vigencia_inicio: null }, desde, ate)).toBe('2026-10-14')
    // cron parado há 10 dias: recua até o dia anterior à última busca
    expect(desdeDoDocumento({ ultima_busca_em: '2026-11-03T12:00:00.000Z', vigencia_inicio: null }, desde, ate)).toBe('2026-11-02')
    // parado há 60 dias: limita ao backfill de 30
    expect(desdeDoDocumento({ ultima_busca_em: '2026-09-01T12:00:00.000Z', vigencia_inicio: null }, desde, ate)).toBe('2026-10-14')
    // nunca antes do início da vigência
    expect(desdeDoDocumento({ ultima_busca_em: null, vigencia_inicio: '2026-11-01' }, desde, ate)).toBe('2026-11-01')
    // desde manual mais antigo que o backfill prevalece
    expect(desdeDoDocumento({ ultima_busca_em: null, vigencia_inicio: null }, '2026-08-01', ate)).toBe('2026-08-01')
  })

  it('nomesDoDocumento junta principal e variações sem repetir', () => {
    expect(nomesDoDocumento({ nome_principal: 'Acme Ltda', nomes_busca: ['ACME LTDA.', 'Acme Comércio', ''] })).toEqual(['Acme Ltda', 'Acme Comércio'])
    expect(nomesDoDocumento({ nome_principal: 'Acme', nomes_busca: null })).toEqual(['Acme'])
  })
})
