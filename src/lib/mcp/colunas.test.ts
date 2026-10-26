import { describe, expect, it } from 'vitest'
import { FERRAMENTAS } from './ferramentas'

// Colunas que a tabela processos realmente tem (as do formulário de processos). Se uma ferramenta pedir outra,
// a consulta quebra em produção ("column processos.xxx does not exist") — este teste pega antes.
const COLUNAS_PROCESSOS = new Set([
  'id', 'titulo', 'numero_processo', 'area_direito', 'status', 'fase', 'cliente_id', 'advogado_responsavel_id', 'advogado_caso_id', 'tribunal', 'vara',
  'valor_causa', 'data_distribuicao', 'observacoes', 'comarca', 'classe_processual', 'assunto', 'segredo_justica', 'created_at',
])

function dbEspiao() {
  const selects: Record<string, string[]> = {}
  const cadeia = (tabela: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {}
    for (const m of ['eq', 'neq', 'in', 'gte', 'lte', 'ilike', 'order', 'limit', 'or']) c[m] = () => c
    c.select = (cols: string) => { (selects[tabela] ??= []).push(cols); return c }
    c.maybeSingle = async () => ({ data: null, error: null })
    c.then = (r: (v: unknown) => void) => r({ data: [], error: null })
    return c
  }
  return { selects, db: { from: (t: string) => cadeia(t), rpc: () => ({ data: ['11111111-1111-1111-1111-111111111111'], error: null }) } }
}

describe('colunas pedidas pelas ferramentas de leitura', () => {
  it('só pedem colunas que existem em processos (incluindo as de join)', async () => {
    const { selects, db } = dbEspiao()
    const ctx = { db, userId: 'u', nome: 'Débora' }
    const id = '11111111-1111-1111-1111-111111111111'
    await FERRAMENTAS.find(f => f.name === 'ver_processo')!.executar({ id }, ctx).catch(() => {})
    await FERRAMENTAS.find(f => f.name === 'buscar_processos')!.executar({ texto: 'abc' }, ctx).catch(() => {})
    const colunas = (selects.processos ?? []).flatMap(s => s.split(',').map(c => c.trim()).filter(c => c && !c.includes(':') && !c.includes('(')))
    expect(colunas.length).toBeGreaterThan(0)
    for (const c of colunas) expect(COLUNAS_PROCESSOS.has(c), `coluna inexistente em processos: ${c}`).toBe(true)
    expect(colunas).not.toContain('descricao')
  })
})
