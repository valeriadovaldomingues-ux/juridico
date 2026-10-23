// ─── DjenPublicationProvider ─────────────────────────────────────────────────
//
// Implementação do contrato PublicationProvider para o DJEN (fonte oficial:
// API pública de comunicações do CNJ — comunicaapi.pje.jus.br, a mesma que
// atende o portal comunica.pje.jus.br; CORS aberto, sem autenticação).
//
// Limitação conhecida e documentada: o WAF do CNJ recusa requisições
// originadas de IPs de datacenter (HTTP 403) — execuções server-side na
// Vercel falham com situacao 'bloqueado'. A captura via navegador do usuário
// autenticado usa esta mesma montagem de consultas e o endpoint oficial.
//
// Resiliência: timeout configurável, retries com backoff para 429/5xx/rede,
// paginação segura por `count` com detecção de página repetida, falha parcial
// não cancela o lote.

import { createHash } from 'node:crypto'
import { somenteDigitos } from '../cnj'
import {
  DJEN_API_URL,
  DJEN_ITENS_POR_PAGINA,
  urlConsultaDJEN,
} from './consultas'
import {
  DJEN_FONTE_CODIGO,
  DJEN_FONTE_NOME,
  type ComunicacaoDJENBruta,
  type ConsultaDJEN,
  type ErroConsultaDJEN,
  type ItemEncontradoDJEN,
  type PeriodoConsulta,
  type PublicacaoDJENNormalizada,
  type PublicationProvider,
  type RespostaDJEN,
  type StatusProvider,
} from './types'

const MAX_PAGINAS_POR_CONSULTA = 20
const MAX_TENTATIVAS = 3
const TIMEOUT_PADRAO_MS = 30_000
const DELAY_ENTRE_REQUISICOES_MS = 1_200
const BACKOFF_BASE_MS = 4_000
const MAX_TEXTO_CHARS = 20_000

