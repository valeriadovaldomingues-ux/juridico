import { describe, expect, it } from 'vitest'
import { andamentoVisivelNoPortal, descricaoParaCliente, filtrarVisiveisNoPortal, processoVisivelNoPortal } from './visibilidade'
import { listarAndamentos, listarAudienciasFuturas, listarPartes, listarProcessosDoCliente, montarResumo, obterProcessoDoCliente } from './consultas'
import { listarHoras, mesesComHoras } from './horas'
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

describe('descricaoParaCliente', () => {
  it('tira as marcas de uso interno e mantém o resto', () => {
    const bruto = 'Juntada: perícia em 11/11/2026, às 8h. Agendado; cliente a ser informado por e-mail. Tempo: 20 min. [registrado via Claude por Débora Brito]'
    expect(descricaoParaCliente(bruto)).toBe('Juntada: perícia em 11/11/2026, às 8h. Agendado; cliente a ser informado por e-mail.')
    expect(descricaoParaCliente('Realizada a audiência. (Fonte: EasyJur) [registrado via Claude por Débora Brito]')).toBe('Realizada a audiência.')
    expect(descricaoParaCliente('Perícia alterada. Agenda pedvprazos conferida: perícia médica 11/11. Fim.')).not.toContain('pedvprazos')
  })
  it('preserva parágrafos e devolve null quando sobra nada', () => {
    expect(descricaoParaCliente('Primeiro.\r\n\r\n\r\nSegundo.')).toBe('Primeiro.\n\nSegundo.')
    expect(descricaoParaCliente('[registrado via Claude por Ana]')).toBeNull()
    expect(descricaoParaCliente(null)).toBeNull()
  })
  it('não corta textos longos de 600 caracteres', () => {
    expect(descricaoParaCliente('a'.repeat(1500))).toHaveLength(1500)
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

describe('horas do cliente no portal', () => {
  const ent = (id: string, extra: Record<string, unknown> = {}) => ({
    id, cliente_id: CLIENTE_A, cobravel: true, status_cobranca: 'a_faturar', inicio_em: '2026-11-10T13:00:00Z',
    duracao_calculada_minutos: 90, duracao_manual_minutos: null, usa_duracao_manual: false,
    descricao_atividade: 'Elaboração de petição', processo_id: PROC_A1,
    // nada disto pode sair:
    valor_hora: 450, valor_total: 675, observacoes: 'cliente difícil', criado_por: 'u1', ...extra,
  })

  it('só tempo: sem valores, observações ou quem lançou; só horas cobráveis do próprio cliente', async () => {
    const base = seedBasico()
    base.agenda_time_entries = [
      ent('h1'),
      ent('h2', { cobravel: false }),
      ent('h3', { status_cobranca: 'nao_faturavel' }),
      ent('h4', { cliente_id: CLIENTE_B }),
      ent('h5', { duracao_calculada_minutos: 0 }),
      ent('h6', { usa_duracao_manual: true, duracao_manual_minutos: 30, inicio_em: '2026-10-05T03:30:00Z' }),
    ]
    const horas = await listarHoras(criarFakeDb(base).db, CLIENTE_A)
    expect(horas.map(h => [h.id, h.minutos])).toEqual([['h1', 90], ['h6', 30]])
    expect(horas[1].data).toBe('2026-10-05')   // 03:30Z = 00:30 em Brasília
    expect(JSON.stringify(horas)).not.toMatch(/valor|450|675|difícil|u1|criado_por/)
    expect(mesesComHoras(horas)).toEqual(['2026-11', '2026-10'])
  })

  it('processo oculto/segredo não mostra o número; atividade sem texto interno', async () => {
    const base = seedBasico()
    base.agenda_time_entries = [
      ent('h1'),
      ent('h2', { processo_id: PROC_A_SEGREDO }),
      ent('h3', { processo_id: PROC_A_OCULTO, descricao_atividade: 'Reunião [registrado via Claude por Ana]' }),
      ent('h4', { descricao_atividade: null, processo_id: null }),
    ]
    const horas = await listarHoras(criarFakeDb(base).db, CLIENTE_A)
    const por = Object.fromEntries(horas.map(h => [h.id, h]))
    expect(por.h1.processoNumero).toMatch(/^000/)
    expect(por.h2.processoNumero).toBeNull()
    expect(por.h3.processoNumero).toBeNull()
    expect(por.h3.atividade).toBe('Reunião')
    expect(por.h4.atividade).toBe('Atividade jurídica')
  })
})
