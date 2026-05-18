import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockBuildMensagensAurora, mockStreamTexto } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockBuildMensagensAurora: vi.fn(),
  mockStreamTexto: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

vi.mock('@/lib/ai/prompts', () => ({
  buildMensagensAurora: mockBuildMensagensAurora,
}))

vi.mock('@/lib/ai/service', () => ({
  streamTexto: mockStreamTexto,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/ia/aurora', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function textStream(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key'
  delete process.env.AI_API_KEY
  mockApiGuard.mockReset()
  mockBuildMensagensAurora.mockReset()
  mockStreamTexto.mockReset()
})

afterEach(() => {
  delete process.env.OPENAI_API_KEY
  delete process.env.AI_API_KEY
})

describe('POST /api/ia/aurora', () => {
  it('usa apiGuard exclusivamente com role socio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })
    mockBuildMensagensAurora.mockReturnValue([{ role: 'system', content: 'Aurora' }])
    mockStreamTexto.mockReturnValue(textStream('resposta'))

    const res = await POST(request({ mensagem: 'Organize esta demanda' }) as never)

    expect(res.status).toBe(200)
    expect(mockApiGuard).toHaveBeenCalledWith(['socio'])
  })

  it('retorna o bloqueio do guard para qualquer perfil não autorizado', async () => {
    mockApiGuard.mockResolvedValue(
      NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 }),
    )

    const res = await POST(request({ mensagem: 'Teste' }) as never)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Sem permissão para esta operação')
    expect(mockBuildMensagensAurora).not.toHaveBeenCalled()
    expect(mockStreamTexto).not.toHaveBeenCalled()
  })

  it('valida mensagem obrigatória antes de chamar a IA', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })

    const res = await POST(request({ mensagem: '   ' }) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('mensagem é obrigatória')
    expect(mockBuildMensagensAurora).not.toHaveBeenCalled()
    expect(mockStreamTexto).not.toHaveBeenCalled()
  })

  it('retorna erro JSON legível quando não há chave de IA', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_API_KEY
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })

    const res = await POST(request({ mensagem: 'Teste' }) as never)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toContain('OPENAI_API_KEY ou AI_API_KEY')
    expect(mockBuildMensagensAurora).not.toHaveBeenCalled()
    expect(mockStreamTexto).not.toHaveBeenCalled()
  })

  it('aceita AI_API_KEY como alias compatível', async () => {
    delete process.env.OPENAI_API_KEY
    process.env.AI_API_KEY = 'test-key'
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })
    mockBuildMensagensAurora.mockReturnValue([{ role: 'system', content: 'Aurora' }])
    mockStreamTexto.mockReturnValue(textStream('ok'))

    const res = await POST(request({ mensagem: 'Teste' }) as never)

    expect(res.status).toBe(200)
    expect(mockBuildMensagensAurora).toHaveBeenCalled()
    expect(mockStreamTexto).toHaveBeenCalled()
  })

  it('monta mensagens da Aurora e retorna streaming de texto', async () => {
    const historico = [{ role: 'user', content: 'Contexto anterior' }]
    const messages = [{ role: 'system', content: 'Aurora' }]
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })
    mockBuildMensagensAurora.mockReturnValue(messages)
    mockStreamTexto.mockReturnValue(textStream('plano de ação'))

    const res = await POST(request({ mensagem: 'Monte um plano', historico }) as never)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/plain')
    expect(text).toBe('plano de ação')
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith('Monte um plano', historico)
    expect(mockStreamTexto).toHaveBeenCalledWith(messages, { maxTokens: 3072, temperature: 0.45 })
  })
})
