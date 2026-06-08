import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'
import { apiGuard } from '@/lib/auth/api-guard'
import { importarDadosProcessoDeDocumento } from '@/lib/processos/importar-documento.server'

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: vi.fn(),
}))

vi.mock('@/lib/processos/importar-documento.server', () => ({
  importarDadosProcessoDeDocumento: vi.fn(),
}))

describe('POST /api/processos/importar-documento', () => {
  const apiGuardMock = vi.mocked(apiGuard)
  const importarMock = vi.mocked(importarDadosProcessoDeDocumento)

  beforeEach(() => {
    vi.clearAllMocks()
    apiGuardMock.mockResolvedValue({
      userId: 'user-1',
      role: 'socio',
      user: { id: 'user-1', email: 'socio@example.com' },
      profile: { id: 'user-1', nome: 'Sócio', email: 'socio@example.com', role: 'socio', ativo: true },
      supabase: {} as never,
    } as never)
  })

  it('bloqueia requisição sem arquivo', async () => {
    const res = await POST(new Request('http://localhost/api/processos/importar-documento', {
      method: 'POST',
      body: new FormData(),
    }) as Request)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Envie um arquivo em documento.' })
    expect(importarMock).not.toHaveBeenCalled()
  })

  it('bloqueia quando a autenticação não permite acesso', async () => {
    apiGuardMock.mockResolvedValueOnce(NextResponse.json({ error: 'forbidden' }, { status: 403 }) as never)

    const formData = new FormData()
    formData.append('documento', new File(['conteudo'], 'processo.pdf', { type: 'application/pdf' }))

    const res = await POST(new Request('http://localhost/api/processos/importar-documento', {
      method: 'POST',
      body: formData,
    }) as Request)

    expect(res.status).toBe(403)
    expect(importarMock).not.toHaveBeenCalled()
  })

  it('analisa documento e retorna JSON estruturado', async () => {
    importarMock.mockResolvedValue({
      arquivo: {
        nome: 'processo.pdf',
        tipo: 'application/pdf',
        tamanho: 1234,
        extensao: 'pdf',
      },
      textoExtraido: 'texto extraído',
      dados: {
        cliente: {
          nome: 'Empresa Alfa',
          cpfCnpj: '12.345.678/0001-90',
          telefone: '',
          email: '',
          endereco: '',
        },
        parteContraria: {
          nome: 'Empresa Beta',
          cpfCnpj: '',
          endereco: '',
        },
        processo: {
          numero: '0001234-56.2026.8.26.0100',
          comarca: '',
          vara: '',
          tribunal: '',
          classe: '',
          assunto: '',
          fase: '',
          dataDistribuicao: '',
          valorCausa: '',
          segredoJustica: null,
        },
        advogados: [],
        resumo: {
          resumoCaso: 'Resumo',
          fatosRelevantes: [],
          pedidosPrincipais: [],
          prazosMencionados: [],
        },
        observacoes: {
          camposNaoEncontrados: [],
          inconsistencias: [],
          observacoesInternas: '',
        },
      },
    })

    const formData = new FormData()
    formData.append('documento', new File(['conteudo'], 'processo.pdf', { type: 'application/pdf' }))

    const res = await POST(new Request('http://localhost/api/processos/importar-documento', {
      method: 'POST',
      body: formData,
    }) as Request)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      arquivo: {
        nome: 'processo.pdf',
        extensao: 'pdf',
      },
      dados: {
        cliente: {
          nome: 'Empresa Alfa',
        },
        processo: {
          numero: '0001234-56.2026.8.26.0100',
        },
      },
    })
    expect(importarMock).toHaveBeenCalledTimes(1)
  })

  it('devolve erro de arquivo inválido quando helper falha', async () => {
    importarMock.mockRejectedValue(new Error('Tipo de arquivo não permitido. Envie PDF, DOC ou DOCX.'))

    const formData = new FormData()
    formData.append('documento', new File(['conteudo'], 'processo.exe', { type: 'application/octet-stream' }))

    const res = await POST(new Request('http://localhost/api/processos/importar-documento', {
      method: 'POST',
      body: formData,
    }) as Request)

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toEqual({ error: 'Tipo de arquivo não permitido. Envie PDF, DOC ou DOCX.' })
  })
})
