import { extrairNumeroProcesso } from './tjmg-dje'
import { montarTermosOAB } from './trt3-dejt'

const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const MAX_ITENS_POR_CONSULTA = 50
const MAX_CONSULTAS = 30

export interface TRT3DJENPublicacao {
  id: string
  nome_pesquisado: string
  termo_encontrado: string
  numero_processo: string | null
  data_publicacao: string
  texto_publicacao: string
  orgao: string | null
  tribunal: string
  origem: 'trf_djen' | 'tj_djen' | 'tjsp_djen' | 'trt_djen' | 'trt3_djen'
  tipo_comunicacao: string | null
}

interface ComunicacaoDJEN {
  id?: number | string
  hash?: string
  data_disponibilizacao?: string
  datadisponibilizacao?: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  texto?: string
  numero_processo?: string
  numeroprocessocommascara?: string
  destinatarios?: Array<{ nome?: string }>
  destinatarioadvogados?: Array<{ nome?: string; numero_oab?: string; uf_oab?: string }>
}

interface RespostaDJEN {
  status?: string
  message?: string
  count?: number
  items?: ComunicacaoDJEN[]
}

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function limparHTML(texto: string) {
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
    .replace(/\s+/g, ' ')
    .trim()
}

function prepararData(data?: string) {
  return data?.trim() || hojeSaoPaulo()
}

function processoDigits(processo: string) {
  return processo.replace(/\D/g, '')
}

function parametrosBase(data: string, tribunal: string) {
  return {
    pagina: '0',
    itensPorPagina: String(MAX_ITENS_POR_CONSULTA),
    siglaTribunal: tribunal,
    dataDisponibilizacaoInicio: data,
    dataDisponibilizacaoFim: data,
  }
}

function extrairOab(oab: string) {
  const numero = oab.replace(/\D/g, '')
  const uf = oab.match(/[A-Za-z]{2}/)?.[0]?.toUpperCase() ?? 'MG'
  if (!numero) return null
  return { numero, uf }
}

function termosBusca(opcoes: { nomes: string[]; processos?: string[]; oabs?: string[] }) {
  const termos = [
    ...opcoes.nomes,
    ...(opcoes.processos ?? []),
    ...montarTermosOAB(opcoes.oabs ?? []),
    'Pessoa e do Val Advocacia',
    'PESSOA E DO VAL ADVOCACIA',
  ].map(termo => termo.trim()).filter(Boolean)

  return [...new Set(termos)]
}

function comunicacaoContemTermo(item: ComunicacaoDJEN, termo: string) {
  const alvo = normalizar([
    item.texto,
    item.numero_processo,
    item.numeroprocessocommascara,
    item.destinatarios?.map(dest => dest.nome).join(' '),
    item.destinatarioadvogados?.map(adv => [adv.nome, adv.uf_oab, adv.numero_oab].filter(Boolean).join(' ')).join(' '),
  ].filter(Boolean).join(' '))

  return alvo.includes(normalizar(termo))
}

async function consultarDJEN(params: Record<string, string>, timeoutMs = 30_000): Promise<RespostaDJEN> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const url = `${DJEN_API_URL}?${new URLSearchParams(params).toString()}`

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; monitoramento-juridico/1.0)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`DJEN CNJ indisponível: HTTP ${res.status}`)
    const json = await res.json()
    return json as RespostaDJEN
  } finally {
    clearTimeout(timer)
  }
}

