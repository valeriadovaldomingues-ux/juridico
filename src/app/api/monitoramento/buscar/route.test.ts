import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const {
  mockApiGuard,
  mockCreateClient,
  mockSelecionarFontesMonitoramento,
  mockFontePodeExecutar,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockSelecionarFontesMonitoramento: vi.fn(),
  mockFontePodeExecutar: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/monitoramento/fontes', () => ({
  selecionarFontesMonitoramento: mockSelecionarFontesMonitoramento,
  fontePodeExecutar: mockFontePodeExecutar,
}))

vi.mock('@/lib/monitoramento/tjmg-dje', () => ({
  gerarHashDJE: vi.fn(() => 'hash-dje'),
}))

vi.mock('@/lib/monitoramento/prazo-detector', () => ({
  detectarPrazosEAudiencias: vi.fn(() => ({
    prazo_detectado: false,
    prazo_dias: null,
    prazo_data: null,
    prazo_descricao: null,
    audiencia_detectada: false,
    audiencia_data: null,
    audiencia_descricao: null,
  })),
  detectarTipoResultado: vi.fn(() => 'publicacao'),
  analisarPublicacao: vi.fn(() => ({ resumo: ['Resumo seguro'] })),
}))

import { POST } from './route'

function request(body?: unknown, headers?: HeadersInit) {
  return new Request('http://localhost/api/monitoramento/buscar', {
    method: 'POST',
    headers: body
      ? { 'content-type': 'application/json', ...(headers ?? {}) }
      : headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function fonteTJMG(publicacoes: any[] = []) {
  return {
    id: 'tjmg-dje',
    nome: 'TJMG DJe',
    tribunal: 'TJMG',
    ramo: 'estadual',
    status: 'ativo',
    descricao: 'Fonte ativa',
    executar: vi.fn().mockResolvedValue({
      fonte_id: 'tjmg-dje',
      fonte_nome: 'TJMG DJe',
      tribunal: 'TJMG',
      ramo: 'estadual',
      status: 'ativo',
      encontradas: publicacoes.length,
      inseridas: 0,
      duplicadas: 0,
      ignoradas: 0,
      falhas: 0,
      publicacoes,
    }),
  }
}

function fonteTRT3(publicacoes: any[] = [], id = 'trt3', nome = 'TRT3/MG') {
  return {
    id,
    nome,
    tribunal: 'TRT3',
    ramo: 'trabalhista',
    status: 'ativo',
    descricao: 'TRT3 ativo parcial pelo DEJT',
    executar: vi.fn().mockResolvedValue({
      fonte_id: id,
      fonte_nome: nome,
      tribunal: 'TRT3',
      ramo: 'trabalhista',
      status: 'ativo',
      encontradas: publicacoes.length,
      inseridas: 0,
      duplicadas: 0,
      ignoradas: 0,
      falhas: 0,
      publicacoes,
      mensagem: 'TRT3/MG ativo parcial: captura real pelo DEJT e DJEN.',
    }),
  }
}

function fonteTJDJEN(tribunal: string, publicacoes: any[] = []) {
  const id = tribunal.toLowerCase()
  return {
    id,
    nome: tribunal,
    tribunal,
    ramo: 'estadual',
    status: 'ativo',
    descricao: `${tribunal} ativo via DJEN/CNJ`,
    executar: vi.fn().mockResolvedValue({
      fonte_id: id,
      fonte_nome: tribunal,
      tribunal,
      ramo: 'estadual',
      status: 'ativo',
      encontradas: publicacoes.length,
      inseridas: 0,
      duplicadas: 0,
      ignoradas: 0,
      falhas: 0,
      publicacoes,
      mensagem: `${tribunal} ativo via DJEN/CNJ.`,
    }),
  }
}

function fonteTJSP(publicacoes: any[] = []) {
  const fonte = fonteTJDJEN('TJSP', publicacoes)
  fonte.descricao = 'TJSP ativo via DJEN/CNJ'
  fonte.executar = vi.fn().mockResolvedValue({
    fonte_id: 'tjsp',
    fonte_nome: 'TJSP',
    tribunal: 'TJSP',
    ramo: 'estadual',
    status: 'ativo',
    encontradas: publicacoes.length,
    inseridas: 0,
    duplicadas: 0,
    ignoradas: 0,
    falhas: 0,
    publicacoes,
    mensagem: 'TJSP ativo via DJEN/CNJ. e-SAJ direto permanece pendente.',
  })
  return fonte
}

function pubCapturada() {
  return {
    fonte_id: 'tjmg-dje',
    numero_processo: '5000000-00.2026.8.13.0000',
    tribunal: 'TJMG',
    orgao: '1ª Vara Cível',
    diario: 'TJMG DJe',
    data_publicacao: '2026-05-18',
    nome_pesquisado: 'ADVOGADO TESTE',
    texto_publicacao: 'Intimação de teste para manifestação.',
    origem: 'datajud_nome',
    termo_encontrado: 'ADVOGADO TESTE',
  }
}

function pubTJSPDJEN() {
  return {
    fonte_id: 'tjsp',
    numero_processo: '1000000-00.2026.8.26.0100',
    tribunal: 'TJSP',
    orgao: '1ª Vara Cível de São Paulo',
    diario: 'DJEN',
    data_publicacao: '2026-05-19',
    nome_pesquisado: 'ADVOGADO TESTE',
    texto_publicacao: 'Comunicação DJEN TJSP de ADVOGADO TESTE para manifestação.',
    origem: 'tjsp_djen',
    termo_encontrado: 'ADVOGADO TESTE',
  }
}

function pubTJDJEN() {
  return {
    fonte_id: 'tjac',
    numero_processo: '0700000-00.2026.8.01.0001',
    tribunal: 'TJAC',
    orgao: '1ª Vara Cível de Rio Branco',
    diario: 'DJEN',
    data_publicacao: '2026-05-19',
    nome_pesquisado: 'ADVOGADO TESTE',
    texto_publicacao: 'Comunicação DJEN TJAC de ADVOGADO TESTE para manifestação.',
    origem: 'tj_djen',
    termo_encontrado: 'ADVOGADO TESTE',
  }
}

function pubTRT3() {
  return {
    fonte_id: 'trt3',
    numero_processo: '0010000-00.2026.5.03.0001',
    tribunal: 'TRT3',
    orgao: 'Caderno Judiciário TRT3',
    diario: 'DEJT',
    data_publicacao: '2026-05-18',
    nome_pesquisado: 'ADVOGADO TESTE',
    texto_publicacao: 'Intimação trabalhista de ADVOGADO TESTE para manifestação.',
    origem: 'trt3_dejt',
    termo_encontrado: 'ADVOGADO TESTE',
  }
}

function pubTRT3DJEN() {
  return {
    fonte_id: 'trt3-djen',
    numero_processo: '0010000-00.2026.5.03.0001',
    tribunal: 'TRT3',
    orgao: 'Vara do Trabalho de Belo Horizonte',
    diario: 'DJEN',
    data_publicacao: '2026-05-19',
    nome_pesquisado: 'ADVOGADO TESTE',
    texto_publicacao: 'Comunicação DJEN de ADVOGADO TESTE para manifestação.',
    origem: 'trt3_djen',
    termo_encontrado: 'ADVOGADO TESTE',
  }
}

function supabaseSemAdvogados() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'advogados_monitorados') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }

      throw new Error(`Tabela inesperada no teste: ${table}`)
    }),
  }
}

