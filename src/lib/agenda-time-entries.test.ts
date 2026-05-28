import { describe, expect, it } from 'vitest'
import {
  buildAgendaTimeEntrySummary,
  calculateDurationMinutes,
  calculateEstimatedValue,
  createAgendaTimeEntryPayload,
  formatCurrencyBRL,
  formatDurationMinutes,
} from './agenda-time-entries'

describe('agenda time entries helpers', () => {
  it('calcula duração, valor e resumo de forma consistente', () => {
    expect(calculateDurationMinutes('2026-05-28T09:00:00-03:00', '2026-05-28T10:30:00-03:00')).toBe(90)
    expect(formatDurationMinutes(90)).toBe('1h 30m')
    expect(formatCurrencyBRL(150)).toBe('R$ 150,00')
    expect(calculateEstimatedValue(90, 200, true, 'pendente')).toBe(300)

    const payload = createAgendaTimeEntryPayload({
      agenda_item_id: '11111111-1111-1111-1111-111111111111',
      inicio_em: '2026-05-28T09:00:00-03:00',
      fim_em: '2026-05-28T10:30:00-03:00',
      cobravel: false,
      valor_hora: 200,
    })

    expect(payload.duracao_calculada_minutos).toBe(90)
    expect(payload.status_cobranca).toBe('nao_faturavel')
    expect(payload.valor_total).toBeNull()

    const summary = buildAgendaTimeEntrySummary([
      {
        id: 'entry-1',
        agenda_item_id: '11111111-1111-1111-1111-111111111111',
        inicio_em: '2026-05-28T09:00:00-03:00',
        fim_em: '2026-05-28T10:00:00-03:00',
        duracao_calculada_minutos: 60,
        duracao_manual_minutos: null,
        usa_duracao_manual: false,
        descricao_atividade: 'Análise',
        cobravel: true,
        valor_hora: 100,
        valor_total: 100,
        observacoes: null,
        status_cobranca: 'pendente',
        criado_por: 'profile-1',
        created_at: '2026-05-28T10:00:00Z',
        updated_at: '2026-05-28T10:00:00Z',
        cliente_id: null,
        processo_id: null,
        financeiro_lancamento_id: null,
      },
      {
        id: 'entry-2',
        agenda_item_id: '11111111-1111-1111-1111-111111111111',
        inicio_em: '2026-05-28T11:00:00-03:00',
        fim_em: '2026-05-28T11:30:00-03:00',
        duracao_calculada_minutos: 30,
        duracao_manual_minutos: null,
        usa_duracao_manual: false,
        descricao_atividade: 'Reunião',
        cobravel: false,
        valor_hora: 100,
        valor_total: null,
        observacoes: null,
        status_cobranca: 'nao_faturavel',
        criado_por: 'profile-1',
        created_at: '2026-05-28T11:30:00Z',
        updated_at: '2026-05-28T11:30:00Z',
        cliente_id: null,
        processo_id: null,
        financeiro_lancamento_id: null,
      },
    ])

    expect(summary).toMatchObject({
      entryCount: 2,
      totalMinutes: 90,
      billableMinutes: 60,
      nonBillableMinutes: 30,
      estimatedValue: 100,
    })
  })
})
