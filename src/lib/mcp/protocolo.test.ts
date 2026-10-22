import { describe, expect, it } from 'vitest'
import { responderMcp } from './protocolo'

const ctx = { db: { from: () => { throw new Error('banco indisponível') }, rpc: () => ({}) }, userId: 'u1', nome: 'Débora' }

describe('protocolo MCP', () => {
  it('initialize devolve versão, capacidades e nome', async () => {
    const r = await responderMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, ctx)
    expect(r?.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'pedv' } })
  })
  it('notificações não têm resposta', async () => {
    expect(await responderMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)).toBeNull()
  })
  it('lista só ferramentas de leitura', async () => {
    const r = await responderMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx)
    const nomes = (r?.result as { tools: { name: string }[] }).tools.map(t => t.name)
    expect(nomes).toEqual(['agenda', 'prazos', 'buscar_processos', 'ver_processo', 'publicacoes'])
  })
  it('só quem pode escrever vê (e usa) as ferramentas de gravação', async () => {
    const leitura = await responderMcp({ jsonrpc: '2.0', id: 6, method: 'tools/list' }, ctx)
    expect((leitura?.result as { tools: { name: string }[] }).tools.some(t => t.name === 'criar_andamento')).toBe(false)
    const negada = await responderMcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'criar_andamento', arguments: {} } }, ctx)
    expect(negada?.error?.code).toBe(-32602)
    const escrita = await responderMcp({ jsonrpc: '2.0', id: 8, method: 'tools/list' }, { ...ctx, podeEscrever: true })
    const nomes = (escrita?.result as { tools: { name: string }[] }).tools.map(t => t.name)
    expect(nomes).toEqual(expect.arrayContaining(['criar_andamento', 'criar_compromisso', 'concluir_compromisso', 'cadastrar_cliente', 'atualizar_cliente', 'cadastrar_processo', 'atualizar_processo', 'adicionar_parte_processo', 'tratar_publicacao']))
    expect(nomes.some(n => /apagar|excluir|deletar/.test(n))).toBe(false)
  })
  it('gravação sem confirmar=true só devolve o resumo (nada é gravado)', async () => {
    const inserts: unknown[] = []
    const db = { rpc: () => ({}), from: (t: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p1', numero_processo: '0001', titulo: 'Proc' }, error: null }) }) }),
      insert: (v: unknown) => { inserts.push([t, v]); return { select: () => ({ single: async () => ({ data: { id: 'novo' }, error: null }) }) } },
    }) }
    const c = { db, userId: 'u1', nome: 'Débora', podeEscrever: true }
    const args = { processo_id: '11111111-1111-1111-1111-111111111111', titulo: 'Juntada de petição' }
    const previa = await responderMcp({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'criar_andamento', arguments: args } }, c)
    expect(JSON.stringify(previa?.result)).toContain('confirmacao_necessaria')
    expect(inserts).toHaveLength(0)
    const gravado = await responderMcp({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'criar_andamento', arguments: { ...args, confirmar: true } } }, c)
    expect(JSON.stringify(gravado?.result)).toContain('gravado')
    expect(inserts).toHaveLength(1)
    expect(JSON.stringify(inserts[0])).toContain('registrado via Claude por Débora')
  })
  it('erro na ferramenta vira isError e é auditado', async () => {
    const auditoria: unknown[] = []
    const r = await responderMcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'agenda', arguments: {} } }, ctx, e => auditoria.push(e))
    expect((r?.result as { isError: boolean }).isError).toBe(true)
    expect(auditoria).toHaveLength(1)
  })
  it('recusa ferramenta desconhecida, método desconhecido e requisição inválida', async () => {
    expect((await responderMcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'apagar_tudo' } }, ctx))?.error?.code).toBe(-32602)
    expect((await responderMcp({ jsonrpc: '2.0', id: 5, method: 'resources/list' }, ctx))?.error?.code).toBe(-32601)
    expect((await responderMcp({ foo: 1 }, ctx))?.error?.code).toBe(-32600)
  })
})
