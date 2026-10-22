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
