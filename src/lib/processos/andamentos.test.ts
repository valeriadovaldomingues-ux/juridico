import { describe, expect, it } from 'vitest'
import {
  ANDAMENTO_ORIGEM_LABELS,
  ANDAMENTO_TIPO_LABELS,
  buildAndamentosAuroraContext,
  normalizeAndamentoOrigem,
  normalizeAndamentoTipo,
} from './andamentos'

describe('andamentos helpers', () => {
  it('normaliza tipo e origem', () => {
    expect(normalizeAndamentoTipo('DECISAO')).toBe('decisao')
    expect(normalizeAndamentoTipo('inexistente')).toBe('outro')
    expect(normalizeAndamentoOrigem('PUBLICACAO')).toBe('publicacao')
    expect(normalizeAndamentoOrigem('inexistente')).toBe('manual')
  })

  it('mantém labels consistentes', () => {
    expect(ANDAMENTO_TIPO_LABELS.decisao).toBe('Decisão')
    expect(ANDAMENTO_ORIGEM_LABELS.aurora).toBe('Aurora')
  })

  it('gera contexto textual para a Aurora sem expor estrutura sensível', () => {
    const contexto = buildAndamentosAuroraContext([
      {
        id: 'a1',
        processo_id: 'p1',
        data_andamento: '2026-06-01T10:15:00Z',
        tipo: 'decisao',
        titulo: 'Sentença publicada',
        descricao: 'Decisão favorável.',
        origem: 'tribunal',
        responsavel_id: 'u1',
        criado_por: 'u2',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:15:00Z',
        responsavel: { id: 'u1', nome: 'Responsável', email: 'resp@x.com', role: 'advogado', ativo: true, created_at: '2026-01-01T00:00:00Z' },
        criado_por_profile: { id: 'u2', nome: 'Criador', email: 'cr@x.com', role: 'socio', ativo: true, created_at: '2026-01-01T00:00:00Z' },
      },
    ])

    expect(contexto).toContain('Andamentos do processo:')
    expect(contexto).toContain('Sentença publicada')
    expect(contexto).toContain('Origem: Tribunal')
    expect(contexto).toContain('A análise profunda de conteúdo ainda será implementada em fase posterior.')
  })
})
