import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

const { mockApiGuard } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

import { POST } from './route'

async function createPdf(pages = 1, filename = 'arquivo.pdf') {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i += 1) {
    pdf.addPage([200, 200])
  }
  const bytes = await pdf.save()
  return new File([bytes], filename, { type: 'application/pdf' })
}

function request(body: FormData) {
  return new Request('http://localhost/api/ferramentas-pdf/merge', {
    method: 'POST',
    body,
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
})

describe('POST /api/ferramentas-pdf/[tool]', () => {
  it('bloqueia cliente e anon pela guarda da rota', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const form = new FormData()
    form.append('files', await createPdf())

    const res = await POST(request(form), { params: Promise.resolve({ tool: 'merge' }) })

    expect(res.status).toBe(403)
  })

  it('rejeita arquivo não-pdf', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const form = new FormData()
    form.append('files', new File([new Uint8Array([1, 2, 3])], 'texto.txt', { type: 'text/plain' }))

    const res = await POST(request(form), { params: Promise.resolve({ tool: 'merge' }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('PDF')
  })

  it('processa merge com usuário socio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const form = new FormData()
    form.append('files', await createPdf(1, 'a.pdf'))
    form.append('files', await createPdf(2, 'b.pdf'))

    const res = await POST(request(form), { params: Promise.resolve({ tool: 'merge' }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('mantém compressão indisponível nesta fase', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const form = new FormData()
    const res = await POST(new Request('http://localhost/api/ferramentas-pdf/compress', { method: 'POST', body: form }), {
      params: Promise.resolve({ tool: 'compress' }),
    })
    const body = await res.json()

    expect(res.status).toBe(501)
    expect(body.error).toContain('ainda não está disponível')
  })
})
