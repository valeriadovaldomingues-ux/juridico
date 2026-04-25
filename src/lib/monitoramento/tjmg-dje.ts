// ─── Integração com o Diário do Judiciário Eletrônico do TJMG (versão HTML) ───
//
// Fonte: https://www8.tjmg.jus.br/juridico/diario/
// Método: GET index.jsp?dia=DDMM&completa=tipo|codigo
//
// Cadernos disponíveis:
//   2inst|jud  → 2ª Instância Judicial       (retorna link para ZIP com RTF)
//   2inst|adm  → 2ª Instância Administrativa (retorna HTML inline)
//   capital|j1 → 1ª Instância Belo Horizonte (retorna link para ZIP com RTF)
//   interior|NNNN → Comarcas do interior     (retorna HTML inline)
//
// Para cadernos grandes (BH e 2ª inst.), o servidor retorna um link de download
// para um arquivo ZIP contendo um RTF. Este módulo faz o download, extrai o RTF
// sem bibliotecas externas (usando apenas zlib nativo do Node.js) e busca os
// nomes dos advogados monitorados no texto extraído.

import { inflateRaw } from 'zlib'
import { promisify } from 'util'

const inflateRawAsync = promisify(inflateRaw)

const BASE_WWW8 = 'https://www8.tjmg.jus.br/juridico/diario'

// Regex CNJ: 0000000-00.0000.0.00.0000
export const REGEX_PROCESSO_CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/

export function extrairNumeroProcesso(texto: string): string | null {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  const match = limpo.match(REGEX_PROCESSO_CNJ)
  return match ? match[0] : null
}

// Janela de contexto extraída em volta de cada ocorrência do nome (caracteres)
const JANELA_CONTEXTO = 600

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TJMGPublicacao {
  nome_pesquisado:  string
  numero_processo:  string
  data_publicacao:  string  // YYYY-MM-DD
  texto_publicacao: string
  orgao:            string
  tribunal:         'TJMG'
  origem:           'dje_tjmg'
}

interface Caderno {
  completa: string
  orgao:    string
}

const CADERNOS: Caderno[] = [
  { completa: '2inst|jud',  orgao: '2ª Instância Judicial TJMG'       },
  { completa: '2inst|adm',  orgao: '2ª Instância Administrativa TJMG' },
  { completa: 'capital|j1', orgao: '1ª Instância – Belo Horizonte'    },
]

// ─── HTTP helper com timeout ──────────────────────────────────────────────────

async function fetchDJE(url: string, timeoutMs = 20_000): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; monitoramento-juridico/1.0)',
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer':         'https://www8.tjmg.jus.br/juridico/diario/',
      },
    })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// ─── Passo 1: buscar datas disponíveis ────────────────────────────────────────

interface DataDisponivel {
  valor: string  // "DDMM", ex: "2703"
  data:  string  // "DD/MM/AAAA", ex: "27/03/2026"
}

export async function obterDatasDisponiveis(): Promise<DataDisponivel[]> {
  try {
    const res = await fetchDJE(`${BASE_WWW8}/index.jsp`)
    if (!res.ok) return []
    const html = await res.text()

    // <option value="2703">27/03/2026 - Sexta</option>
    const matches = [...html.matchAll(/<option value="(\d{4})">(\d{2}\/\d{2}\/\d{4})/g)]
    return matches.map(m => ({ valor: m[1], data: m[2] }))
  } catch {
    return []
  }
}

// ─── Passo 2: buscar caderno (inline HTML ou link de download) ───────────────

interface ResultadoCaderno {
  inline:      string | null
  downloadUrl: string | null
}

async function fetchCaderno(dia: string, completa: string): Promise<ResultadoCaderno> {
  const url = `${BASE_WWW8}/index.jsp?dia=${encodeURIComponent(dia)}&completa=${encodeURIComponent(completa)}`
  try {
    const res = await fetchDJE(url, 20_000)
    if (!res.ok) return { inline: null, downloadUrl: null }
    const html = await res.text()

    // Verifica se é uma página com link de download ZIP
    // ex: href="download/2703tjmg02.zip"
    const m = html.match(/href="(download\/[^"]+\.zip)"/i)
    if (m) {
      return { inline: null, downloadUrl: `${BASE_WWW8}/${m[1]}` }
    }

    return { inline: html, downloadUrl: null }
  } catch {
    return { inline: null, downloadUrl: null }
  }
}

// ─── Passo 3: download e extração do ZIP ─────────────────────────────────────
//
// Implementação mínima do formato ZIP (RFC 1950/1951) usando apenas zlib nativo.
// Estrutura do Local File Header:
//   Offset  Tamanho  Campo
//   0       4        Assinatura (PK\x03\x04 = 0x504B0304)
//   8       2        Método de compressão (0=stored, 8=deflate)
//   18      4        Tamanho comprimido
//   26      2        Comprimento do nome do arquivo
//   28      2        Comprimento do campo extra
//   30+N+M  -        Dados comprimidos