function supabaseComAdvogados(options?: { existing?: boolean; insertError?: boolean }) {
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'advogados_monitorados') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{
              id: 'adv-1',
              nome_completo: 'ADVOGADO TESTE',
              oab_numero: '123',
              oab_uf: 'MG',
              ativo: true,
            }],
            error: null,
          }),
        }
      }

      if (table === 'processos') {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [{ id: 'proc-1', numero_processo: '5000000-00.2026.8.13.0000' }],
            error: null,
          }),
        }
      }

      if (table === 'publicacoes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options?.existing ? { id: 'pub-existente' } : null,
            error: null,
          }),
          insert: vi.fn().mockImplementation((payload: unknown) => {
            insertCalls.push({ table, payload })
            return Promise.resolve({
              error: options?.insertError ? { message: 'insert falhou' } : null,
            })
          }),
        }
      }

      if (table === 'monitoramento_logs') {
        return {
          insert: vi.fn().mockImplementation((payload: unknown) => {
            insertCalls.push({ table, payload })
            return Promise.resolve({ error: null })
          }),
        }
      }

      throw new Error(`Tabela inesperada no teste: ${table}`)
    }),
    insertCalls,
  }
  return supabase
}

beforeEach(() => {
  delete process.env.CRON_SECRET
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockSelecionarFontesMonitoramento.mockReset()
  mockFontePodeExecutar.mockReset()
  mockFontePodeExecutar.mockImplementation((fonte: any) => fonte.status === 'ativo' && typeof fonte.executar === 'function')
  mockSelecionarFontesMonitoramento.mockReturnValue([fonteTJMG()])
})

