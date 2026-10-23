import { FERRAMENTAS, type ContextoMcp } from './ferramentas'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

// Mínimo do protocolo MCP (JSON-RPC 2.0 sobre HTTP, sem sessão nem SSE): initialize, ping, tools/list e tools/call.

const VERSOES = ['2025-06-18', '2025-03-26', '2024-11-05']
const INSTRUCOES = 'Conector do PEDV (Pessoa e do Val Advocacia): consulta processos, agenda, prazos e publicações e, para quem tem permissão, grava andamentos, compromissos e clientes. ' +
  'Toda gravação é em duas etapas: mostre o resumo ao usuário e só grave (confirmar=true) depois do "sim" dele. Nada é apagado. ' +
  'Dados sigilosos: use só para o trabalho do escritório e não repasse a terceiros.'

const ferramentasDe = (ctx: ContextoMcp) => (ctx.podeEscrever ? [...FERRAMENTAS, ...FERRAMENTAS_ESCRITA] : FERRAMENTAS)

export interface RespostaRpc { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

const erro = (id: RespostaRpc['id'], code: number, message: string): RespostaRpc => ({ jsonrpc: '2.0', id, error: { code, message } })

/** Responde a UMA mensagem. Devolve null para notificações (sem resposta). `auditar` registra cada chamada de ferramenta. */
export async function responderMcp(
  msg: unknown,
  ctx: ContextoMcp,
  auditar: (e: { ferramenta: string; args: unknown; ms: number; ok: boolean }) => void = () => {},
): Promise<RespostaRpc | null> {
  const m = msg as { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> } | null
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return erro(null, -32600, 'Requisição inválida')
  const id = m.id ?? null
  if (m.id === undefined) return null // notificação

  switch (m.method) {
    case 'initialize': {
      const pedida = String(m.params?.protocolVersion ?? '')
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'pedv', version: '1.0.0' },
        instructions: INSTRUCOES,
      } }
    }
    case 'ping': return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: ferramentasDe(ctx).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } }
    case 'tools/call': {
      const nome = String(m.params?.name ?? '')
      const f = ferramentasDe(ctx).find(x => x.name === nome)
      if (!f) return erro(id, -32602, `Ferramenta desconhecida: ${nome}`)
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>
      const t0 = Date.now()
      try {
        const dados = await f.executar(args, ctx)
        auditar({ ferramenta: nome, args, ms: Date.now() - t0, ok: true })
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(dados, null, 1) }] } }
      } catch (e) {
        auditar({ ferramenta: nome, args, ms: Date.now() - t0, ok: false })
        return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: e instanceof Error ? e.message : 'Erro ao consultar.' }] } }
      }
    }
    default: return erro(id, -32601, `Método não suportado: ${m.method}`)
  }
}
