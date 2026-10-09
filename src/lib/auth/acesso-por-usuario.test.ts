import { describe, it, expect } from 'vitest'
import { getAllowedRoutes, roleCanAccessRoute } from '../permissions'

const MARCELO = '1a5ed586-77e0-4f6f-a652-444056d86b1b'
const DEBORA = 'dd154172-ebb2-498a-af49-c56ada33792a'
const OUTRO_ADVOGADO = '00000000-0000-0000-0000-000000000000'

describe('acesso por usuário — Marcelo (advogado)', () => {
  it('vê o menu do advogado sem Documentos, Monitoramento, IA Jurídica e Painel TV', () => {
    const rotas = getAllowedRoutes('advogado', MARCELO)
    expect(rotas).toEqual(expect.arrayContaining([
      '/dashboard', '/clientes', '/processos', '/inpi', '/agenda', '/kanban', '/publicacoes', '/ferramentas-pdf',
    ]))
    for (const bloqueada of ['/documentos', '/monitoramento', '/ia-juridica', '/tv/painel-diario']) {
      expect(rotas).not.toContain(bloqueada)
    }
  })

  it('não ganha nada que o papel advogado já não tinha', () => {
    const rotas = getAllowedRoutes('advogado', MARCELO)
    for (const proibida of ['/financeiro', '/comercial', '/relatorios', '/importar', '/automacoes', '/configuracoes', '/configuracoes/usuarios', '/dashboard/tv']) {
      expect(rotas).not.toContain(proibida)
    }
  })

  it('acessa as páginas liberadas e é barrado nas bloqueadas', () => {
    expect(roleCanAccessRoute('advogado', '/processos', MARCELO)).toBe(true)
    expect(roleCanAccessRoute('advogado', '/agenda', MARCELO)).toBe(true)
    expect(roleCanAccessRoute('advogado', '/documentos', MARCELO)).toBe(false)
    expect(roleCanAccessRoute('advogado', '/ia-juridica', MARCELO)).toBe(false)
    expect(roleCanAccessRoute('advogado', '/financeiro', MARCELO)).toBe(false)
  })

  it('outro advogado continua só com Kanban + INPI + Horas (modo restrito)', () => {
    expect(getAllowedRoutes('advogado', OUTRO_ADVOGADO)).toEqual(['/kanban', '/inpi', '/horas'])
    expect(getAllowedRoutes('advogado')).toEqual(['/kanban', '/inpi', '/horas'])
    expect(roleCanAccessRoute('advogado', '/processos', OUTRO_ADVOGADO)).toBe(false)
  })

  it('Débora tem exatamente o mesmo acesso do Marcelo', () => {
    expect(getAllowedRoutes('advogado', DEBORA)).toEqual(getAllowedRoutes('advogado', MARCELO))
    expect(roleCanAccessRoute('advogado', '/processos', DEBORA)).toBe(true)
    expect(roleCanAccessRoute('advogado', '/documentos', DEBORA)).toBe(false)
    expect(getAllowedRoutes('advogado', DEBORA)).not.toContain('/ia-juridica')
  })
})