async function downloadEExtrairZip(url: string): Promise<string | null> {
  try {
    const res = await fetchDJE(url, 40_000)
    if (!res.ok) return null

    const arrayBuffer = await res.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)

    // Localiza a assinatura PK\x03\x04
    let sigPos = -1
    for (let i = 0; i < buf.length - 4; i++) {
      if (buf[i] === 0x50 && buf[i+1] === 0x4B && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
        sigPos = i
        break
      }
    }
    if (sigPos === -1) return null

    const method          = buf.readUInt16LE(sigPos + 8)
    const compressedSize  = buf.readUInt32LE(sigPos + 18)
    const fileNameLen     = buf.readUInt16LE(sigPos + 26)
    const extraLen        = buf.readUInt16LE(sigPos + 28)
    const dataStart       = sigPos + 30 + fileNameLen + extraLen

    if (dataStart + compressedSize > buf.length) return null

    const compressedData = buf.subarray(dataStart, dataStart + compressedSize)

    let content: Buffer
    if (method === 0) {
      content = compressedData
    } else if (method === 8) {
      content = await inflateRawAsync(compressedData)
    } else {
      return null // método não suportado
    }

    // RTF usa encoding Windows-1252; lemos como latin1 (superset de ASCII)
    // e tratamos os escapes \'XX diretamente na fase de extração de texto
    return content.toString('latin1')
  } catch {
    return null
  }
}

// ─── Passo 4: extração de texto do RTF ───────────────────────────────────────
//
// RTF usa \'XX para caracteres Windows-1252 acima de ASCII.
// Convertemos os escapes mais frequentes para UTF-8 e depois
// removemos as palavras de controle RTF.

const WIN1252: Record<number, string> = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D', 0x96: '\u2013', 0x97: '\u2014',
  0xc0: 'À', 0xc1: 'Á', 0xc2: 'Â', 0xc3: 'Ã', 0xc7: 'Ç',
  0xc8: 'È', 0xc9: 'É', 0xca: 'Ê', 0xcd: 'Í',
  0xd3: 'Ó', 0xd4: 'Ô', 0xd5: 'Õ', 0xda: 'Ú', 0xdc: 'Ü',
  0xe0: 'à', 0xe1: 'á', 0xe2: 'â', 0xe3: 'ã', 0xe7: 'ç',
  0xe8: 'è', 0xe9: 'é', 0xea: 'ê', 0xeb: 'ë', 0xed: 'í',
  0xf3: 'ó', 0xf4: 'ô', 0xf5: 'õ', 0xfa: 'ú', 0xfc: 'ü',
}

export function extrairTextoRTF(rtf: string): string {
  // 1. Decodifica escapes \'XX (Windows-1252)
  let text = rtf.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16)
    return WIN1252[code] ?? (code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : '')
  })

  // 2. Remove grupos destinatários especiais que não têm texto visível:
  //    {\*\...} e {\fonttbl}, {\colortbl}, {\stylesheet} etc.
  text = text.replace(/\{\\[*]?\\[a-z]+[^}]*\}/g, '')

  // 3. Substitui \par, \line, \tab por espaço/newline
  text = text.replace(/\\par[d]?\b/gi, '\n')
  text = text.replace(/\\line\b/gi, '\n')
  text = text.replace(/\\tab\b/gi, '\t')

  // 4. Remove todas as palavras de controle RTF restantes (\word ou \word0)
  text = text.replace(/\\[a-zA-Z]+[-]?\d*\s?/g, ' ')

  // 5. Remove colchetes e barras soltas
  text = text.replace(/[{}\\]/g, ' ')

  // 6. Normaliza espaços
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

// ─── Passo 5: extração de texto do HTML inline ───────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&amp;':   '&',  '&lt;':    '<',  '&gt;':    '>',  '&quot;':  '"',
  '&nbsp;':  ' ',  '&ordf;':  'ª',  '&ordm;':  'º',  '&deg;':   '°',
  '&aacute;':'á',  '&eacute;':'é',  '&iacute;':'í',  '&oacute;':'ó',
  '&uacute;':'ú',  '&acirc;': 'â',  '&ecirc;': 'ê',  '&ocirc;': 'ô',
  '&atilde;':'ã',  '&otilde;':'õ',  '&ccedil;':'ç',
  '&Aacute;':'Á',  '&Eacute;':'É',  '&Iacute;':'Í',  '&Oacute;':'Ó',
  '&Uacute;':'Ú',  '&Acirc;': 'Â',  '&Ecirc;': 'Ê',  '&Ocirc;': 'Ô',
  '&Atilde;':'Ã',  '&Otilde;':'Õ',  '&Ccedil;':'Ç',
}

