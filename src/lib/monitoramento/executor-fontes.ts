import type { FonteMonitoramento, ResultadoMonitoramento } from './fontes'

export interface ErroFonteDetalhado {
  tipo: 'rate_limit' | 'timeout' | 'http' | 'rede' | 'desconhecido'
  status_http?: number
  mensagem: string
  temporario: boolean
  recomendacao?: string
}

export interface ResultadoFonteFila {
  resultado: ResultadoMonitoramento
  erro_detalhado?: ErroFonteDetalhado
}

export interface ResumoExecucaoFontes {
  total_fontes: number
  fontes_sucesso: number
  fontes_erro_temporario: number
  fontes_rate_limit: number
  fontes_pendentes: number
  recomendacao?: string
}

interface ExecutarFontesComFilaOptions {
  fontes: FonteMonitoramento[]
  executarFonte: (fonte: FonteMonitoramento) => Promise<ResultadoMonitoramento>
  delayEntreFontesMs?: number
  backoffRateLimitMs?: number
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_DELAY_ENTRE_FONTES_MS = 2_500
const DEFAULT_BACKOFF_RATE_LIMIT_MS = 8_000

function sleepReal(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function fonteUsaDJENCNJ(fonte: FonteMonitoramento) {
  return fonte.descricao.toLowerCase().includes('djen/cnj')
}

export function detalharErroFonte(resultado: ResultadoMonitoramento): ErroFonteDetalhado | undefined {
  const texto = [
    resultado.erro,
    resultado.mensagem,
  ].filter(Boolean).join(' ')

  if (!texto && resultado.status !== 'erro') return undefined

  const statusMatch = texto.match(/HTTP\s+(\d{3})/i)
  const status = statusMatch ? Number(statusMatch[1]) : undefined
  const lower = texto.toLowerCase()

  if (status === 429 || lower.includes('too many') || lower.includes('rate limit')) {
    return {
      tipo: 'rate_limit',
      status_http: 429,
      mensagem: texto || 'Rate limit na fonte de monitoramento.',
      temporario: true,
      recomendacao: 'Tente novamente em alguns minutos.',
    }
  }

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('abort')) {
    return {
      tipo: 'timeout',
      status_http: status,
      mensagem: texto || 'Timeout na fonte de monitoramento.',
      temporario: true,
      recomendacao: 'Tente novamente em alguns minutos.',
    }
  }

  if (status) {
    return {
      tipo: 'http',
      status_http: status,
      mensagem: texto,
      temporario: status >= 500,
      recomendacao: status >= 500 ? 'Tente novamente em alguns minutos.' : undefined,
    }
  }

  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnreset')) {
    return {
      tipo: 'rede',
      mensagem: texto || 'Falha de rede na fonte de monitoramento.',
      temporario: true,
      recomendacao: 'Tente novamente em alguns minutos.',
    }
  }

  if (resultado.status === 'erro') {
    return {
      tipo: 'desconhecido',
      mensagem: texto || 'Erro desconhecido na fonte de monitoramento.',
      temporario: true,
      recomendacao: 'Tente novamente em alguns minutos.',
    }
  }
}

export function resumirExecucaoFontes(resultados: ResultadoFonteFila[]): ResumoExecucaoFontes {
  const fontesRateLimit = resultados.filter(item => item.erro_detalhado?.tipo === 'rate_limit').length
  const fontesErroTemporario = resultados.filter(item => item.erro_detalhado?.temporario).length
  const fontesPendentes = resultados.filter(item => !['ativo', 'erro'].includes(item.resultado.status)).length
  const fontesSucesso = resultados.filter(item =>
    item.resultado.status === 'ativo' && !item.erro_detalhado,
  ).length

  return {
    total_fontes: resultados.length,
    fontes_sucesso: fontesSucesso,
    fontes_erro_temporario: fontesErroTemporario,
    fontes_rate_limit: fontesRateLimit,
    fontes_pendentes: fontesPendentes,
    recomendacao: fontesRateLimit > 0
      ? 'Algumas fontes retornaram rate limit. Tente novamente em alguns minutos.'
      : fontesErroTemporario > 0
        ? 'Algumas fontes falharam temporariamente. Tente novamente em alguns minutos.'
        : undefined,
  }
}

export async function executarFontesComFila({
  fontes,
  executarFonte,
  delayEntreFontesMs = DEFAULT_DELAY_ENTRE_FONTES_MS,
  backoffRateLimitMs = DEFAULT_BACKOFF_RATE_LIMIT_MS,
  sleep = sleepReal,
}: ExecutarFontesComFilaOptions): Promise<ResultadoFonteFila[]> {
  const resultados: ResultadoFonteFila[] = []

  for (let i = 0; i < fontes.length; i++) {
    const fonte = fontes[i]
    let resultado = await executarFonte(fonte)
    let erro_detalhado = detalharErroFonte(resultado)

    if (erro_detalhado?.tipo === 'rate_limit') {
      await sleep(backoffRateLimitMs)
      resultado = await executarFonte(fonte)
      erro_detalhado = detalharErroFonte(resultado)
    }

    resultados.push({ resultado, erro_detalhado })

    if (i === fontes.length - 1) continue
    if (!fonteUsaDJENCNJ(fonte)) continue

    await sleep(erro_detalhado?.tipo === 'rate_limit'
      ? backoffRateLimitMs
      : delayEntreFontesMs)
  }

  return resultados
}
