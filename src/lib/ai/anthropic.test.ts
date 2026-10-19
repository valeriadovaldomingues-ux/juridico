import { describe, expect, it } from 'vitest'
import { ErroAnthropic, extrairJSON, paraMensagensAnthropic, textoDoEvento, usaAnthropic } from './anthropic'

describe('provedor Anthropic', () => {
  it('liga só com a chave, e AI_PROVIDER=openai desliga', () => {
    expect(usaAnthropic({})).toBe(false)
    expect(usaAnthropic({ ANTHROPIC_API_KEY: 'k' })).toBe(true)
    expect(usaAnthropic({ ANTHROPIC_API_KEY: 'k', AI_PROVIDER: 'openai' })).toBe(false)
    expect(usaAnthropic({ AI_PROVIDER: 'anthropic' })).toBe(true)
  })
  it('converte mensagens: system à parte, papéis seguidos juntados, começa por user', () => {
    const r = paraMensagensAnthropic([
      { role: 'system', content: 'Seja breve.' }, { role: 'system', content: 'Em português.' },
      { role: 'assistant', content: 'Olá' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' },
    ])
    expect(r.system).toBe('Seja breve.\n\nEm português.')
    expect(r.messages[0].role).toBe('user')
    expect(r.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(r.messages[2].content).toBe('a\n\nb')
  })
  it('extrai o JSON de cercas e texto em volta', () => {
    expect(extrairJSON('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(extrairJSON('Claro! {"a":{"b":2}} pronto')).toBe('{"a":{"b":2}}')
    expect(extrairJSON('sem json')).toBe('{}')
  })
  it('lê o texto dos eventos de streaming', () => {
    expect(textoDoEvento('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Oi"}}')).toBe('Oi')
    expect(textoDoEvento('data: {"type":"message_start"}')).toBe('')
    expect(textoDoEvento('event: ping')).toBe('')
  })
  it('reconhece falta de crédito', () => {
    expect(new ErroAnthropic(400, 'Your credit balance is too low to access the Anthropic API.').code).toBe('credit_balance_exhausted')
    expect(new ErroAnthropic(401, 'invalid x-api-key').code).toBeUndefined()
  })
})
