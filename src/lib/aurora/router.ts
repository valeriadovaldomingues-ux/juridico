import { listarAgentesAurora } from './registry'
import type { AuroraAgentId, AuroraRoutingDecision, AuroraRoutingInput } from './types'
import { exigirAuroraSocio } from './security'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const EXPLICIT_AGENT_ALIASES: Record<string, AuroraAgentId> = {
  aurora: 'principal',
  principal: 'principal',
  stella: 'stella',
  olavo: 'olavo',
  atlas: 'atlas',
  atena: 'atena',
  olivia: 'olivia',
  oraculo: 'oraculo',
  clara: 'clara',
  dominic: 'dominic',
}

function extrairChamadaExplicita(textoOriginal: string) {
  const texto = textoOriginal.trim()
  if (!texto) return null

  const inicio = texto.match(/^([@/])([^\s,.:;!?]+)/)
  if (!inicio) return null

  const token = inicio[2]
  const normalizado = normalizar(token)
  const agentId = EXPLICIT_AGENT_ALIASES[normalizado]
  if (!agentId) {
    return {
      token: normalizado,
      agentId: null,
      valido: false,
    }
  }

  return {
    token: normalizado,
    agentId,
    valido: true,
  }
}

function contarOcorrencias(texto: string, termo: string) {
  const alvo = normalizar(termo).trim()
  if (!alvo) return 0

  if (alvo.includes(' ')) {
    return texto.includes(alvo) ? 1 : 0
  }

  let count = 0
  const regex = new RegExp(`\\b${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
  while (regex.exec(texto)) count += 1
  return count
}

export function classificarMensagemAurora(input: AuroraRoutingInput): AuroraRoutingDecision {
  exigirAuroraSocio(input.role)
  const modo = input.modo ?? 'rapido'
  const chamadaExplicita = input.allowExplicitMention === false
    ? null
    : extrairChamadaExplicita(input.mensagem)

  if (chamadaExplicita?.agentId) {
    return {
      agentId: chamadaExplicita.agentId,
      modo,
      matchedKeywords: [],
      score: 1,
      reason: 'explicit_mention',
      explicitLabel: chamadaExplicita.token,
      explicitToken: chamadaExplicita.token,
      explicitValid: true,
    }
  }

  if (chamadaExplicita && !chamadaExplicita.valido) {
    return {
      agentId: 'principal',
      modo,
      matchedKeywords: [],
      score: 0,
      reason: 'explicit_invalid',
      explicitLabel: chamadaExplicita.token,
      explicitToken: chamadaExplicita.token,
      explicitValid: false,
    }
  }

  const contexto = [input.mensagem, ...(input.historicoRecente ?? [])]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1600)
  const texto = normalizar(contexto)

  const agentes = listarAgentesAurora().filter(agent => agent.id !== 'principal')
  const avaliados = agentes.map(agent => {
    const matchedKeywords = agent.keywords.filter(keyword => contarOcorrencias(texto, keyword) > 0)
    const score = matchedKeywords.reduce((total, keyword) => total + contarOcorrencias(texto, keyword), 0)
    const specificity = matchedKeywords.reduce((total, keyword) => total + normalizar(keyword).length, 0)
    return {
      agentId: agent.id,
      score,
      specificity,
      matchedKeywords,
      nome: agent.nome,
    }
  })

  const ordenados = avaliados
    .filter(item => item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      b.specificity - a.specificity ||
      listarAgentesAurora().findIndex(agent => agent.id === a.agentId) - listarAgentesAurora().findIndex(agent => agent.id === b.agentId)
    )

  const melhor = ordenados[0]
  const segundo = ordenados[1]

  if (!melhor) {
    return {
      agentId: 'principal',
      modo,
      matchedKeywords: [],
      score: 0,
      reason: 'nenhuma_intencao_clara',
      explicitLabel: null,
      explicitToken: null,
      explicitValid: false,
    }
  }

  if (segundo && melhor.score === segundo.score && melhor.specificity === segundo.specificity) {
    return {
      agentId: 'principal',
      modo,
      matchedKeywords: [],
      score: 0,
      reason: 'empate_sem_clareza',
      explicitLabel: null,
      explicitToken: null,
      explicitValid: false,
    }
  }

  return {
    agentId: melhor.agentId,
    modo,
    matchedKeywords: melhor.matchedKeywords,
    score: melhor.score,
    reason: `keyword_match:${melhor.matchedKeywords.join(',')}`,
    explicitLabel: null,
    explicitToken: null,
    explicitValid: false,
  }
}
