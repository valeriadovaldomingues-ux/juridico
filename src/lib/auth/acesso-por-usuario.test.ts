import { describe, it, expect } from 'vitest'
import { getAllowedRoutes, roleCanAccessRoute } from '../permissions'

const MARCELO = '1a5ed586-77e0-4f6f-a652-444056d86b1b'
const DEBORA = 'dd154172-ebb2-498a-af49-c56ada33792a'
const CELIO = '3baf1f52-4950-4a1e-937a-126ce0fa1e34'
const TUANE = '80be07bd-e23a-4ece-aa02-a7cde54bf6c7'
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

  it('qualquer advogado (mesmo sem ajuste pessoal) tem o mesmo acesso da Débora', () => {
    expect(getAllowedRoutes('advogado', OUTRO_ADVOGADO)).toEqual(getAllowedRoutes('advogado', DEBORA))
    expect(getAllowedRoutes('advogado')).toEqual(getAllowedRoutes('advogado', DEBORA))
    expect(roleCanAccessRoute('advogado', '/processos', OUTRO_ADVOGADO)).toBe(true)
    expect(roleCanAccessRoute('advogado', '/documentos', OUTRO_ADVOGADO)).toBe(false)
  })

  it('gerente e estagiário ganham o mesmo conjunto da Débora, sem nada a mais', () => {
    const debora = getAllowedRoutes('advogado', DEBORA).sort()
    for (const papel of ['gerente', 'estagiario'] as const) {
      const rotas = getAllowedRoutes(papel).sort()
      expect(rotas).toEqual(debora)
    }
  })

  it('administrativo e comercial não mudam', () => {
    expect(getAllowedRoutes('administrativo')).toEqual(['/kanban', '/inpi', '/horas', '/reunioes'])
    expect(roleCanAccessRoute('administrativo', '/processos')).toBe(false)
    expect(roleCanAccessRoute('comercial', '/comercial')).toBe(true)
  })


  it('Débora tem exatamente o mesmo acesso do Marcelo', () => {
    expect(getAllowedRoutes('advogado', DEBORA)).toEqual(getAllowedRoutes('advogado', MARCELO))
    expect(roleCanAccessRoute('advogado', '/processos', DEBORA)).toBe(true)
    expect(roleCanAccessRoute('advogado', '/documentos', DEBORA)).toBe(false)
    expect(getAllowedRoutes('advogado', DEBORA)).not.toContain('/ia-juridica')
  })
})


describe('acesso por usuário — Tuane (advogada com Relatórios)', () => {
  it('vê Relatórios no menu e acessa a página', () => {
    expect(getAllowedRoutes('advogado', TUANE)).toContain('/relatorios')
    expect(roleCanAccessRoute('advogado', '/relatorios', TUANE)).toBe(true)
  })

  it('o resto do acesso é igual ao dos outros advogados', () => {
    const semRelatorios = getAllowedRoutes('advogado', TUANE).filter(r => r !== '/relatorios')
    expect(semRelatorios).toEqual(getAllowedRoutes('advogado', DEBORA))
    expect(roleCanAccessRoute('advogado', '/documentos', TUANE)).toBe(false)
    expect(roleCanAccessRoute('advogado', '/financeiro', TUANE)).toBe(false)
  })

  it('só ela: outros advogados, estagiário e gerente-sem-ajuste não ganham Relatórios por isso', () => {
    expect(getAllowedRoutes('advogado', DEBORA)).not.toContain('/relatorios')
    expect(roleCanAccessRoute('advogado', '/relatorios', DEBORA)).toBe(false)
    expect(roleCanAccessRoute('advogado', '/relatorios', OUTRO_ADVOGADO)).toBe(false)
    expect(roleCanAccessRoute('estagiario', '/relatorios', OUTRO_ADVOGADO)).toBe(false)
  })
})


describe('acesso por usuário — Célio (administrativo com Financeiro)', () => {
  it('vê Financeiro no menu, mas não Cobranças', () => {
    const rotas = getAllowedRoutes('administrativo', CELIO)
    expect(rotas).toContain('/financeiro')
    expect(rotas).not.toContain('/financeiro/cobrancas')
    expect(rotas).toEqual(expect.arrayContaining(['/kanban', '/inpi', '/horas', '/reunioes']))
  })

  it('acessa /financeiro e /financeiro/despesas; Cobranças é barrada', () => {
    expect(roleCanAccessRoute('administrativo', '/financeiro', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/financeiro/despesas', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/financeiro/cobrancas', CELIO)).toBe(false)
  })

  it('vê Dashboard, Agenda, Clientes, Processos e Ferramentas PDF (liberados em 13/10/2026)', () => {
    const rotas = getAllowedRoutes('administrativo', CELIO)
    expect(rotas).toEqual(expect.arrayContaining(['/dashboard', '/agenda', '/clientes', '/processos', '/ferramentas-pdf']))
    expect(roleCanAccessRoute('administrativo', '/dashboard', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/agenda', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/processos/novo', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/clientes', CELIO)).toBe(true)
    expect(roleCanAccessRoute('administrativo', '/ferramentas-pdf', CELIO)).toBe(true)
  })

  it('continua no modo restrito para o resto (Documentos, Importar…) e sem rotas de sócio', () => {
    expect(roleCanAccessRoute('administrativo', '/documentos', CELIO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/importar', CELIO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/configuracoes/usuarios', CELIO)).toBe(false)
  })

  it('outro administrativo (ex.: Luana) não ganha nada disso', () => {
    expect(getAllowedRoutes('administrativo', OUTRO_ADVOGADO)).not.toContain('/financeiro')
    expect(roleCanAccessRoute('administrativo', '/processos', OUTRO_ADVOGADO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/clientes', OUTRO_ADVOGADO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/agenda', OUTRO_ADVOGADO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/dashboard', OUTRO_ADVOGADO)).toBe(false)
    expect(roleCanAccessRoute('administrativo', '/financeiro', OUTRO_ADVOGADO)).toBe(false)
  })
})
