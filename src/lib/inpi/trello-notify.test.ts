import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateCard } = vi.hoisted(() => ({ mockCreateCard: vi.fn() }))

vi.mock('@/lib/trello/api', () => ({ createCard: mockCreateCard }))

import { notificarMovimentacaoInpiNoTrello } from './trello-notify'

const PLANILHA_SEMANAL_LIST_ID = '6a723d7b21d16bce6a6986b5'

type Row = Record<string, unknown>

/** Fake mínimo do client Supabase — cobre só as tabelas tocadas aqui. */
function supabaseFake(opts: {
  integracao?: Row | null
  membros?: Row[]
}) {
  return {
    from(table: string) {
      if (table === 'trello_integrations') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: opts.integracao ?? null, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'trello_member_mappings') {
        return {
          select: () => ({
            in: async () => ({ data: opts.membros ?? [], error: null }),
          }),
        }
      }
      throw new Error(`tabela inesperada no fake: ${table}`)
    },
  }
}

const PROCESSO = { numero_processo: '913318566', titulo: 'ACME', cliente: { nome: 'Cliente Teste' } }
const MOVIMENTACAO = { descricao: 'Concessão de registro', rpi_data: '2026-09-22', codigo_despacho: 'IPAS158', origem: 'rpi_auto' as const }

beforeEach(() => {
  mockCreateCard.mockReset()
  mockCreateCard.mockResolvedValue({ id: 'card-1' })
})

describe('notificarMovimentacaoInpiNoTrello', () => {
  it('cria card na lista PLANILHA SEMANAL com os membros mapeados', async () => {
    const supabase = supabaseFake({
      integracao: { api_key: 'key-1', api_token: 'token-1' },
      membros: [
        { trello_member_id: 'member-sidiney', trello_username: 'sidineyduarteribeiro1' },
        { trello_member_id: 'member-cristiano', trello_username: 'cristianopessoa2' },
      ],
    })

    await notificarMovimentacaoInpiNoTrello(supabase, { processo: PROCESSO, movimentacao: MOVIMENTACAO })

    expect(mockCreateCard).toHaveBeenCalledTimes(1)
    const [listId, card, key, token] = mockCreateCard.mock.calls[0]
    expect(listId).toBe(PLANILHA_SEMANAL_LIST_ID)
    expect(card.name).toContain('913318566')
    expect(card.name).toContain('ACME')
    expect(card.desc).toContain('Concessão de registro')
    expect(card.desc).toContain('Cliente Teste')
    expect(card.idMembers).toEqual(['member-sidiney', 'member-cristiano'])
    expect(key).toBe('key-1')
    expect(token).toBe('token-1')
  })

  it('normaliza cliente vindo como array (embed do Supabase)', async () => {
    const supabase = supabaseFake({
      integracao: { api_key: 'key-1', api_token: 'token-1' },
      membros: [],
    })

    await notificarMovimentacaoInpiNoTrello(supabase, {
      processo: { ...PROCESSO, cliente: [{ nome: 'Cliente Array' }] },
      movimentacao: MOVIMENTACAO,
    })

    const card = mockCreateCard.mock.calls[0][1]
    expect(card.desc).toContain('Cliente Array')
  })

  it('usa placeholder quando não há cliente vinculado', async () => {
    const supabase = supabaseFake({ integracao: { api_key: 'key-1', api_token: 'token-1' }, membros: [] })

    await notificarMovimentacaoInpiNoTrello(supabase, {
      processo: { ...PROCESSO, cliente: null },
      movimentacao: MOVIMENTACAO,
    })

    const card = mockCreateCard.mock.calls[0][1]
    expect(card.desc).toContain('(a preencher)')
  })

  it('não cria card e não lança quando não há integração Trello ativa', async () => {
    const supabase = supabaseFake({ integracao: null })

    await expect(
      notificarMovimentacaoInpiNoTrello(supabase, { processo: PROCESSO, movimentacao: MOVIMENTACAO }),
    ).resolves.toBeUndefined()

    expect(mockCreateCard).not.toHaveBeenCalled()
  })

  it('nunca lança quando o Trello falha (best-effort)', async () => {
    mockCreateCard.mockRejectedValue(new Error('Trello 500: fora do ar'))
    const supabase = supabaseFake({ integracao: { api_key: 'key-1', api_token: 'token-1' }, membros: [] })

    await expect(
      notificarMovimentacaoInpiNoTrello(supabase, { processo: PROCESSO, movimentacao: MOVIMENTACAO }),
    ).resolves.toBeUndefined()
  })
})