export function extrairTextoHTML(html: string): string {
  // Remove scripts e estilos
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')

  // Elementos de bloco → quebra de linha
  text = text.replace(/<(?:p|br|div|tr|li|h[1-6])[^>]*>/gi, '\n')
  text = text.replace(/<td[^>]*>/gi, ' ')

  // Remove todas as tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decodifica entidades HTML
  text = text.replace(/&[a-zA-Z]+;/g, e => HTML_ENTITIES[e] ?? e)
  // Decodifica entidades numéricas &#NN;
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))

  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// ─── Passo 6: busca de nomes e extração de contexto ──────────────────────────

interface Ocorrencia {
  nome:           string
  trecho:         string
  numeroProcesso: string | null
}

function buscarNomesNoTexto(texto: string, nomes: string[]): Ocorrencia[] {
  const resultados: Ocorrencia[] = []
  const textoNorm = texto.toUpperCase()

  for (const nome of nomes) {
    const nomeNorm = nome.toUpperCase()
    let pos = 0

    while (pos < textoNorm.length) {
      const idx = textoNorm.indexOf(nomeNorm, pos)
      if (idx === -1) break

      const inicio = Math.max(0, idx - JANELA_CONTEXTO)
      const fim    = Math.min(texto.length, idx + nomeNorm.length + JANELA_CONTEXTO)
      const trecho = texto.slice(inicio, fim).replace(/\s+/g, ' ').trim()

      resultados.push({
        nome,
        trecho,
        numeroProcesso: extrairNumeroProcesso(trecho),
      })

      // Avança para evitar sobreposição — mas não mais que 1000 chars
      pos = idx + nomeNorm.length
    }
  }

  return resultados
}

// ─── Geração de hash para deduplicação ───────────────────────────────────────

export function gerarHashDJE(
  data:   string,
  nome:   string,
  proc:   string,
  trecho: string,
): string {
  const raw = `dje_tjmg|${data}|${nome.slice(0, 40).toUpperCase()}|${proc}|${trecho.slice(0, 80).toUpperCase()}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i), h = h >>> 0
  return `dje_${h.toString(16).padStart(8, '0')}`
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function buscarPublicacoesTJMG(
  nomes: string[],
): Promise<TJMGPublicacao[]> {
  if (nomes.length === 0) return []

  // 1. Obtém as datas disponíveis no DJe
  const datas = await obterDatasDisponiveis()
  if (datas.length === 0) {
    console.warn('[TJMG-DJe] Nenhuma data disponível — site indisponível?')
    return []
  }

  // Usa a edição mais recente (primeiro item do dropdown)
  const { valor: dia, data: dataStr } = datas[0]
  const [d, m, y] = dataStr.split('/')
  const dataISO = `${y}-${m}-${d}`

  console.log(`[TJMG-DJe] Buscando edição ${dataStr} (dia=${dia}) para ${nomes.length} nome(s)`)

  const publicacoes: TJMGPublicacao[] = []

  for (const caderno of CADERNOS) {
    try {
      const { inline, downloadUrl } = await fetchCaderno(dia, caderno.completa)

      let texto: string | null = null

      if (inline) {
        texto = extrairTextoHTML(inline)
        console.log(`[TJMG-DJe] ${caderno.orgao}: HTML inline (${texto.length} chars)`)
      } else if (downloadUrl) {
        console.log(`[TJMG-DJe] ${caderno.orgao}: baixando ZIP em ${downloadUrl}`)
        const rtf = await downloadEExtrairZip(downloadUrl)
        if (rtf) {
          texto = extrairTextoRTF(rtf)
          console.log(`[TJMG-DJe] ${caderno.orgao}: RTF extraído (${texto.length} chars)`)
        } else {
          console.warn(`[TJMG-DJe] ${caderno.orgao}: falha ao extrair ZIP`)
        }
      }

      if (!texto) {
        await new Promise(r => setTimeout(r, 300))
        continue
      }

      const ocorrencias = buscarNomesNoTexto(texto, nomes)
      console.log(`[TJMG-DJe] ${caderno.orgao}: ${ocorrencias.length} ocorrência(s) encontrada(s)`)

      for (const oc of ocorrencias) {
        publicacoes.push({
          nome_pesquisado:  oc.nome,
          numero_processo:  oc.numeroProcesso ?? '',
          data_publicacao:  dataISO,
          texto_publicacao: oc.trecho.slice(0, 5_000),
          orgao:            caderno.orgao,
          tribunal:         'TJMG',
          origem:           'dje_tjmg',
        })
      }

      // Rate limit entre cadernos
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.warn(`[TJMG-DJe] Erro no caderno ${caderno.completa}:`, err)
    }
  }

  return publicacoes
}
