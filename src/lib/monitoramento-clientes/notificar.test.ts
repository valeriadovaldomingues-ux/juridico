import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { montarEmailResumo, notificarAlertasPendentes } from './notificar'
import { dataBR, formatarNumeroCNJ } from './formatar'

const alerta = (extra: Record<string, unknown> = {}) => ({
  id: 'a1', numero_processo: '00012345620245030001', tribunal: 'TRT3', orgao: '1ª Vara do Trabalho',
  polo: 'P', tipo_comunicacao: 'Intimação', data_disponibilizacao: '2026-11-10', link: 'https://djen/1',
  possivel_homonimo: false, monitoramento: { nome_principal: 'Acme Ltda' }, ...extra,
})

/** Banco falso: alertas pendentes, perfis e registro do update de avisado_em. */
function banco(opts: { alertas?: unknown[]; perfis?: unknown[]; erroAlertas?: { message: string } } = {}) {
  const marcados: string[][] = []
  const cliente = {
    from(tabela: string) {
      let op = 'select'
      let ids: string[] = []
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b, is: () => b, order: () => b, limit: () => b,
        update: () => { op = 'update'; return b },
        in: (_c: string, v: string[]) => { ids = v; return b },
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(() => {
          if (tabela === 'monitoramento_alertas' && op === 'select') return { data: opts.alertas ?? [], error: opts.erroAlertas ?? null }
          if (tabela === 'monitoramento_alertas' && op === 'update') { marcados.push(ids); return { data: null, error: null } }
          if (tabela === 'profiles') return { data: opts.perfis ?? [], error: null }
          throw new Error(`consulta não prevista: ${tabela}`)
        }).then(res, rej),
      }
      return b
    },
  } as unknown as SupabaseClient
  return { cliente, marcados }
}

describe('formatadores', () => {
  it('formatarNumeroCNJ e dataBR', () => {
    expect(formatarNumeroCNJ('00012345620245030001')).toBe('0001234-56.2024.5.03.0001')
    expect(formatarNumeroCNJ('123')).toBe('123')
    expect(dataBR('2026-11-10')).toBe('10/11/2026')
    expect(dataBR(null)).toBe('data não informada')
  })
})

describe('montarEmailResumo', () => {
  it('agrupa por cliente e traz número, tribunal, polo, tipo, data e link', () => {
    const { subject, text } = montarEmailResumo([
      { ...alerta(), cliente: 'Acme Ltda' },
      { ...alerta({ id: 'a2', numero_processo: '00098765420245030002', polo: 'A', link: null }), cliente: 'Acme Ltda' },
      { ...alerta({ id: 'a3', possivel_homonimo: true }), cliente: 'Maria da Silva' },
    ] as never)
    expect(subject).toBe('Clientes monitorados: 3 processos novos sem cadastro')
    expect(text.match(/Acme Ltda\n•/g)).toHaveLength(1)
    expect(text).toContain('0001234-56.2024.5.03.0001 — TRT3 (1ª Vara do Trabalho)')
    expect(text).toContain('POLO PASSIVO (réu) · Intimação · disponibilizado em 10/11/2026')
    expect(text).toContain('polo ativo (autor)')
    expect(text).toContain('https://djen/1')
    expect(text).toContain('pode ser homônimo')
  })
  it('singular no assunto', () => {
    expect(montarEmailResumo([{ ...alerta(), cliente: 'X' }] as never).subject).toBe('Clientes monitorados: 1 processo novo sem cadastro')
  })
})

describe('notificarAlertasPendentes', () => {
  it('envia UM e-mail aos sócios ativos e marca avisado_em', async () => {
    const { cliente, marcados } = banco({
      alertas: [alerta(), alerta({ id: 'a2' })],
      perfis: [{ email: 'socia@pedv.com.br' }, { email: 'invalido' }, { email: 'SOCIO2@pedv.com.br' }],
    })
    const enviar = vi.fn().mockResolvedValue({ messageId: 'x' })
    const r = await notificarAlertasPendentes({ supabase: cliente, enviar, configurado: () => true })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toMatchObject({ to: ['socia@pedv.com.br', 'socio2@pedv.com.br'] })
    expect(enviar.mock.calls[0][0].html).toContain('Acme Ltda')
    expect(marcados).toEqual([['a1', 'a2']])
    expect(r).toMatchObject({ enviado: true, alertas: 2, destinatarios: 2 })
  })

  it('SMTP não configurado: não envia, não marca, não lança', async () => {
    const { cliente, marcados } = banco({ alertas: [alerta()], perfis: [{ email: 'socia@pedv.com.br' }] })
    const enviar = vi.fn()
    const r = await notificarAlertasPendentes({ supabase: cliente, enviar, configurado: () => false })
    expect(enviar).not.toHaveBeenCalled()
    expect(marcados).toEqual([])
    expect(r).toMatchObject({ enviado: false, alertas: 1 })
  })

  it('falha no envio é registrada e NÃO marca avisado_em (tenta de novo na próxima rodada)', async () => {
    const { cliente, marcados } = banco({ alertas: [alerta()], perfis: [{ email: 'socia@pedv.com.br' }] })
    const enviar = vi.fn().mockRejectedValue(new Error('SMTP caiu'))
    const r = await notificarAlertasPendentes({ supabase: cliente, enviar, configurado: () => true })
    expect(r.enviado).toBe(false)
    expect(r.motivo).toContain('SMTP caiu')
    expect(marcados).toEqual([])
  })

  it('sem alertas pendentes ou sem sócio com e-mail válido: não envia', async () => {
    const enviar = vi.fn()
    const vazio = banco({ alertas: [] })
    expect((await notificarAlertasPendentes({ supabase: vazio.cliente, enviar, configurado: () => true })).enviado).toBe(false)
    const semSocio = banco({ alertas: [alerta()], perfis: [{ email: null }] })
    const r = await notificarAlertasPendentes({ supabase: semSocio.cliente, enviar, configurado: () => true })
    expect(r.enviado).toBe(false)
    expect(r.motivo).toContain('sócio')
    expect(enviar).not.toHaveBeenCalled()
  })

  it('erro de leitura vira retorno, sem lançar', async () => {
    const { cliente } = banco({ erroAlertas: { message: 'falhou' } })
    const r = await notificarAlertasPendentes({ supabase: cliente, enviar: vi.fn(), configurado: () => true })
    expect(r.enviado).toBe(false)
    expect(r.motivo).toContain('falhou')
  })
})
