import { describe, expect, it } from 'vitest'
import { AuroraAccessError } from './security'
import { classificarMensagemAurora } from './router'

describe('classificarMensagemAurora', () => {
  it('roteia menção explícita @Olavo para Olavo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Olavo analisar este processo',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olavo')
    expect(resultado.reason).toBe('explicit_mention')
    expect(resultado.explicitValid).toBe(true)
  })

  it('roteia comando explícito /olavo para Olavo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '/olavo prazos da semana',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olavo')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia comando explícito /atena para Atena', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '/atena avaliar honorários',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('atena')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia comando explícito /olivia para Olívia', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '/olivia organizar agenda',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olivia')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia @Stella para Stella', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Stella analisar publicações e prazos',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('stella')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia @Atlas e @Oráculo com normalização de acentos', () => {
    const atlas = classificarMensagemAurora({
      mensagem: '@Atlas revisar status e bloqueadores',
      modo: 'rapido',
      role: 'socio',
    })
    const oraculo = classificarMensagemAurora({
      mensagem: '@Oráculo avaliar risco de acordo',
      modo: 'rapido',
      role: 'socio',
    })

    expect(atlas.agentId).toBe('atlas')
    expect(oraculo.agentId).toBe('oraculo')
  })

  it('roteia /oraculo sem acento para Oráculo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '/oraculo estratégia do caso',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('oraculo')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia @Atena, @Olivia e @Dominic para os agentes corretos', () => {
    const atena = classificarMensagemAurora({
      mensagem: '@Atena avaliar honorários e viabilidade',
      modo: 'rapido',
      role: 'socio',
    })
    const olivia = classificarMensagemAurora({
      mensagem: '@Olivia organizar agenda e compromissos',
      modo: 'rapido',
      role: 'socio',
    })
    const dominic = classificarMensagemAurora({
      mensagem: '@Dominic estruturar marketing e conversão',
      modo: 'rapido',
      role: 'socio',
    })

    expect(atena.agentId).toBe('atena')
    expect(olivia.agentId).toBe('olivia')
    expect(dominic.agentId).toBe('dominic')
  })

  it('roteia @Aurora e /aurora para Aurora Principal', () => {
    const resultado1 = classificarMensagemAurora({
      mensagem: '@Aurora organizar a conversa',
      modo: 'rapido',
      role: 'socio',
    })
    const resultado2 = classificarMensagemAurora({
      mensagem: '/aurora organizar a conversa',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado1.agentId).toBe('principal')
    expect(resultado2.agentId).toBe('principal')
    expect(resultado1.reason).toBe('explicit_mention')
  })

  it('chamada inválida cai na Aurora Principal', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@AgenteSecreto analisar isso',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('principal')
    expect(resultado.reason).toBe('explicit_invalid')
    expect(resultado.explicitValid).toBe(false)
  })

  it('menção a Lívia cai na Aurora Principal como inválida', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Lívia analisar isso',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('principal')
    expect(resultado.reason).toBe('explicit_invalid')
    expect(resultado.explicitValid).toBe(false)
  })

  it('menção a Livia sem acento cai na Aurora Principal como inválida', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Livia analisar isso',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('principal')
    expect(resultado.reason).toBe('explicit_invalid')
    expect(resultado.explicitValid).toBe(false)
  })

  it('roteia processos, prazos, publicações e andamentos para Stella', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Confira processo, prazo e publicações de hoje',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('stella')
    expect(resultado.modo).toBe('rapido')
  })

  it('roteia peças, teses e providências para Olavo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Preciso de uma petição com tese e providência processual',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olavo')
  })

  it('roteia status, bloqueadores e sincronia para Atlas', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Atualize o status, identifique bloqueadores e sincronize o fluxo',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('atlas')
  })

  it('roteia financeiro e honorários para Atena', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Ver honorários, lucro e viabilidade financeira do caso',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('atena')
  })

  it('roteia marketing e conversão para Dominic', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Ajuste o posicionamento, a autoridade e a conversão da campanha',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('dominic')
  })

  it('roteia agenda, compromissos e conflitos para Olívia', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Organize a agenda, conflitos de horário e compromissos da semana',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olivia')
  })

  it('menção a Clara cai na Aurora Principal como inválida', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Clara listar pendências do cliente',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('principal')
    expect(resultado.reason).toBe('explicit_invalid')
  })

  it('roteia estratégia e risco para Oráculo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Avalie a estratégia, o risco e os próximos passos',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('oraculo')
  })

  it('mantém modo profundo sem acionar múltiplos agentes', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Preciso analisar o cenário e o risco do acordo',
      modo: 'profundo',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('oraculo')
    expect(resultado.modo).toBe('profundo')
    expect(Array.isArray(resultado.matchedKeywords)).toBe(true)
  })

  it('faz fallback para Aurora Principal quando não há intenção clara', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Olá',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('principal')
    expect(resultado.score).toBe(0)
    expect(resultado.reason).toBe('nenhuma_intencao_clara')
  })

  it('apenas um subagente é escolhido no modo rápido', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Olavo prazo e e-mail com contrato e cliente',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olavo')
    expect(resultado.reason).toBe('explicit_mention')
    expect(resultado.matchedKeywords).toEqual([])
  })

  it('bloqueia não sócio mesmo na camada de roteamento', () => {
    expect(() =>
      classificarMensagemAurora({
        mensagem: '@Olavo analisar este processo',
        modo: 'rapido',
        role: 'gerente',
      }),
    ).toThrow(AuroraAccessError)
  })
})