async function consultarPorTermos(opcoes: {
  data: string
  tribunal: string
  nomes: string[]
  processos: string[]
  oabs: string[]
}) {
  const consultas: Array<{ termo: string; params: Record<string, string> }> = []

  for (const nome of opcoes.nomes) {
    consultas.push({ termo: nome, params: { ...parametrosBase(opcoes.data, opcoes.tribunal), nomeAdvogado: nome } })
  }

  for (const processo of opcoes.processos) {
    const numeroProcesso = processoDigits(processo)
    if (numeroProcesso) {
      consultas.push({ termo: processo, params: { ...parametrosBase(opcoes.data, opcoes.tribunal), numeroProcesso } })
    }
  }

  for (const oabRaw of opcoes.oabs) {
    const oab = extrairOab(oabRaw)
    if (oab) {
      consultas.push({
        termo: `${oab.uf}${oab.numero}`,
        params: { ...parametrosBase(opcoes.data, opcoes.tribunal), numeroOab: oab.numero, ufOab: oab.uf },
      })
    }
  }

  consultas.push({
    termo: 'Pessoa e do Val Advocacia',
    params: { ...parametrosBase(opcoes.data, opcoes.tribunal), nomeParte: 'Pessoa e do Val Advocacia' },
  })

  const resultados: Array<{ termo: string; item: ComunicacaoDJEN }> = []
  for (const consulta of consultas.slice(0, MAX_CONSULTAS)) {
    const resposta = await consultarDJEN(consulta.params)
    for (const item of resposta.items ?? []) {
      resultados.push({ termo: consulta.termo, item })
    }
  }
  return resultados
}

export function mapearComunicacaoDJEN(
  item: ComunicacaoDJEN,
  termo: string,
  tribunal = 'TRT3',
): TRT3DJENPublicacao | null {
  const texto = limparHTML(item.texto ?? '')
  if (!texto) return null

  const numero = item.numeroprocessocommascara || item.numero_processo || extrairNumeroProcesso(texto)
  return {
    id: String(item.hash ?? item.id ?? `${numero ?? ''}|${texto.slice(0, 80)}`),
    nome_pesquisado: termo,
    termo_encontrado: termo,
    numero_processo: numero || null,
    data_publicacao: item.data_disponibilizacao ?? item.datadisponibilizacao ?? hojeSaoPaulo(),
    texto_publicacao: texto.slice(0, 5_000),
    orgao: item.nomeOrgao ?? null,
    tribunal,
    origem: tribunal === 'TRT3'
      ? 'trt3_djen'
      : tribunal === 'TJSP'
        ? 'tjsp_djen'
        : tribunal.startsWith('TJ')
          ? 'tj_djen'
          : tribunal.startsWith('TRF')
            ? 'trf_djen'
            : 'trt_djen',
    tipo_comunicacao: item.tipoComunicacao ?? null,
  }
}

export async function buscarPublicacoesTRTDJEN(opcoes: {
  tribunal: string
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
  comunicacoes?: ComunicacaoDJEN[]
}): Promise<TRT3DJENPublicacao[]> {
  const tribunal = opcoes.tribunal.trim().toUpperCase()
  const data = prepararData(opcoes.data)
  const termos = termosBusca({
    nomes: opcoes.nomes,
    processos: opcoes.processos ?? [],
    oabs: opcoes.oabs ?? [],
  })
  if (termos.length === 0) return []

  const encontrados = opcoes.comunicacoes
    ? opcoes.comunicacoes.flatMap(item => termos
      .filter(termo => comunicacaoContemTermo(item, termo))
      .map(termo => ({ termo, item })))
    : await consultarPorTermos({
      data,
      tribunal,
      nomes: opcoes.nomes,
      processos: opcoes.processos ?? [],
      oabs: opcoes.oabs ?? [],
    })

  const vistos = new Set<string>()
  const publicacoes: TRT3DJENPublicacao[] = []
  for (const encontrado of encontrados) {
    if (encontrado.item.siglaTribunal && encontrado.item.siglaTribunal !== tribunal) continue

    const pub = mapearComunicacaoDJEN(encontrado.item, encontrado.termo, tribunal)
    if (!pub) continue

    const chave = pub.id
    if (vistos.has(chave)) continue
    vistos.add(chave)
    publicacoes.push(pub)
  }

  return publicacoes
}

export async function buscarPublicacoesTRT3DJEN(opcoes: {
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
  comunicacoes?: ComunicacaoDJEN[]
}) {
  return buscarPublicacoesTRTDJEN({ ...opcoes, tribunal: 'TRT3' })
}
