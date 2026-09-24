// ─── Cliente da RPI (Revista da Propriedade Industrial) do INPI ──────────────
//
// O INPI publica toda semana um XML público com o conteúdo da RPI de marcas,
// pensado para consumo por aplicativo (o próprio site diz: "para uso através
// de aplicativos"). Não há login, captcha nem API oficial — é um arquivo
// estático baixado direto. Ver memória de projeto "juridico-modulo-inpi-pendente".
//
// Formato confirmado em 22/09/2026 (edição 2907):
//   https://revistas.inpi.gov.br/txt/RM{numero}.zip  → contém RM{numero}.xml
//   <revista numero="2907" data="22/09/2026">
//     <processo numero="906428203">
//       <despachos>
//         <despacho codigo="IPAS158" nome="Concessão de registro"/>
//       </despachos>
//       ...
//     </processo>
//   </revista>

import sax from 'sax'
import { unzipSync } from 'fflate'

const INDEX_URL = 'https://revistas.inpi.gov.br/rpi/'
const RM_ZIP_URL = (numero: number) => `https://revistas.inpi.gov.br/txt/RM${numero}.zip`

export interface DespachoRpi {
  codigo: string | null
  descricao: string
}

export interface EdicaoRpiProcessada {
  rpiNumero: number
  rpiData: string // ISO yyyy-mm-dd
  /** numero_processo → despachos daquele processo nesta edição */
  movimentacoesPorProcesso: Map<string, DespachoRpi[]>
}

/** Descobre a última edição publicada, lendo os links RM{n}.zip da página
 *  índice — usado só como "teto" pra não ficar tentando edições futuras
 *  indefinidamente, e para o bootstrap inicial (sem estado salvo ainda). */
export async function descobrirUltimaEdicaoDisponivel(): Promise<number> {
  const res = await fetch(INDEX_URL, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Falha ao consultar índice da RPI: HTTP ${res.status}`)
  const html = await res.text()
  const numeros = [...html.matchAll(/RM(\d+)\.zip/g)].map(m => Number(m[1]))
  if (numeros.length === 0) throw new Error('Índice da RPI não retornou nenhuma edição.')
  return Math.max(...numeros)
}

/** Baixa o zip de uma edição da RPI (marcas). Lança se não existir (404) ou
 *  em qualquer outro erro de rede. */
async function baixarZipEdicao(numero: number): Promise<Buffer> {
  const res = await fetch(RM_ZIP_URL(numero), { signal: AbortSignal.timeout(60_000) })
  if (res.status === 404) throw new EdicaoInexistenteError(numero)
  if (!res.ok) throw new Error(`Falha ao baixar RPI ${numero}: HTTP ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export class EdicaoInexistenteError extends Error {
  constructor(public numero: number) {
    super(`Edição ${numero} da RPI ainda não publicada.`)
  }
}

/** Baixa e faz parse em streaming (o XML de uma edição passa de 50MB — nunca
 *  carregar em memória como DOM) de uma edição da RPI, retornando só as
 *  movimentações dos processos presentes em `numerosRastreados`. */
export async function processarEdicaoRpiMarcas(
  numero: number,
  numerosRastreados: Set<string>,
): Promise<EdicaoRpiProcessada> {
  const zipBuffer = await baixarZipEdicao(numero)

  // unzipSync decodifica tudo em memória — o XML descompactado passa de
  // 50MB, mas isso ainda cabe folgado no limite de memória de uma função
  // serverless. Evita depender de 'unzipper' (que puxa @aws-sdk/client-s3
  // como dependência opcional e quebra o build do Next/Turbopack).
  const unzipped = unzipSync(zipBuffer)
  const xmlPath = Object.keys(unzipped).find(p => p.toLowerCase().endsWith('.xml'))
  if (!xmlPath) throw new Error(`Edição ${numero} da RPI: zip não contém XML.`)
  const xml = Buffer.from(unzipped[xmlPath]).toString('utf-8')

  const movimentacoesPorProcesso = new Map<string, DespachoRpi[]>()
  let rpiData = ''

  const parser = sax.parser(true, { trim: true })

  let dentroDeProcesso = false
  let numeroProcessoAtual: string | null = null
  let despachosAtual: DespachoRpi[] = []

  parser.onopentag = (node) => {
    if (node.name === 'revista' && !rpiData) {
      const [dd, mm, yyyy] = String(node.attributes.data ?? '').split('/')
      if (dd && mm && yyyy) rpiData = `${yyyy}-${mm}-${dd}`
      return
    }
    if (node.name === 'processo') {
      dentroDeProcesso = true
      numeroProcessoAtual = String(node.attributes.numero ?? '')
      despachosAtual = []
      return
    }
    if (dentroDeProcesso && node.name === 'despacho') {
      despachosAtual.push({
        codigo: (node.attributes.codigo as string) || null,
        descricao: String(node.attributes.nome ?? '').trim(),
      })
    }
  }

  parser.onclosetag = (name) => {
    if (name !== 'processo' || !dentroDeProcesso) return
    dentroDeProcesso = false
    if (numeroProcessoAtual && numerosRastreados.has(numeroProcessoAtual) && despachosAtual.length > 0) {
      movimentacoesPorProcesso.set(numeroProcessoAtual, despachosAtual)
    }
    numeroProcessoAtual = null
    despachosAtual = []
  }

  let erroParse: Error | null = null
  parser.onerror = (e) => { erroParse = e }

  parser.write(xml).close()
  if (erroParse) throw erroParse

  if (!rpiData) throw new Error(`Edição ${numero} da RPI: não achei a data da edição no XML.`)

  return { rpiNumero: numero, rpiData, movimentacoesPorProcesso }
}
