import { describe, expect, it } from 'vitest'
import { andamentoVisivelNoPortal, filtrarVisiveisNoPortal, processoVisivelNoPortal } from './visibilidade'
import { listarAndamentos, listarAudienciasFuturas, listarPartes, listarProcessosDoCliente, montarResumo, obterProcessoDoCliente } from './consultas'
import { criarFakeDb } from './testing/fake-db'
import { CLIENTE_A, CLIENTE_B, PROC_A1, PROC_A_OCULTO, PROC_A_SEGREDO, PROC_B1, seedBasico } from './testing/seed'

const AGORA = new Date('2026-11-15T15:00:00Z')

describe('processoVisivelNoPortal (regra única)', () => {
  it('visível por padrão (liberação padrão)', () => {
    expect(processoVisivelNoPortal({ segredo_justica: false, ocultar_portal: false })).toBe(true)
  })
  it('segredo de justiça nunca aparece', () => {
    expect(processoVisivelNoPortal({ segredo_justica: true, ocultar_portal: false })).toBe(false)
  })
  it('ocultar_portal = true esconde', () => {
    expect(processoVisivelNoPortal({ segredo_justica: false, ocultar_portal: true })).toBe(false)
  })
  it('segredo_justica nulo (não informado) não é segredo', () => {
    expect(processoVisivelNoPortal({ segredo_justica: null, ocultar_portal: false })).toBe(true)
  })
  it('fail-closed: sem a flag ocultar_portal (ou sem objeto) não aparece', () => {
    expect(processoVisivelNoPortal({ segredo_justica: false })).toBe(false)
    expect(processoVisivelNoPortal({ segredo_justica: false, ocultar_portal: null })).toBe(false)
    expect(processoVisivelNoPortal(null)).toBe(false)
    expect(processoVisivelNoPortal(undefined)).toBe(false)
  })
  it('filtro SQL aplica os dois critérios', () => {
    const chamadas: unknown[][] = []
    const q = { eq: (...a: unknown[]) => { chamadas.push(['eq', ...a]); return q }, not: (...a: unknown[]) => { chamadas.push(['not', ...a]); return q } }
    filtrarVisiveisNoPortal(q)
    expect(chamadas).toEqual([['eq', 'ocultar_portal', false], ['not', 'segredo_justica', 'is', true]])
  })
})

describe('andamento client-safe', () => {
  it('só movimentação processual de origem humana/tribunal/publicação', () => {
    expect(andamentoVisivelNoPortal({ tipo: 'decisao', origem: 'tribunal' })).toBe(true)
    expect(andamentoVisivelNoPortal({ tipo: 'peticao', origem: 'manual' })).toBe(true)
    expect(andamentoVisivelNoPortal({ tipo: 'contato_cliente', origem: 'manual' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'observacao', origem: 'manual' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'prazo', origem: 'manual' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'documento', origem: 'manual' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'outro', origem: 'manual' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'despacho', origem: 'aurora' })).toBe(false)
    expect(andamentoVisivelNoPortal({ tipo: 'despacho', origem: 'sistema' })).toBe(false)
  })
})