describe('POST /api/monitoramento/buscar', () => {
  it('permite que roles da matriz de monitoramento passem pelo guard da API', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabaseSemAdvogados())

    const res = await POST(request())
    const body = await res.json()

    expect(mockApiGuard).toHaveBeenCalledWith(['advogado', 'gerente', 'socio'])
    expect(res.status).toBe(400)
    expect(body.erro).toBe('Nenhum advogado ativo para monitorar')
  })

  it('mantém cliente e demais perfis não autorizados bloqueados', async () => {
    mockApiGuard.mockResolvedValue(
      NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 }),
    )

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.erro).toBe('Sem permissão para acionar o monitoramento')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('mantém usuário sem sessão bloqueado', async () => {
    mockApiGuard.mockResolvedValue(
      NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    )

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.erro).toBe('Não autorizado')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('preserva chamada por cron com CRON_SECRET sem exigir sessão', async () => {
    process.env.CRON_SECRET = 'secret'
    mockCreateClient.mockResolvedValue(supabaseSemAdvogados())

    const res = await POST(request(undefined, { authorization: 'Bearer secret' }))

    expect(mockApiGuard).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
  })

  it('executa fonte ativa e grava publicações em publicacoes', async () => {
    const fonte = fonteTJMG([pubCapturada()])
    const supabase = supabaseComAdvogados()
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'tjmg-dje' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(1)
    expect(body.total_encontradas).toBe(1)
    expect(fonte.executar).toHaveBeenCalledWith({
      nomes: ['ADVOGADO TESTE'],
      processos: ['50000000020268130000'],
      oabs: ['MG123', '123/MG'],
      data: undefined,
    })
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(true)
  })

  it('não conta falso positivo de nova publicação quando o insert falha', async () => {
    const fonte = fonteTJMG([pubCapturada()])
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    mockCreateClient.mockResolvedValue(supabaseComAdvogados({ insertError: true }))

    const res = await POST(request({ fonte: 'tjmg-dje' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(0)
    expect(body.total_falhas).toBe(1)
  })

  it('retorna aviso claro para fonte pendente sem inserir publicações', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([{
      id: 'trt1',
      nome: 'TRT1',
      tribunal: 'TRT1',
      ramo: 'trabalhista',
      status: 'pendente',
      descricao: 'Pendente',
    }])
    const supabase = supabaseComAdvogados()
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'trt1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(false)
    expect(body.erro).toBe('Fonte ainda não implementada.')
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(false)
  })

  it('executa TRT3/MG ativo parcial e grava publicações do DEJT em publicacoes', async () => {
    const fonte = fonteTRT3([pubTRT3()])
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    const supabase = supabaseComAdvogados()
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'trt3-dejt', data: '2026-05-18' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(1)
    expect(body.fontes[0].fonte_nome).toBe('TRT3/MG')
    expect(body.fontes[0].status).toBe('ativo')
    expect(fonte.executar).toHaveBeenCalledWith({
      nomes: ['ADVOGADO TESTE'],
      processos: ['50000000020268130000'],
      oabs: ['MG123', '123/MG'],
      data: '2026-05-18',
    })
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(true)
  })

  it('executa TRT3/MG DJEN e grava publicações em publicacoes', async () => {
    const fonte = fonteTRT3([pubTRT3DJEN()], 'trt3-djen', 'TRT3/MG DJEN')
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    const supabase = supabaseComAdvogados()
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'trt3-djen', data: '2026-05-19' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(1)
    expect(body.fontes[0].fonte_nome).toBe('TRT3/MG DJEN')
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(true)
  })

  it('executa TJSP ativo via DJEN/CNJ e grava publicações em publicacoes', async () => {
    const fonte = fonteTJSP([pubTJSPDJEN()])
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    const supabase = supabaseComAdvogados()
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'tjsp', data: '2026-05-19' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(1)
    expect(body.fontes[0].fonte_nome).toBe('TJSP')
    expect(body.fontes[0].status).toBe('ativo')
    expect(fonte.executar).toHaveBeenCalledWith({
      nomes: ['ADVOGADO TESTE'],
      processos: ['50000000020268130000'],
      oabs: ['MG123', '123/MG'],
      data: '2026-05-19',
    })
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(true)
  })

  it('executa TJ nacional ativo via DJEN/CNJ e grava publicações em publicacoes', async () => {
    const fonte = fonteTJDJEN('TJAC', [pubTJDJEN()])
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([fonte])
    const supabase = supabaseComAdvogados()
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'tjac', data: '2026-05-19' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(true)
    expect(body.total_novas).toBe(1)
    expect(body.fontes[0].fonte_nome).toBe('TJAC')
    expect(body.fontes[0].status).toBe('ativo')
    expect(fonte.executar).toHaveBeenCalledWith({
      nomes: ['ADVOGADO TESTE'],
      processos: ['50000000020268130000'],
      oabs: ['MG123', '123/MG'],
      data: '2026-05-19',
    })
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(true)
  })

  it('não executa e-SAJ e retorna aviso de implementação pendente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([{
      id: 'esaj',
      nome: 'e-SAJ',
      tribunal: 'Múltiplos TJs',
      ramo: 'estadual',
      status: 'pendente',
      descricao: 'Fonte para tribunais que utilizam e-SAJ. Requer implementação específica por tribunal.',
    }])
    const supabase = supabaseComAdvogados()
    mockCreateClient.mockResolvedValue(supabase)

    const res = await POST(request({ fonte: 'esaj' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(false)
    expect(body.erro).toBe('Fonte ainda não implementada.')
    expect(body.fontes[0].fonte_nome).toBe('e-SAJ')
    expect(body.fontes[0].status).toBe('pendente')
    expect(supabase.insertCalls.some(call => call.table === 'publicacoes')).toBe(false)
  })

  it('retorna aviso claro para fonte sem credencial', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockSelecionarFontesMonitoramento.mockReturnValue([{
      id: 'datajud-cnj',
      nome: 'DataJud CNJ',
      tribunal: 'CNJ',
      ramo: 'datajud',
      status: 'requer_credencial',
      descricao: 'Sem chave',
      requerCredencial: true,
    }])
    mockCreateClient.mockResolvedValue(supabaseComAdvogados())

    const res = await POST(request({ fonte: 'datajud-cnj' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sucesso).toBe(false)
    expect(body.erro).toBe('Fonte requer credencial antes de executar.')
  })
})
