import { extrairNumeroProcesso } from './tjmg-dje'
import { inflateSync } from 'zlib'

const DEJT_TRT3_PDF_URL = 'https://diario.jt.jus.br/cadernos/Diario_J_03.pdf'
const JANELA_CONTEXTO = 700

export interface TRT3DEJTPublicacao {
  nome_pesquisado: string
  termo_encontrado: string
  numero_processo: string | null
  data_publicacao: string
  texto_publicacao: string
  orgao: string
  tribunal: 'TRT3'
  origem: 'trt3_dejt'
}

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

function normalizarTermo(termo: string) {
  return termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function termosUnicos(termos: string[]) {
  const vistos = new Set<string>()
  return termos
    .map(termo => termo.trim())
    .filter(Boolean)
    .filter(termo => {
      const key = normalizarTermo(termo)
      if (vistos.has(key)) return false
      vistos.add(key)
      return true
    })
}

export function montarTermosOAB(oabs: string[] = []) {
  return termosUnicos(oabs.flatMap(oab => {
    const limpo = oab.trim()
    const digits = limpo.replace(/\D/g, '')
    const uf = limpo.match(/[A-Za-z]{2}/)?.[0]?.toUpperCase() ?? 'MG'
    if (!digits) return []

    return [
      `${uf}${digits}`,
      `${uf} ${digits}`,
      `${digits}/${uf}`,
      `OAB/${uf} ${digits}`,
      `OAB ${uf}${digits}`,
      `OAB ${uf} ${digits}`,
    ]
  }))
}

async function fetchDEJT(timeoutMs = 30_000): Promise<Buffer> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(DEJT_TRT3_PDF_URL, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; monitoramento-juridico/1.0)',
        'Accept': 'application/pdf,*/*;q=0.8',
        'Referer': 'https://dejt.jt.jus.br/dejt/f/inicial.xhtml',
      },
    })
    if (!res.ok) {
      throw new Error(`DEJT TRT3 indisponível: HTTP ${res.status}`)
    }
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

function decodePdfLiteral(input: string) {
  return input
    .replace(/\\\)/g, ')')
    .replace(/\\\(/g, '(')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
}

function decodePdfHex(input: string) {
  const clean = input.replace(/\s+/g, '')
  const bytes: number[] = []
  for (let i = 0; i < clean.length - 1; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16)
    if (!Number.isNaN(code)) bytes.push(code)
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars: string[] = []
    for (let i = 2; i < bytes.length - 1; i += 2) {
      chars.push(String.fromCharCode((bytes[i] << 8) | bytes[i + 1]))
    }
    return chars.join('')
  }

  return Buffer.from(bytes).toString('latin1')
}

export function extrairTextoPDFBasico(buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const chunks: string[] = []

  for (const match of raw.matchAll(/<<(?:.|\n|\r)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const dict = match[0].slice(0, Math.max(0, match[0].indexOf('stream')))
    let stream = match[1]

    if (/\/FlateDecode\b/.test(dict)) {
      try {
        stream = inflateSync(Buffer.from(stream, 'latin1')).toString('latin1')
      } catch {
        continue
      }
    }

    for (const literal of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
      chunks.push(decodePdfLiteral(literal[0].replace(/\s*Tj$/, '').slice(1, -1)))
    }

    for (const arrayText of stream.matchAll(/\[((?:\s*(?:\((?:\\.|[^\\)])*\)|<[^>]+>|-?\d+(?:\.\d+)?))+)\s*\]\s*TJ/g)) {
      const content = arrayText[1]
      for (const literal of content.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        chunks.push(decodePdfLiteral(literal[0].slice(1, -1)))
      }
      for (const hex of content.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
        chunks.push(decodePdfHex(hex[1]))
      }
      chunks.push('\n')
    }
  }

  const fallback = raw
    .replace(/[^\x20-\x7EÀ-ÿ\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')

  return [...chunks, fallback]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extrairDataDEJT(texto: string): string | null {
  const match = texto.match(/Data da disponibiliza[çc][ãa]o:\s*[^,]+,\s*(\d{1,2}) de ([a-zç]+) de (\d{4})/i)
  if (!match) return null

  const meses: Record<string, string> = {
    janeiro: '01',
    fevereiro: '02',
    marco: '03',
    março: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12',
  }
  const mes = meses[match[2].toLowerCase()]
  if (!mes) return null
  return `${match[3]}-${mes}-${match[1].padStart(2, '0')}`
}

function buscarTermosNoTexto(texto: string, termos: string[]): TRT3DEJTPublicacao[] {
  const resultados: TRT3DEJTPublicacao[] = []
  const vistos = new Set<string>()
  const textoNorm = normalizarTermo(texto)
  const data = extrairDataDEJT(texto) ?? hojeSaoPaulo()

  for (const termo of termosUnicos(termos)) {
    const termoNorm = normalizarTermo(termo)
    let pos = 0

    while (pos < textoNorm.length) {
      const idx = textoNorm.indexOf(termoNorm, pos)
      if (idx === -1) break

      const inicio = Math.max(0, idx - JANELA_CONTEXTO)
      const fim = Math.min(texto.length, idx + termoNorm.length + JANELA_CONTEXTO)
      const trecho = texto.slice(inicio, fim).replace(/\s+/g, ' ').trim()
      const numeroProcesso = extrairNumeroProcesso(trecho)
      const chave = [
        numeroProcesso ?? '',
        normalizarTermo(trecho).slice(0, 300),
      ].join('|')

      if (vistos.has(chave)) {
        pos = idx + termoNorm.length
        continue
      }
      vistos.add(chave)

      resultados.push({
        nome_pesquisado: termo,
        termo_encontrado: termo,
        numero_processo: numeroProcesso,
        data_publicacao: data,
        texto_publicacao: trecho.slice(0, 5_000),
        orgao: 'Caderno Judiciário TRT3',
        tribunal: 'TRT3',
        origem: 'trt3_dejt',
      })

      pos = idx + termoNorm.length
    }
  }

  return resultados
}

export async function buscarPublicacoesTRT3DEJT(opcoes: {
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
  pdfBuffer?: Buffer
}): Promise<TRT3DEJTPublicacao[]> {
  const termos = termosUnicos([
    ...opcoes.nomes,
    ...(opcoes.processos ?? []),
    ...montarTermosOAB(opcoes.oabs ?? []),
    'Pessoa e do Val Advocacia',
    'PESSOA E DO VAL ADVOCACIA',
  ])
  if (termos.length === 0) return []

  const buffer = opcoes.pdfBuffer ?? await fetchDEJT()
  const texto = extrairTextoPDFBasico(buffer)
  if (!texto) throw new Error('Não foi possível extrair texto do caderno DEJT TRT3.')

  const dataDEJT = extrairDataDEJT(texto)
  if (opcoes.data && dataDEJT && opcoes.data !== dataDEJT) {
    return []
  }

  return buscarTermosNoTexto(texto, termos)
}
