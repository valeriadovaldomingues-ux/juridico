import { describe, expect, it } from 'vitest'
import { lerInteracao, lerOportunidade, lerProposta, ehUUID } from './validacao'
import { lerValorBR, formatarDataISO, formatarBRL } from './formato'
import { ehTabelaAusente } from './modulo'

const UUID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'

describe('lerOportunidade', () => {
  it('criar exige nome', () => {
    expect(lerOportunidade({}, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: '   ' }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'Empresa X' }, 'criar')).toEqual({ ok: true, dados: { nome: 'Empresa X' } })
  })

  it('editar aceita subconjunto (PATCH) e não exige nome', () => {
    expect(lerOportunidade({ notas: 'olá' }, 'editar')).toEqual({ ok: true, dados: { notas: 'olá' } })
  })

  it('corpo que não é objeto é recusado', () => {
    expect(lerOportunidade(null, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade([], 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade('x', 'editar')).toMatchObject({ ok: false })
  })

  it('texto vazio vira null e texto é aparado', () => {
    const r = lerOportunidade({ nome: '  A  ', origem: '  evento ', indicado_por: '   ' }, 'criar')
    expect(r).toEqual({ ok: true, dados: { nome: 'A', origem: 'evento', indicado_por: null } })
  })

  it('valida tipo de pessoa, etapa, responsável e cliente', () => {
    expect(lerOportunidade({ nome: 'A', tipo_pessoa: 'pj' }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', tipo_pessoa: 'fisica' }, 'criar')).toMatchObject({ ok: true })
    expect(lerOportunidade({ nome: 'A', etapa: 'diagnostico' }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', etapa: 'negociacao' }, 'criar')).toMatchObject({ ok: true })
    expect(lerOportunidade({ nome: 'A', responsavel_id: 'nao-uuid' }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', responsavel_id: UUID }, 'criar')).toMatchObject({ ok: true })
    expect(lerOportunidade({ nome: 'A', responsavel_id: '' }, 'criar')).toEqual({ ok: true, dados: { nome: 'A', responsavel_id: null } })
    expect(lerOportunidade({ nome: 'A', cliente_id: 'x' }, 'criar')).toMatchObject({ ok: false })
  })

  it('NÃO aceita status do cliente da API (status vem da etapa)', () => {
    const r = lerOportunidade({ nome: 'A', status: 'ganho' }, 'criar')
    expect(r).toEqual({ ok: true, dados: { nome: 'A' } })
  })

  it('valor estimado: números, formato BR e inválidos', () => {
    expect(lerOportunidade({ nome: 'A', valor_estimado: 1500 }, 'criar')).toMatchObject({ dados: { valor_estimado: 1500 } })
    expect(lerOportunidade({ nome: 'A', valor_estimado: '1.500,50' }, 'criar')).toMatchObject({ dados: { valor_estimado: 1500.5 } })
    expect(lerOportunidade({ nome: 'A', valor_estimado: '' }, 'criar')).toMatchObject({ dados: { valor_estimado: null } })
    expect(lerOportunidade({ nome: 'A', valor_estimado: -1 }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', valor_estimado: 'abc' }, 'criar')).toMatchObject({ ok: false })
  })

  it('data da próxima ação: ISO válida, vazio limpa, lixo recusa', () => {
    expect(lerOportunidade({ nome: 'A', proxima_acao_data: '2026-12-01' }, 'criar')).toMatchObject({ dados: { proxima_acao_data: '2026-12-01' } })
    expect(lerOportunidade({ nome: 'A', proxima_acao_data: '' }, 'criar')).toMatchObject({ dados: { proxima_acao_data: null } })
    expect(lerOportunidade({ nome: 'A', proxima_acao_data: '01/12/2026' }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', proxima_acao_data: '2026-02-31' }, 'criar')).toMatchObject({ ok: false })
  })

  it('limites de tamanho', () => {
    expect(lerOportunidade({ nome: 'x'.repeat(201) }, 'criar')).toMatchObject({ ok: false })
    expect(lerOportunidade({ nome: 'A', notas: 'x'.repeat(10_001) }, 'criar')).toMatchObject({ ok: false })
  })

  it('campo de texto com tipo errado é recusado', () => {
    expect(lerOportunidade({ nome: 'A', origem: 123 }, 'criar')).toMatchObject({ ok: false })
  })
})

describe('lerInteracao', () => {
  const AGORA = new Date('2026-11-15T15:00:00.000Z')

  it('exige tipo válido e descrição', () => {
    expect(lerInteracao({ tipo: 'sms', descricao: 'x' }, AGORA)).toMatchObject({ ok: false })
    expect(lerInteracao({ tipo: 'nota', descricao: '  ' }, AGORA)).toMatchObject({ ok: false })
    expect(lerInteracao(undefined, AGORA)).toMatchObject({ ok: false })
  })

  it('aceita os 5 tipos pedidos', () => {
    for (const tipo of ['ligacao', 'reuniao', 'whatsapp', 'email', 'nota']) {
      expect(lerInteracao({ tipo, descricao: 'ok' }, AGORA)).toMatchObject({ ok: true })
    }
  })

  it('sem data usa agora', () => {
    expect(lerInteracao({ tipo: 'nota', descricao: 'ok' }, AGORA)).toEqual({
      ok: true, dados: { tipo: 'nota', descricao: 'ok', data_interacao: AGORA.toISOString() },
    })
  })

  it('data yyyy-mm-dd vira meio-dia local (não escorrega de dia)', () => {
    const r = lerInteracao({ tipo: 'nota', descricao: 'ok', data_interacao: '2026-11-10' }, AGORA)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const d = new Date(r.dados.data_interacao)
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(10)
      expect(d.getDate()).toBe(10)
    }
  })

  it('data inválida é recusada', () => {
    expect(lerInteracao({ tipo: 'nota', descricao: 'ok', data_interacao: 'ontem' }, AGORA)).toMatchObject({ ok: false })
  })
})

describe('lerProposta', () => {
  it('criar exige oportunidade (uuid) e título', () => {
    expect(lerProposta({ titulo: 'T' }, 'criar')).toMatchObject({ ok: false })
    expect(lerProposta({ oportunidade_id: 'x', titulo: 'T' }, 'criar')).toMatchObject({ ok: false })
    expect(lerProposta({ oportunidade_id: UUID }, 'criar')).toMatchObject({ ok: false })
    expect(lerProposta({ oportunidade_id: UUID, titulo: 'T' }, 'criar')).toEqual({ ok: true, dados: { oportunidade_id: UUID, titulo: 'T' } })
  })

  it('editar aceita subconjunto e ignora oportunidade_id', () => {
    expect(lerProposta({ status: 'aceita' }, 'editar')).toEqual({ ok: true, dados: { status: 'aceita' } })
    expect(lerProposta({ oportunidade_id: UUID, status: 'aceita' }, 'editar')).toEqual({ ok: true, dados: { status: 'aceita' } })
  })

  it('valida tipo de honorário e status', () => {
    for (const t of ['fixo', 'mensal', 'exito', 'misto']) expect(lerProposta({ tipo_honorario: t }, 'editar')).toMatchObject({ ok: true })
    for (const s of ['rascunho', 'enviada', 'aceita', 'recusada']) expect(lerProposta({ status: s }, 'editar')).toMatchObject({ ok: true })
    expect(lerProposta({ tipo_honorario: 'percentual' }, 'editar')).toMatchObject({ ok: false })
    expect(lerProposta({ status: 'em_elaboracao' }, 'editar')).toMatchObject({ ok: false })
  })

  it('valor e datas', () => {
    expect(lerProposta({ valor: '2.500,00' }, 'editar')).toEqual({ ok: true, dados: { valor: 2500 } })
    expect(lerProposta({ valor: -10 }, 'editar')).toMatchObject({ ok: false })
    expect(lerProposta({ data_envio: '2026-11-01', validade: '2026-11-30' }, 'editar')).toMatchObject({ ok: true })
    expect(lerProposta({ data_envio: '2026-11-10', validade: '2026-11-01' }, 'editar')).toMatchObject({ ok: false })
    expect(lerProposta({ data_envio: 'ontem' }, 'editar')).toMatchObject({ ok: false })
    expect(lerProposta({ validade: '' }, 'editar')).toEqual({ ok: true, dados: { validade: null } })
  })
})

describe('ehUUID', () => {
  it('reconhece UUIDs', () => {
    expect(ehUUID(UUID)).toBe(true)
    expect(ehUUID('1')).toBe(false)
    expect(ehUUID(null)).toBe(false)
  })
})

describe('formato', () => {
  it('lerValorBR entende formatos brasileiros', () => {
    expect(lerValorBR('1.500,50')).toBe(1500.5)
    expect(lerValorBR('1500,5')).toBe(1500.5)
    expect(lerValorBR('1500.50')).toBe(1500.5)
    expect(lerValorBR('1.500')).toBe(1500)
    expect(lerValorBR('1.500.000')).toBe(1_500_000)
    expect(lerValorBR('R$ 2.000')).toBe(2000)
    expect(lerValorBR('')).toBeNull()
    expect(lerValorBR(null)).toBeNull()
    expect(lerValorBR(42)).toBe(42)
    expect(Number.isNaN(lerValorBR('abc'))).toBe(true)
  })

  it('formatarDataISO não escorrega de dia', () => {
    expect(formatarDataISO('2026-11-15')).toBe('15/11/2026')
    expect(formatarDataISO(null)).toBe('—')
  })

  it('formatarBRL', () => {
    expect(formatarBRL(null)).toBe('—')
    expect(formatarBRL(1500, true)).toMatch(/1\.500/)
  })
})

describe('tabela ausente (módulo ainda não ativado)', () => {
  it('reconhece os erros do PostgREST e do Postgres', () => {
    expect(ehTabelaAusente({ code: 'PGRST205', message: "Could not find the table 'public.crm_socios_oportunidades' in the schema cache" })).toBe(true)
    expect(ehTabelaAusente({ code: '42P01', message: 'relation "crm_socios_oportunidades" does not exist' })).toBe(true)
    expect(ehTabelaAusente({ code: 'PGRST200', message: "Could not find a relationship between 'crm_socios_oportunidades' and 'profiles'" })).toBe(true)
    expect(ehTabelaAusente({ message: 'relation "public.crm_socios_propostas" does not exist' })).toBe(true)
  })

  it('não confunde com outros erros', () => {
    expect(ehTabelaAusente(null)).toBe(false)
    expect(ehTabelaAusente(undefined)).toBe(false)
    expect(ehTabelaAusente({ code: '42501', message: 'permission denied for table crm_socios_oportunidades' })).toBe(false)
    expect(ehTabelaAusente({ code: 'PGRST200', message: "Could not find a relationship between 'leads' and 'profiles'" })).toBe(false)
    expect(ehTabelaAusente({ code: '23503', message: 'foreign key violation' })).toBe(false)
  })
})
