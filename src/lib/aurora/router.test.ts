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

  it('roteia @Stella para Stella', () => {
    const resultado = classificarMensagemAurora({
      mensagem: '@Stella preparar resposta para este e-mail',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('stella')
    expect(resultado.reason).toBe('explicit_mention')
  })

  it('roteia @Atlas e @Oráculo com normalização de acentos', () => {
    const atlas = classificarMensagemAurora({
      mensagem: '@Atlas revisar contrato',
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

  it('roteia @Dominic e @Clara para os agentes corretos', () => {
    const dominic = classificarMensagemAurora({
      mensagem: '@Dominic levantar horas cobradas',
      modo: 'rapido',
      role: 'socio',
    })
    const clara = classificarMensagemAurora({
      mensagem: '@Clara listar pendências do cliente',
      modo: 'rapido',
      role: 'socio',
    })

    expect(dominic.agentId).toBe('dominic')
    expect(clara.agentId).toBe('clara')
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

  it('roteia processos, prazos, publicações e andamentos para Olavo', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Confira processo, prazo e publicações de hoje',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('olavo')
    expect(resultado.modo).toBe('rapido')
  })

  it('roteia e-mails para Stella', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Preciso de triagem do inbox e rascunho de resposta',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('stella')
  })

  it('roteia documentos para Atlas', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Revisar contrato e notificação com procuração',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('atlas')
  })

  it('roteia financeiro e cobrança para Dominic', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Ver horas trabalhadas e cobrança do mês',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('dominic')
  })

  it('roteia follow-up e relacionamento com cliente para Clara', () => {
    const resultado = classificarMensagemAurora({
      mensagem: 'Precisamos de follow-up com o cliente sobre a pendência',
      modo: 'rapido',
      role: 'socio',
    })

    expect(resultado.agentId).toBe('clara')
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
