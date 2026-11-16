import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateServiceClient, mockExecutar, mockNotificar } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockExecutar: vi.fn(),
  mockNotificar: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateServiceClient,
}))

vi.mock('@/lib/monitoramento-clientes/executar', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/monitoramento-clientes/executar')>()
  return { ...original, executarMonitoramentoClientes: mockExecutar }
})

vi.mock('@/lib/monitoramento-clientes/notificar', () => ({
  notificarAlertasPendentes: mockNotificar,
}))

import { GET } from './route'
import { MigracaoPendenteErro } from '@/lib/monitoramento-clientes/executar'

function request(headers?: HeadersInit, query = '') {
  return new Request(`http://localhost/api/cron/monitoramento-clientes${query}`, { headers })
}

const resumo = { documentos: 2, consultas: 3, encontrados: 1, novos: 1, falhas: 0, interrompido: false, erros: [], alertas: [{ cliente: 'Acme', numero_processo: '00012345620245030001', tribunal: 'TRT3', polo: 'P' }] }

beforeEach(() => {
  mockCreateServiceClient.mockReset()
  mockExecutar.mockReset()
  mockNotificar.mockReset()
  mockCreateServiceClient.mockReturnValue({ fakeServiceClient: true })
  delete process.env.CRON_SECRET
})

describe('GET /api/cron/monitoramento-clientes', () => {
  it('recusa sem CRON_SECRET configurado', async () => {
    const res = await GET(request({ authorization: 'Bearer qualquer' }))
    expect(res.status).toBe(401)
    expect(mockExecutar).not.toHaveBeenCalled()
  })

  it('recusa sem cabeçalho de autorização', async () => {
    process.env.CRON_SECRET = 'segredo'
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(mockExecutar).not.toHaveBeenCalled()
  })

  it('recusa com token incorreto', async () => {
    process.env.CRON_SECRET = 'segredo'
    const res = await GET(request({ authorization: 'Bearer errado' }))
    expect(res.status).toBe(401)
    expect(mockExecutar).not.toHaveBeenCalled()
    expect(mockNotificar).not.toHaveBeenCalled()
  })

  it('executa e avisa por e-mail com o client de service role quando o token é válido', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockResolvedValue(resumo)
    mockNotificar.mockResolvedValue({ enviado: true, alertas: 1, destinatarios: 2 })

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ sucesso: true, documentos: 2, novos: 1, email: { enviado: true } })
    expect(body.alertas_criados).toEqual([{ cliente: 'Acme', numero_processo: '00012345620245030001', tribunal: 'TRT3', polo: 'P' }])
    expect(mockExecutar).toHaveBeenCalledWith({ supabase: { fakeServiceClient: true }, desde: undefined })
  })

  it('?dias=N alarga a janela (backfill manual)', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockResolvedValue(resumo)
    mockNotificar.mockResolvedValue({ enviado: false, alertas: 0, destinatarios: 0 })
    await GET(request({ authorization: 'Bearer segredo' }, '?dias=20'))
    expect(mockExecutar.mock.calls[0][0].desde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('falha de e-mail não derruba o cron', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockResolvedValue(resumo)
    mockNotificar.mockRejectedValue(new Error('SMTP caiu'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.email).toMatchObject({ enviado: false, motivo: 'SMTP caiu' })
  })

  it('migração ainda não aplicada: responde 200 ignorando, sem tentar e-mail', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockRejectedValue(new MigracaoPendenteErro())
    const res = await GET(request({ authorization: 'Bearer segredo' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ignorado).toContain('migration')
    expect(mockNotificar).not.toHaveBeenCalled()
  })

  it('falha inesperada na execução responde 500', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockRejectedValue(new Error('banco fora'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(request({ authorization: 'Bearer segredo' }))
    expect(res.status).toBe(500)
    expect(mockNotificar).not.toHaveBeenCalled()
  })
})
