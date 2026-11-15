import { describe, expect, it } from 'vitest'
import { montarRelatorioDoCliente } from './cliente'
import { criarFakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, PROC_A1, seedBasico } from '@/lib/portal-cliente/testing/seed'

describe('relatório sintético — versão cliente', () => {
  it('só processos visíveis, sem financeiro, sem advogado, sem parte contrária interna e sem observações', async () => {
    const f = criarFakeDb(seedBasico())
    const r = await montarRelatorioDoCliente(f.db, CLIENTE_A, 'Maria da Silva', new Date('2026-11-15T12:00:00Z'))
    expect(r.pessoa).toBe('Maria da Silva')
    expect(r.processos.map(p => p.id)).toEqual([PROC_A1])
    const p = r.processos[0]
    expect(p.valorCausa).toBeNull()
    expect(p.advogado).toBeNull()
    expect(p.contrario).toBeNull()
    expect(p.cliente).toBeNull()
    expect(JSON.stringify(r)).not.toMatch(/ESTRATEGIA|987654|TEXTO INTERNO|nervoso|nota interna|529\.982|José Vínculo|Aurora|IA/)
  })

  it('andamentos do relatório são só os client-safe', async () => {
    const f = criarFakeDb(seedBasico())
    const r = await montarRelatorioDoCliente(f.db, CLIENTE_A, 'Maria da Silva')
    expect(r.processos[0].andamentos.map(a => a.descricao)).toEqual(['Julgado procedente.', 'Petição protocolada'])
  })

  it('cliente sem processos visíveis → relatório vazio', async () => {
    const f = criarFakeDb(seedBasico())
    expect((await montarRelatorioDoCliente(f.db, 'ninguem', 'Fulano')).processos).toEqual([])
  })
})
