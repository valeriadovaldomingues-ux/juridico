import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const {
  mockApiGuard,
  mockBuildMensagensAurora,
  mockStreamTextoPreflight,
  mockCompletarTexto,
  mockDetectarIntencaoPublicacoes,
  mockBuscarPublicacoesParaAurora,
  mockMontarContextoPublicacoesParaAurora,
  mockClassificarMensagemAurora,
  mockCarregarPromptCompletoAurora,
  mockConsultarOlavoDrive,
  mockMontarContextoOlavoDrive,
  mockUploadCentralArquivos,
  mockListPastas,
  mockCreatePasta,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockBuildMensagensAurora: vi.fn(),
  mockStreamTextoPreflight: vi.fn(),
  mockCompletarTexto: vi.fn(),
  mockDetectarIntencaoPublicacoes: vi.fn(),
  mockBuscarPublicacoesParaAurora: vi.fn(),
  mockMontarContextoPublicacoesParaAurora: vi.fn(),
  mockClassificarMensagemAurora: vi.fn(),
  mockCarregarPromptCompletoAurora: vi.fn(),
  mockConsultarOlavoDrive: vi.fn(),
  mockMontarContextoOlavoDrive: vi.fn(),
  mockUploadCentralArquivos: vi.fn(),
  mockListPastas: vi.fn(),
  mockCreatePasta: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

vi.mock('@/lib/ai/prompts', () => ({
  buildMensagensAurora: mockBuildMensagensAurora,
}))

vi.mock('@/lib/ai/service', () => ({
  streamTextoPreflight: mockStreamTextoPreflight,
  completarTexto: mockCompletarTexto,
}))

vi.mock('@/lib/ai/aurora-context', () => ({
  detectarIntencaoPublicacoes: mockDetectarIntencaoPublicacoes,
  buscarPublicacoesParaAurora: mockBuscarPublicacoesParaAurora,
  montarContextoPublicacoesParaAurora: mockMontarContextoPublicacoesParaAurora,
}))

vi.mock('@/lib/aurora/router', () => ({
  classificarMensagemAurora: mockClassificarMensagemAurora,
}))

vi.mock('@/lib/aurora/prompt-loader', () => ({
  carregarPromptCompletoAurora: mockCarregarPromptCompletoAurora,
}))

vi.mock('@/lib/aurora/olavo-drive', () => ({
  consultarOlavoDrive: mockConsultarOlavoDrive,
  montarContextoOlavoDrive: mockMontarContextoOlavoDrive,
}))

vi.mock('@/lib/central-arquivos', () => ({
  uploadCentralArquivos: mockUploadCentralArquivos,
  listPastas: mockListPastas,
  createPasta: mockCreatePasta,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/ia/aurora', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function multipartRequest(form: FormData) {
  return new Request('http://localhost/api/ia/aurora', {
    method: 'POST',
    body: form,
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

const decisaoPadrao = {
  agentId: 'principal',
  modo: 'rapido',
  matchedKeywords: [],
  score: 0,
  reason: 'nenhuma_intencao_clara',
} as const

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key'
  delete process.env.AI_API_KEY
  mockApiGuard.mockReset()
  mockBuildMensagensAurora.mockReset()
  mockStreamTextoPreflight.mockReset()
  mockCompletarTexto.mockReset()
  mockDetectarIntencaoPublicacoes.mockReset()
  mockBuscarPublicacoesParaAurora.mockReset()
  mockMontarContextoPublicacoesParaAurora.mockReset()
  mockClassificarMensagemAurora.mockReset()
  mockCarregarPromptCompletoAurora.mockReset()
  mockConsultarOlavoDrive.mockReset()
  mockMontarContextoOlavoDrive.mockReset()
  mockUploadCentralArquivos.mockReset()
  mockListPastas.mockReset()
  mockCreatePasta.mockReset()

  mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-1' })
  mockDetectarIntencaoPublicacoes.mockReturnValue({
    temIntencao: false,
    hoje: false,
    pendentes: false,
    prazo: false,
    audiencia: false,
    triagem: false,
  })
  mockClassificarMensagemAurora.mockReturnValue(decisaoPadrao)
  mockCarregarPromptCompletoAurora.mockResolvedValue('PROMPT PRINCIPAL')
  mockBuildMensagensAurora.mockReturnValue([{ role: 'system', content: 'Aurora' }])
  mockStreamTextoPreflight.mockResolvedValue(textStream('resposta'))
  mockConsultarOlavoDrive.mockResolvedValue({
    fonte: 'olavo-drive',
    especialista: 'Olavo Drive',
    resposta: 'Contexto documental do Olavo Drive.',
  })
  mockMontarContextoOlavoDrive.mockReturnValue('CONTEXTO DO SISTEMA - OLAVO DRIVE\nContexto documental do Olavo Drive.')
  mockListPastas.mockResolvedValue([])
  mockCreatePasta.mockResolvedValue({
    id: 'pasta-aurora',
    nome: 'Anexos da Aurora',
    descricao: 'Arquivos anexados às conversas com a Aurora e salvos no Dossiê Aurora.',
    cliente_id: null,
    processo_id: null,
    caso_id: null,
    pasta_pai_id: null,
    criado_por: 'uid-1',
    visibilidade: 'interna',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })
  mockUploadCentralArquivos.mockResolvedValue([
    {
      id: 'doc-1',
      pasta_id: 'pasta-aurora',
      nome_original: 'contrato.pdf',
      nome_armazenado: 'arquivo.pdf',
      tipo_mime: 'application/pdf',
      extensao: 'pdf',
      tamanho_bytes: 1234,
      storage_bucket: 'central-arquivos',
      storage_path: 'docs/pasta-aurora/2026/06/01/arquivo.pdf',
      cliente_id: null,
      processo_id: null,
      caso_id: null,
      categoria: 'anexo_conversa_aurora',
      descricao: 'Anexos enviados na conversa com a Aurora.',
      enviado_por: 'uid-1',
      status_processamento: 'pendente',
      status_transcricao: null,
      visibilidade: 'interna',
      analise_aurora: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ])
})

afterEach(() => {
  delete process.env.OPENAI_API_KEY
  delete process.env.AI_API_KEY
})

describe('POST /api/ia/aurora', () => {
  it('usa apiGuard exclusivamente com role socio', async () => {
    const res = await POST(request({ mensagem: 'Organize esta demanda' }) as never)

    expect(res.status).toBe(200)
    expect(mockApiGuard).toHaveBeenCalledWith(['socio'])
  })

  it('bloqueia a Aurora na própria rota quando o papel retornado não é socio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'gerente', userId: 'uid-2' })

    const res = await POST(request({ mensagem: 'Teste' }) as never)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('exclusivos para sócios')
    expect(mockClassificarMensagemAurora).not.toHaveBeenCalled()
    expect(mockCarregarPromptCompletoAurora).not.toHaveBeenCalled()
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
    expect(mockStreamTextoPreflight).not.toHaveBeenCalled()
  })

  it('valida mensagem obrigatória antes de chamar a IA', async () => {
    const res = await POST(request({ mensagem: '   ' }) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('mensagem é obrigatória')
    expect(mockBuildMensagensAurora).not.toHaveBeenCalled()
    expect(mockStreamTextoPreflight).not.toHaveBeenCalled()
  })

  it('retorna erro JSON legível quando não há chave de IA', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_API_KEY

    const res = await POST(request({ mensagem: 'Teste' }) as never)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toContain('OPENAI_API_KEY ou AI_API_KEY')
    expect(mockBuildMensagensAurora).not.toHaveBeenCalled()
    expect(mockStreamTextoPreflight).not.toHaveBeenCalled()
  })

  it('aceita AI_API_KEY como alias compatível', async () => {
    delete process.env.OPENAI_API_KEY
    process.env.AI_API_KEY = 'test-key'

    const res = await POST(request({ mensagem: 'Teste' }) as never)

    expect(res.status).toBe(200)
    expect(mockBuildMensagensAurora).toHaveBeenCalled()
    expect(mockStreamTextoPreflight).toHaveBeenCalled()
  })

  it('aceita anexos multipart e injeta contexto factual dos arquivos', async () => {
    mockClassificarMensagemAurora.mockReturnValue(decisaoPadrao)

    const form = new FormData()
    form.append('mensagem', 'Analise os anexos enviados')
    form.append('historico', JSON.stringify([{ role: 'user', content: 'Contexto anterior' }]))
    form.append('salvarAnexosNoDossie', 'true')
    form.append('anexos', new File([new Uint8Array([1, 2, 3])], 'contrato.pdf', { type: 'application/pdf' }))

    const res = await POST(multipartRequest(form) as never)

    expect(res.status).toBe(200)
    expect(mockCreatePasta).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Anexos da Aurora',
    }), 'uid-1')
    expect(mockUploadCentralArquivos).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.any(File)],
      pasta_id: 'pasta-aurora',
      categoria: 'anexo_conversa_aurora',
      descricao: 'Anexos enviados na conversa com a Aurora.',
      visibilidade: 'interna',
    }), 'uid-1')
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith(
      'Analise os anexos enviados',
      [{ role: 'user', content: 'Contexto anterior' }],
      expect.stringContaining('contrato.pdf'),
      'PROMPT PRINCIPAL',
    )
    expect(mockBuildMensagensAurora.mock.calls.at(-1)?.[2]).toContain('storage_path: docs/pasta-aurora/2026/06/01/arquivo.pdf')
  })

  it('roteia para um único subagente e carrega apenas o prompt selecionado', async () => {
    const mensagensHistorico = [
      { role: 'user', content: 'Mensagem antiga' },
      { role: 'assistant', content: 'Resposta antiga' },
      { role: 'user', content: 'Contexto intermediário' },
      { role: 'assistant', content: 'Resposta intermediária' },
      { role: 'user', content: 'Mais contexto ainda' },
    ]

    mockClassificarMensagemAurora.mockReturnValue({
      agentId: 'stella',
      modo: 'profundo',
      matchedKeywords: ['e-mail'],
      score: 1,
      reason: 'keyword_match:e-mail',
    })
    mockCarregarPromptCompletoAurora.mockResolvedValue('PROMPT STELLA')

    const res = await POST(
      request({
        mensagem: 'Triagem dos e-mails e rascunho de resposta',
        historico: mensagensHistorico,
        modo: 'profundo',
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(mockClassificarMensagemAurora).toHaveBeenCalledWith({
      mensagem: 'Triagem dos e-mails e rascunho de resposta',
      historicoRecente: ['Resposta intermediária', 'Mais contexto ainda'],
      modo: 'profundo',
      role: 'socio',
    })
    expect(mockCarregarPromptCompletoAurora).toHaveBeenCalledWith('stella', 'profundo', 'socio')
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith(
      'Triagem dos e-mails e rascunho de resposta',
      mensagensHistorico.slice(-4),
      undefined,
      'PROMPT STELLA',
    )
    expect(mockBuscarPublicacoesParaAurora).not.toHaveBeenCalled()
  })

  it('respeita uma chamada direta explícita do sócio para subagente', async () => {
    mockClassificarMensagemAurora.mockReturnValue({
      agentId: 'olavo',
      modo: 'rapido',
      matchedKeywords: [],
      score: 1,
      reason: 'explicit_mention',
      explicitLabel: 'olavo',
      explicitToken: 'olavo',
      explicitValid: true,
    })
    mockCarregarPromptCompletoAurora.mockResolvedValue('PROMPT OLAVO')

    const res = await POST(request({ mensagem: '@Olavo analisar este processo' }) as never)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('resposta')
    expect(mockCarregarPromptCompletoAurora).toHaveBeenCalledWith('olavo', 'rapido', 'socio')
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith(
      '@Olavo analisar este processo',
      [],
      expect.any(String),
      'PROMPT OLAVO',
    )
    expect(res.headers.get('X-Aurora-Agent')).toBe('olavo')
    expect(res.headers.get('X-Aurora-Routing')).toBe('explicit_mention')
    expect(res.headers.get('X-Aurora-Explicit')).toBe('olavo')
  })

  it('chamada direta inválida cai na Aurora Principal e registra o motivo', async () => {
    mockClassificarMensagemAurora.mockReturnValue({
      agentId: 'principal',
      modo: 'rapido',
      matchedKeywords: [],
      score: 0,
      reason: 'explicit_invalid',
      explicitLabel: 'agentesecreto',
      explicitToken: 'agentesecreto',
      explicitValid: false,
    })
    mockCarregarPromptCompletoAurora.mockResolvedValue('PROMPT PRINCIPAL')

    const res = await POST(request({ mensagem: '@AgenteSecreto analisar isso' }) as never)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('resposta')
    expect(mockCarregarPromptCompletoAurora).toHaveBeenCalledWith('principal', 'rapido', 'socio')
    expect(res.headers.get('X-Aurora-Agent')).toBe('principal')
    expect(res.headers.get('X-Aurora-Routing')).toBe('explicit_invalid')
    expect(res.headers.get('X-Aurora-Explicit')).toBe('agentesecreto')
  })

  it('busca contexto de publicações quando a mensagem pede publicações e a rota escolhe Stella', async () => {
    const decisaoStella = {
      agentId: 'stella',
      modo: 'rapido',
      matchedKeywords: ['publicacao'],
      score: 1,
      reason: 'keyword_match:publicacao',
    } as const
    const intencao = {
      temIntencao: true,
      hoje: true,
      pendentes: false,
      prazo: true,
      audiencia: false,
      triagem: false,
    }
    const publicacoes = [{ id: 'pub-1', prazo_detectado: true }]
    const contexto = 'CONTEXTO DO SISTEMA - PUBLICAÇÕES\nTotal encontrado: 1'

    mockClassificarMensagemAurora.mockReturnValue(decisaoStella)
    mockDetectarIntencaoPublicacoes.mockReturnValue(intencao)
    mockBuscarPublicacoesParaAurora.mockResolvedValue(publicacoes)
    mockMontarContextoPublicacoesParaAurora.mockReturnValue(contexto)
    mockCarregarPromptCompletoAurora.mockResolvedValue('PROMPT STELLA')

    const res = await POST(
      request({
        mensagem: 'Quais publicações chegaram hoje com prazo detectado?',
        historico: [],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(mockBuscarPublicacoesParaAurora).toHaveBeenCalledWith({ ...intencao, limit: 20 })
    expect(mockMontarContextoPublicacoesParaAurora).toHaveBeenCalledWith(publicacoes)
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith(
      'Quais publicações chegaram hoje com prazo detectado?',
      [],
      contexto,
      'PROMPT STELLA',
    )
  })

  it('não busca contexto de publicações quando a mensagem é genérica', async () => {
    mockClassificarMensagemAurora.mockReturnValue(decisaoPadrao)

    const res = await POST(request({ mensagem: 'Monte um plano de ação' }) as never)

    expect(res.status).toBe(200)
    expect(mockBuscarPublicacoesParaAurora).not.toHaveBeenCalled()
    expect(mockMontarContextoPublicacoesParaAurora).not.toHaveBeenCalled()
    expect(mockBuildMensagensAurora).toHaveBeenCalledWith(
      'Monte um plano de ação',
      [],
      undefined,
      'PROMPT PRINCIPAL',
    )
  })

  it('retorna JSON de fallback quando o preflight do streaming falha', async () => {
    mockStreamTextoPreflight.mockRejectedValue(new Error('stream indisponível'))
    mockCompletarTexto.mockResolvedValue('estou funcionando.')

    const res = await POST(request({ mensagem: 'Teste' }) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resposta).toBe('estou funcionando.')
    expect(body.aviso).toContain('stream indisponível')
    expect(mockCompletarTexto).toHaveBeenCalledWith(
      [{ role: 'system', content: 'Aurora' }],
      { maxTokens: 3072, temperature: 0.45 },
    )
  })
})