describe('consultas filtram pelo cliente da sessão', () => {
  it('lista só os processos visíveis do cliente (sem segredo, sem oculto, sem os de outro cliente)', async () => {
    const f = criarFakeDb(seedBasico())
    const a = await listarProcessosDoCliente(f.db, CLIENTE_A)
    expect(a.map(p => p.id)).toEqual([PROC_A1])
    const b = await listarProcessosDoCliente(f.db, CLIENTE_B)
    expect(b.map(p => p.id)).toEqual([PROC_B1])
  })

  it('nunca devolve campos internos (observações, valor da causa, advogado, parte contrária)', async () => {
    const f = criarFakeDb(seedBasico())
    const [p] = await listarProcessosDoCliente(f.db, CLIENTE_A)
    const detalhe = await obterProcessoDoCliente(f.db, CLIENTE_A, PROC_A1)
    for (const objeto of [p, detalhe]) {
      const texto = JSON.stringify(objeto)
      expect(texto).not.toMatch(/ESTRATEGIA|987654|adv-|TEXTO INTERNO|observacoes|valor_causa|advogado|parte_contraria|cliente_id|segredo_justica|ocultar_portal/)
    }
  })

  it('processo de OUTRO cliente → null (vira 404)', async () => {
    const f = criarFakeDb(seedBasico())
    expect(await obterProcessoDoCliente(f.db, CLIENTE_A, PROC_B1)).toBeNull()
    expect(await obterProcessoDoCliente(f.db, CLIENTE_B, PROC_A1)).toBeNull()
  })

  it('processo em segredo de justiça ou oculto → null, mesmo sendo do cliente', async () => {
    const f = criarFakeDb(seedBasico())
    expect(await obterProcessoDoCliente(f.db, CLIENTE_A, PROC_A_SEGREDO)).toBeNull()
    expect(await obterProcessoDoCliente(f.db, CLIENTE_A, PROC_A_OCULTO)).toBeNull()
  })

  it('id inválido → null sem consultar o banco', async () => {
    const f = criarFakeDb(seedBasico())
    expect(await obterProcessoDoCliente(f.db, CLIENTE_A, "x'; drop table processos;--")).toBeNull()
    expect(f.consultas).toHaveLength(0)
  })

  it('partes: só autor/réu/terceiro, sem documento e sem o tipo "outro"', async () => {
    const f = criarFakeDb(seedBasico())
    const partes = (await listarPartes(f.db, [PROC_A1])).get(PROC_A1)
    expect(partes).toEqual([{ nome: 'Maria da Silva', tipo: 'Cliente' }, { nome: 'Banco Réu S.A.', tipo: 'Parte contrária' }])
    expect(JSON.stringify(partes)).not.toMatch(/529|0001-91|nota interna|José Vínculo/)
  })

  it('partes: nunca "autor"/"réu" (depende do lado do cliente): contrapartes são "Parte contrária", repetidas somem', async () => {
    const IMP = '[importado do campo parte contrária do processo, 12/11/2026]'
    const base = seedBasico()
    base.partes_processo = [
      { id: 'x1', processo_id: PROC_A1, pessoa_nome: 'Jessica Ferreira Luz', tipo_parte: 'autor', observacoes: null },
      { id: 'x2', processo_id: PROC_A1, pessoa_nome: 'JESSICA FERREIRA LUZ', tipo_parte: 'reu', observacoes: IMP },
      { id: 'x3', processo_id: PROC_A1, pessoa_nome: 'Fulano de Tal', tipo_parte: 'reu', observacoes: IMP },
      { id: 'x4', processo_id: PROC_A1, pessoa_nome: 'maria da silva', tipo_parte: 'reu', observacoes: null },
      { id: 'x5', processo_id: PROC_A1, pessoa_nome: 'Seguradora X', tipo_parte: 'terceiro', observacoes: null },
    ]
    const partes = (await listarPartes(criarFakeDb(base).db, [PROC_A1])).get(PROC_A1)
    expect(partes).toEqual([
      { nome: 'Jessica Ferreira Luz', tipo: 'Parte contrária' },
      { nome: 'Fulano de Tal', tipo: 'Parte contrária' },
      { nome: 'maria da silva', tipo: 'Cliente' },
      { nome: 'Seguradora X', tipo: 'Terceiro interessado' },
    ])
    expect(JSON.stringify(partes)).not.toMatch(/importado|Autor|Réu/)
  })

  it('andamentos: só os client-safe, mais recentes primeiro, sem autor/responsável', async () => {
    const f = criarFakeDb(seedBasico())
    const ands = await listarAndamentos(f.db, PROC_A1)
    expect(ands.map(a => a.id)).toEqual(['an1', 'an6'])
    expect(JSON.stringify(ands)).not.toMatch(/nervoso|estratégia|IA|criado_por|responsavel|u1|u2/)
  })

  it('audiências: só futuras e pendentes, de processos visíveis do cliente, sem título/descrição/responsável internos', async () => {
    const f = criarFakeDb(seedBasico())
    const aud = await listarAudienciasFuturas(f.db, CLIENTE_A, AGORA)
    expect(aud.map(a => a.id)).toEqual(['ag1'])
    expect(aud[0]).toMatchObject({ tipo: 'Audiência de conciliação', modalidade: 'Por videoconferência', hora: '14:00', data: '2026-12-01' })
    expect(JSON.stringify(aud)).not.toMatch(/TITULO INTERNO|DESCRICAO INTERNA|Cristiano|prazo interno/)
    expect((await listarAudienciasFuturas(f.db, CLIENTE_B, AGORA)).map(a => a.id)).toEqual(['ag6'])
  })

  it('resumo conta só os visíveis', async () => {
    const f = criarFakeDb(seedBasico())
    const r = await montarResumo(f.db, CLIENTE_A, AGORA)
    expect(r.totalProcessos).toBe(1)
    expect(r.proximasAudiencias).toHaveLength(1)
    expect(r.ultimosAndamentos.map(a => a.id)).toEqual(['an1', 'an6'])
  })

  it('cliente sem processos visíveis → resumo vazio (sem consultar agenda)', async () => {
    const f = criarFakeDb(seedBasico())
    const r = await montarResumo(f.db, 'cliente-sem-nada', AGORA)
    expect(r).toMatchObject({ totalProcessos: 0, proximasAudiencias: [], ultimosAndamentos: [] })
  })
})

describe('migração ausente', () => {
  it('coluna ocultar_portal inexistente → PortalIndisponivel (a rota responde 503, não 500)', async () => {
    const f = criarFakeDb(seedBasico())
    f.falharTabela('processos', '42703')
    await expect(listarProcessosDoCliente(f.db, CLIENTE_A)).rejects.toMatchObject({ name: 'PortalIndisponivel' })
  })
})
