import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'

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

function createPngFile(filename = 'imagem.png') {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z5UQAAAAASUVORK5CYII=',
    'base64',
  )
  return new File([bytes], filename, { type: 'image/png' })
}

function createJpegFile(filename = 'imagem.jpg') {
  const bytes = readFileSync('public/logo-pedv-tv.jpeg')
  return new File([bytes], filename, { type: 'image/jpeg' })
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

  it('bloqueia image-to-pdf para cliente e anon pela guarda da rota', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const form = new FormData()
    form.append('files', createJpegFile('a.jpg'))

    const res = await POST(new Request('http://localhost/api/ferramentas-pdf/image-to-pdf', { method: 'POST', body: form }), {
      params: Promise.resolve({ tool: 'image-to-pdf' }),
    })

    expect(res.status).toBe(403)
  })

  it('converte imagens em pdf', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const form = new FormData()
    form.append('files', createJpegFile('a.jpg'))
    form.append('files', createPngFile('b.png'))

    const res = await POST(new Request('http://localhost/api/ferramentas-pdf/image-to-pdf', { method: 'POST', body: form }), {
      params: Promise.resolve({ tool: 'image-to-pdf' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('bloqueia compress para cliente e anon pela guarda da rota', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const form = new FormData()
    form.append('file', await createPdf(2, 'origem.pdf'))

    const res = await POST(new Request('http://localhost/api/ferramentas-pdf/compress', { method: 'POST', body: form }), {
      params: Promise.resolve({ tool: 'compress' }),
    })

    expect(res.status).toBe(403)
  })

  it('comprime pdf localmente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const form = new FormData()
    form.append('file', await createPdf(2, 'origem.pdf'))

    const res = await POST(new Request('http://localhost/api/ferramentas-pdf/compress', { method: 'POST', body: form }), {
      params: Promise.resolve({ tool: 'compress' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })
})
