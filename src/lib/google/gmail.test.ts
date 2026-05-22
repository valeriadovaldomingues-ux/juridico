import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGmailCleanupAction, buildGmailCleanupQuery, classifyMessage, previewGmailCleanup } from './gmail'

describe('gmail cleanup preview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('monta query segura para pré-análise de limpeza', () => {
    const query = buildGmailCleanupQuery({
      remetente: 'newsletter@example.com',
      assunto: 'Oferta',
      palavraChave: 'webinar',
      posteriorA: '2026-05-01',
      anteriorA: '2026-05-21',
      comAnexos: true,
    })

    expect(query).toContain('from:newsletter@example.com')
    expect(query).toContain('subject:(Oferta)')
    expect(query).toContain('webinar')
    expect(query).toContain('after:2026/05/01')
    expect(query).toContain('before:2026/05/21')
    expect(query).toContain('has:attachment')
  })

  it('busca apenas metadados/snippet e classifica candidatos sem modificar emails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)
      if (url.includes('/users/me/messages?')) {
        return new Response(JSON.stringify({
          resultSizeEstimate: 1,
          messages: [{ id: 'msg-1', threadId: 'thr-1' }],
        }), { status: 200 })
      }
      if (url.includes('/users/me/messages/msg-1?')) {
        expect(url).toContain('format=metadata')
        expect(url).toContain('metadataHeaders=From')
        expect(url).toContain('metadataHeaders=Subject')
        return new Response(JSON.stringify({
          id: 'msg-1',
          threadId: 'thr-1',
          labelIds: ['INBOX'],
          snippet: 'Intimação recebida para ciência e manifestação.',
          payload: {
            headers: [
              { name: 'From', value: 'tribunal@example.jus.br' },
              { name: 'Subject', value: 'Intimação eletrônica' },
              { name: 'Date', value: 'Thu, 21 May 2026 10:00:00 -0300' },
            ],
          },
        }), { status: 200 })
      }
      throw new Error(`URL inesperada: ${url}`)
    })

    const preview = await previewGmailCleanup('access-token', { palavraChave: 'intimação', maxResults: 20 })

    expect(preview.totalEstimado).toBe(1)
    expect(preview.mensagens[0]).toMatchObject({
      id: 'msg-1',
      from: 'tribunal@example.jus.br',
      subject: 'Intimação eletrônica',
      categoria: 'juridico_processual',
      preSelecionado: false,
      sugestao: 'candidata_publicacao',
    })
    expect(fetchMock.mock.calls.map(call => String(call[0])).some(url => /trash|modify|send|labels/i.test(url))).toBe(false)
  })

  it('não classifica intimação como limpeza', () => {
    const result = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Intimação para ciência no processo.',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'Subject', value: 'Intimação eletrônica' }] },
    })

    expect(result.categoria).toBe('juridico_processual')
    expect(result.preSelecionado).toBe(false)
    expect(result.sugestao).not.toBe('candidata_limpeza')
  })

  it('não classifica processo como limpeza', () => {
    const result = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Atualização do processo 0000000-00.2026.8.13.0000.',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'Subject', value: 'Andamento processual' }] },
    })

    expect(result.categoria).toBe('juridico_processual')
    expect(result.preSelecionado).toBe(false)
  })

  it('não classifica boleto como limpeza', () => {
    const result = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Boleto disponível para pagamento.',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'Subject', value: 'Boleto bancário' }] },
    })

    expect(result.categoria).toBe('financeiro_banco_pagamento')
    expect(result.preSelecionado).toBe(false)
    expect(result.sugestao).toBe('revisar')
  })

  it('marca email com anexo para revisão com cuidado', () => {
    const result = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Newsletter com oferta.',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'Subject', value: 'Newsletter de ofertas' }] },
    }, { hasAttachmentQuery: true })

    expect(result.alertaAnexo).toBe(true)
    expect(result.preSelecionado).toBe(false)
    expect(result.motivos.join(' ')).toContain('anexo')
  })

  it('classifica unsubscribe/promoção/noreply como propaganda provável com confiança alta', () => {
    const result = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Promoção com desconto. Clique para unsubscribe.',
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'From', value: 'No Reply <no-reply@marketing.example.com>' },
          { name: 'Subject', value: 'Newsletter promocional' },
        ],
      },
    })

    expect(result.categoria).toBe('propaganda_newsletter')
    expect(result.confianca).toBe('alta')
    expect(result.preSelecionado).toBe(true)
  })

  it('pré-seleciona apenas propaganda ou spam com confiança alta', () => {
    const propaganda = classifyMessage({
      id: 'msg-1',
      threadId: 'thr-1',
      snippet: 'Newsletter com oferta e link para descadastrar.',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'From', value: 'noreply@example.com' }] },
    })
    const humano = classifyMessage({
      id: 'msg-2',
      threadId: 'thr-2',
      snippet: 'Olá, podemos conversar amanhã?',
      labelIds: ['INBOX'],
      payload: { headers: [{ name: 'From', value: 'Maria Silva <maria@gmail.com>' }] },
    })

    expect(propaganda.preSelecionado).toBe(true)
    expect(propaganda.confianca).toBe('alta')
    expect(humano.preSelecionado).toBe(false)
    expect(humano.categoria).toBe('possivelmente_importante')
  })

  it('move para lixeira usando users.messages.trash e nunca chama delete', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await applyGmailCleanupAction('access-token', 'trash', ['msg-1'])

    expect(result.totalAplicado).toBe(1)
    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls[0]).toContain('/users/me/messages/msg-1/trash')
    expect(urls.some(url => url.includes('/delete'))).toBe(false)
  })

  it('arquiva removendo o label INBOX', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await applyGmailCleanupAction('access-token', 'archive', ['msg-1'])

    expect(String(fetchMock.mock.calls[0][0])).toContain('/users/me/messages/msg-1/modify')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ removeLabelIds: ['INBOX'] })
  })

  it('marca como lido removendo o label UNREAD', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await applyGmailCleanupAction('access-token', 'mark_read', ['msg-1'])

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ removeLabelIds: ['UNREAD'] })
  })

  it('marca como spam aplicando o label SPAM', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await applyGmailCleanupAction('access-token', 'spam', ['msg-1'])

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ addLabelIds: ['SPAM'] })
  })

  it('cria/aplica label Triado pela Aurora quando necessário', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/users/me/labels') && method === 'GET') {
        return new Response(JSON.stringify({ labels: [] }), { status: 200 })
      }
      if (url.endsWith('/users/me/labels') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'Label_123', name: 'Triado pela Aurora' }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })

    await applyGmailCleanupAction('access-token', 'label_triaged', ['msg-1'])

    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls[0]).toContain('/users/me/labels')
    expect(urls[1]).toContain('/users/me/labels')
    expect(urls[2]).toContain('/users/me/messages/msg-1/modify')
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ addLabelIds: ['Label_123'] })
  })
})
