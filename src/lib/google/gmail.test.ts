import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGmailCleanupQuery, previewGmailCleanup } from './gmail'

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
      sugestao: 'candidata_publicacao',
    })
    expect(fetchMock.mock.calls.map(call => String(call[0])).some(url => /trash|modify|send|labels/i.test(url))).toBe(false)
  })
})