export interface DjenProviderOptions {
  timeoutMs?: number
  delayEntreRequisicoesMs?: number
  maxTentativas?: number
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

function sleepReal(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function limparHTMLPublicacao(texto: string): string {
  return texto
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|p|div|tr|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

/**
 * Hash de deduplicação estável entre execuções e termos de busca:
 *  - com identificador oficial: djen|<id oficial>
 *  - sem identificador: djen|<tribunal>|<nº processo dígitos>|<data>|<sha do texto limpo>
 * Nunca usa o termo pesquisado nem a fonte por tribunal — a mesma comunicação
 * encontrada por OABs ou nomes diferentes gera o MESMO hash.
 */
export function gerarHashDJEN(item: ComunicacaoDJENBruta): string {
  const idOficial = item.hash ?? (item.id != null ? String(item.id) : null)
  if (idOficial) return `djen_${sha256(`djen|${idOficial}`)}`

  const texto = limparHTMLPublicacao(item.texto ?? '')
  const digits = somenteDigitos(item.numero_processo ?? item.numeroprocessocommascara ?? '')
  const data = item.data_disponibilizacao ?? item.datadisponibilizacao ?? ''
  return `djen_${sha256(`djen|${item.siglaTribunal ?? ''}|${digits}|${data}|${sha256(texto)}`)}`
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export class DjenPublicationProvider implements PublicationProvider {
  readonly codigo = DJEN_FONTE_CODIGO
  readonly nome = DJEN_FONTE_NOME

  private readonly timeoutMs: number
  private readonly delayMs: number
  private readonly maxTentativas: number
  private readonly fetchFn: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private ultimoStatus: StatusProvider

  constructor(options: DjenProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_PADRAO_MS
    this.delayMs = options.delayEntreRequisicoesMs ?? DELAY_ENTRE_REQUISICOES_MS
    this.maxTentativas = options.maxTentativas ?? MAX_TENTATIVAS
    this.fetchFn = options.fetchFn ?? fetch
    this.sleep = options.sleep ?? sleepReal
    this.ultimoStatus = {
      codigo: this.codigo,
      situacao: 'desconhecido',
      detalhe: 'Nenhuma verificação realizada nesta instância.',
      verificado_em: null,
    }
  }

  getProviderStatus(): StatusProvider {
    return this.ultimoStatus
  }

  async testConnection(): Promise<StatusProvider> {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const params = new URLSearchParams({
      pagina: '1',
      itensPorPagina: '1',
      dataDisponibilizacaoInicio: hoje,
      dataDisponibilizacaoFim: hoje,
    })

    let situacao: StatusProvider
    try {
      await this.requisitar(`${DJEN_API_URL}?${params.toString()}`, 1)
      situacao = {
        codigo: this.codigo,
        situacao: 'operacional',
        detalhe: 'API pública do DJEN respondeu com sucesso.',
        status_http: 200,
        verificado_em: new Date().toISOString(),
      }
    } catch (error) {
      situacao = this.classificarErro(error)
    }

    this.ultimoStatus = situacao
    return situacao
  }

  async fetchPublicationDetails(idExterno: string): Promise<ComunicacaoDJENBruta | null> {
    const id = idExterno.trim()
    if (!/^\d+$/.test(id)) return null

    try {
      const json = await this.requisitar(`${DJEN_API_URL}/${id}`) as ComunicacaoDJENBruta | RespostaDJEN
      if (json && typeof json === 'object' && 'items' in json) {
        return (json as RespostaDJEN).items?.[0] ?? null
      }
      return (json as ComunicacaoDJENBruta) ?? null
    } catch {
      return null
    }
  }

  async searchPublications(
    consultas: ConsultaDJEN[],
    _periodo: PeriodoConsulta,
  ): Promise<{
    encontrados: ItemEncontradoDJEN[]
    consultas_realizadas: number
    paginas_consultadas: number
    total_disponivel: number
    incompleto: boolean
    erros: ErroConsultaDJEN[]
  }> {
    const encontrados: ItemEncontradoDJEN[] = []
    const erros: ErroConsultaDJEN[] = []
    let paginas = 0
    let totalDisponivel = 0
    let incompleto = false
    let consultasRealizadas = 0

    for (const consulta of consultas) {
      consultasRealizadas++
      let pagina = 1
      let coletados = 0
      let count = Number.POSITIVE_INFINITY
      let primeiroIdPaginaAnterior: string | null = null

      while (pagina <= MAX_PAGINAS_POR_CONSULTA && coletados < count) {
        let resposta: RespostaDJEN
        try {
          resposta = await this.requisitar(urlConsultaDJEN(consulta, pagina)) as RespostaDJEN
        } catch (error) {
          const status = this.classificarErro(error)
          erros.push({
            consulta: `${consulta.tipo}:${consulta.termo}${consulta.siglaTribunal ? `@${consulta.siglaTribunal}` : ''} p${pagina}`,
            mensagem: status.detalhe,
            status_http: status.status_http,
            temporario: status.situacao === 'rate_limit' || status.situacao === 'indisponivel',
          })
          incompleto = true
          this.ultimoStatus = status
          break
        }

        paginas++
        count = typeof resposta.count === 'number' ? resposta.count : 0
        const items = resposta.items ?? []
        if (items.length === 0) break

        // Proteção contra paginação que repete a mesma página
        const primeiroId = items[0]?.id != null ? String(items[0].id) : JSON.stringify(items[0]).slice(0, 120)
        if (primeiroId === primeiroIdPaginaAnterior) {
          incompleto = true
          break
        }
        primeiroIdPaginaAnterior = primeiroId

        for (const item of items) {
          encontrados.push({ consulta, item })
        }
        coletados += items.length
        totalDisponivel = Math.max(totalDisponivel, count)

        pagina++
        if (coletados < count && pagina <= MAX_PAGINAS_POR_CONSULTA) {
          await this.sleep(this.delayMs)
        }
      }

      if (coletados < count && count !== Number.POSITIVE_INFINITY && coletados > 0) {
        incompleto = incompleto || coletados < count
      }

      if (consulta !== consultas[consultas.length - 1]) {
        await this.sleep(this.delayMs)
      }
    }

    if (erros.length === 0) {
      this.ultimoStatus = {
        codigo: this.codigo,
        situacao: 'operacional',
        detalhe: 'Busca concluída com sucesso.',
        status_http: 200,
        verificado_em: new Date().toISOString(),
      }
    }

    return {
      encontrados,
      consultas_realizadas: consultasRealizadas,
      paginas_consultadas: paginas,
      total_disponivel: totalDisponivel,
      incompleto,
      erros,
    }
  }

  normalizePublication(encontrado: ItemEncontradoDJEN): PublicacaoDJENNormalizada | null {
    const { item, consulta } = encontrado
    const texto = limparHTMLPublicacao(item.texto ?? '').slice(0, MAX_TEXTO_CHARS)
    if (!texto) return null

    const numeroMascara = item.numeroprocessocommascara?.trim() || null
    const digits = somenteDigitos(item.numero_processo ?? item.numeroprocessocommascara ?? '')
    const idExterno = item.id != null ? String(item.id) : item.hash ?? null

    const advogados = (item.destinatarioadvogados ?? [])
      .map(entry => {
        const dados = entry.advogado ?? entry
        const nome = dados?.nome?.trim()
        if (!nome) return null
        return {
          nome,
          numero_oab: dados?.numero_oab ? String(dados.numero_oab) : undefined,
          uf_oab: dados?.uf_oab ?? undefined,
        }
      })
      .filter((adv): adv is NonNullable<typeof adv> => adv !== null)

    const partes = (item.destinatarios ?? [])
      .map(dest => {
        const nome = dest?.nome?.trim()
        if (!nome) return null
        return { nome, polo: dest.polo }
      })
      .filter((parte): parte is NonNullable<typeof parte> => parte !== null)

    return {
      fonte_codigo: DJEN_FONTE_CODIGO,
      id_externo: idExterno,
      hash: gerarHashDJEN(item),
      url_oficial: item.link?.trim() || null,
      tribunal: item.siglaTribunal?.trim() || null,
      orgao: item.nomeOrgao?.trim() || null,
      tipo_comunicacao: item.tipoComunicacao?.trim() || null,
      numero_processo: numeroMascara ?? (digits || null),
      numero_processo_digits: digits || null,
      data_disponibilizacao: item.data_disponibilizacao ?? item.datadisponibilizacao ?? null,
      texto,
      partes: partes.length ? partes : null,
      advogados: advogados.length ? advogados : null,
      nome_pesquisado: consulta.termo,
      termo_encontrado: consulta.termo,
      advogado_monitorado_id: consulta.advogado_monitorado_id ?? null,
      dados_brutos: item,
    }
  }

  // ─── HTTP com timeout + retry/backoff ─────────────────────────────────────

  private async requisitar(url: string, tentativasOverride?: number): Promise<unknown> {
    const tentativas = tentativasOverride ?? this.maxTentativas
    let ultimoErro: unknown

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
      try {
        const res = await this.fetchFn(url, {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; monitoramento-juridico/1.0)',
            Accept: 'application/json',
          },
        })
        if (!res.ok) {
          throw new HttpError(res.status, `DJEN respondeu HTTP ${res.status}`)
        }
        return await res.json()
      } catch (error) {
        ultimoErro = error
        const retryavel = this.erroRetryavel(error)
        if (!retryavel || tentativa === tentativas) break
        await this.sleep(BACKOFF_BASE_MS * 2 ** (tentativa - 1))
      } finally {
        clearTimeout(timer)
      }
    }

    throw ultimoErro
  }

  private erroRetryavel(error: unknown): boolean {
    if (error instanceof HttpError) {
      return error.status === 429 || error.status >= 500
    }
    // AbortError (timeout) e falhas de rede são temporárias
    return true
  }

  private classificarErro(error: unknown): StatusProvider {
    const agora = new Date().toISOString()
    if (error instanceof HttpError) {
      if (error.status === 403) {
        return {
          codigo: this.codigo,
          situacao: 'bloqueado',
          detalhe: 'O WAF do CNJ recusou a requisição deste ambiente (HTTP 403). Use a consulta pelo navegador.',
          status_http: 403,
          verificado_em: agora,
        }
      }
      if (error.status === 429) {
        return {
          codigo: this.codigo,
          situacao: 'rate_limit',
          detalhe: 'Limite de requisições do DJEN atingido (HTTP 429). Tente novamente em alguns minutos.',
          status_http: 429,
          verificado_em: agora,
        }
      }
      return {
        codigo: this.codigo,
        situacao: 'indisponivel',
        detalhe: `DJEN indisponível (HTTP ${error.status}).`,
        status_http: error.status,
        verificado_em: agora,
      }
    }

    const mensagem = error instanceof Error ? error.message : String(error)
    return {
      codigo: this.codigo,
      situacao: 'indisponivel',
      detalhe: /abort/i.test(mensagem)
        ? 'Timeout na consulta ao DJEN.'
        : `Falha de rede na consulta ao DJEN: ${mensagem}`,
      verificado_em: agora,
    }
  }
}

export function criarProviderDJEN(options: DjenProviderOptions = {}): DjenPublicationProvider {
  return new DjenPublicationProvider(options)
}
