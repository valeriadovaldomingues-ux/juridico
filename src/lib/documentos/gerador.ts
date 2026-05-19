import { modeloContratoPartido } from './modelos/contrato-partido'
import { modeloContratoAcaoIsolada } from './modelos/contrato-acao-isolada'
import { modeloProcuracao } from './modelos/procuracao'
import { modeloHipossuficiencia } from './modelos/hipossuficiencia'
import { modeloPeticaoComum } from './modelos/peticao-comum'
import {
  normalizarDadosDocumento,
  tipoDocumentoValido,
  tituloTipoDocumento,
  type DadosDocumento,
  type TipoDocumentoGerador,
} from './schema'

interface ArquivoZip {
  path: string
  data: Buffer
}

const FOLHA_PADRAO_2026 = {
  referenciaVisual: '/documentos/folha-padrao-2026.jpeg',
  azul: '1B2A4E',
  cobre: 'B8864B',
  cinzaTexto: '2F3440',
  fonteTitulo: 'Cormorant Garamond',
  fonteCorpo: 'Montserrat',
  margemSuperior: 1440,
  margemLateral: 1417,
  margemInferior: 1134,
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, date: dosDate }
}

function criarZip(files: ArquivoZip[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  const dt = dosDateTime()

  for (const file of files) {
    const name = Buffer.from(file.path)
    const data = file.data
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(dt.time, 10)
    local.writeUInt16LE(dt.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(dt.time, 12)
    central.writeUInt16LE(dt.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)

    offset += local.length + name.length + data.length
  }

  const centralStart = offset
  const centralBuffer = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralBuffer, end])
}

function esc(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function paragraph(text: string, opts?: {
  bold?: boolean
  color?: string
  size?: number
  align?: 'left' | 'center' | 'right' | 'both'
  font?: string
  before?: number
  after?: number
  line?: number
  indentLeft?: number
  firstLine?: number
}) {
  const props = [
    opts?.align ? `<w:jc w:val="${opts.align}"/>` : '',
    opts?.before || opts?.after || opts?.line
      ? `<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 160}" w:line="${opts.line ?? 360}" w:lineRule="auto"/>`
      : '',
    opts?.indentLeft || opts?.firstLine
      ? `<w:ind w:left="${opts.indentLeft ?? 0}" w:firstLine="${opts.firstLine ?? 0}"/>`
      : '',
  ].join('')
  const runProps = [
    `<w:rFonts w:ascii="${opts?.font ?? FOLHA_PADRAO_2026.fonteCorpo}" w:hAnsi="${opts?.font ?? FOLHA_PADRAO_2026.fonteCorpo}"/>`,
    opts?.bold ? '<w:b/>' : '',
    opts?.color ? `<w:color w:val="${opts.color}"/>` : `<w:color w:val="${FOLHA_PADRAO_2026.cinzaTexto}"/>`,
    opts?.size ? `<w:sz w:val="${opts.size}"/>` : '',
  ].join('')

  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}<w:r>${runProps ? `<w:rPr>${runProps}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
}

function linhasDocumento(dados: DadosDocumento): string[] {
  if (dados.tipoDocumento === 'contrato_partido') return modeloContratoPartido(dados)
  if (dados.tipoDocumento === 'contrato_acao_isolada') return modeloContratoAcaoIsolada(dados)
  if (dados.tipoDocumento === 'procuracao') return modeloProcuracao(dados)
  if (dados.tipoDocumento === 'hipossuficiencia') return modeloHipossuficiencia(dados)
  return modeloPeticaoComum(dados)
}

function linhaDecorativa() {
  return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="B8864B"/></w:pBdr><w:spacing w:after="220"/></w:pPr></w:p>'
}

function isHeadingPeticao(texto: string) {
  return [
    'DA GRATUIDADE DA JUSTIÇA',
    'DOS FATOS',
    'DO DIREITO',
    'DOS PEDIDOS',
  ].includes(texto)
}

function renderLinhaDocumento(dados: DadosDocumento, linha: string, index: number) {
  if (!linha) return paragraph('', { after: 100, line: 320 })

  if (dados.tipoDocumento === 'peticao_comum') {
    if (index === 0) {
      return paragraph(linha, {
        font: FOLHA_PADRAO_2026.fonteCorpo,
        bold: true,
        size: 22,
        color: FOLHA_PADRAO_2026.azul,
        align: 'both',
        after: 420,
        line: 360,
      })
    }
    if (linha === 'URGENTE') {
      return paragraph(linha, {
        font: FOLHA_PADRAO_2026.fonteCorpo,
        bold: true,
        size: 24,
        color: 'B00020',
        align: 'center',
        before: 120,
        after: 260,
      })
    }
    if (linha === linha.toUpperCase() && linha.length > 8 && !linha.startsWith('EXMO.')) {
      return paragraph(linha, {
        font: FOLHA_PADRAO_2026.fonteTitulo,
        bold: true,
        size: isHeadingPeticao(linha) ? 26 : 30,
        color: FOLHA_PADRAO_2026.azul,
        align: 'center',
        before: 260,
        after: 220,
      })
    }
    if (linha === 'Nestes Termos,' || linha === 'Pede Deferimento.' || linha.startsWith('Belo Horizonte')) {
      return paragraph(linha, {
        font: FOLHA_PADRAO_2026.fonteCorpo,
        size: 22,
        color: FOLHA_PADRAO_2026.cinzaTexto,
        align: 'center',
        after: 120,
      })
    }
    if (linha.includes('OAB/MG')) {
      return paragraph(linha, {
        font: FOLHA_PADRAO_2026.fonteTitulo,
        bold: true,
        size: 24,
        color: FOLHA_PADRAO_2026.azul,
        align: 'center',
        before: 120,
        after: 80,
      })
    }
    return paragraph(linha, {
      font: FOLHA_PADRAO_2026.fonteCorpo,
      size: 22,
      color: FOLHA_PADRAO_2026.cinzaTexto,
      align: 'both',
      line: 360,
      after: 180,
      firstLine: 708,
    })
  }

  const isHeading = linha && index > 0 && !linha.includes(':') && linha.length < 80
  return paragraph(linha, isHeading
    ? { bold: true, color: FOLHA_PADRAO_2026.azul, size: 26, font: FOLHA_PADRAO_2026.fonteTitulo, before: 220, after: 120 }
    : { size: 22, font: FOLHA_PADRAO_2026.fonteCorpo, line: 360, after: 160 })
}

function documentXml(dados: DadosDocumento) {
  const linhas = linhasDocumento(dados)
  const body = [
    paragraph(tituloTipoDocumento(dados.tipoDocumento).toUpperCase(), {
      bold: true,
      color: FOLHA_PADRAO_2026.azul,
      size: 32,
      align: 'center',
      font: FOLHA_PADRAO_2026.fonteTitulo,
      after: 140,
    }),
    linhaDecorativa(),
    ...linhas.map((linha, index) => renderLinhaDocumento(dados, linha, index)),
    `<w:sectPr><w:headerReference w:type="default" r:id="rHeader"/><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${FOLHA_PADRAO_2026.margemSuperior}" w:right="${FOLHA_PADRAO_2026.margemLateral}" w:bottom="${FOLHA_PADRAO_2026.margemInferior}" w:left="${FOLHA_PADRAO_2026.margemLateral}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`,
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`
}

function headerXml() {
  const content = [
    paragraph('P&V', { font: FOLHA_PADRAO_2026.fonteTitulo, bold: true, size: 34, color: FOLHA_PADRAO_2026.azul, align: 'center', after: 0 }),
    paragraph('PESSOA E DO VAL', { font: FOLHA_PADRAO_2026.fonteTitulo, bold: true, size: 24, color: FOLHA_PADRAO_2026.azul, align: 'center', after: 0 }),
    paragraph('ADVOCACIA EMPRESARIAL', { font: FOLHA_PADRAO_2026.fonteCorpo, bold: true, size: 14, color: FOLHA_PADRAO_2026.cobre, align: 'center', after: 80 }),
    linhaDecorativa(),
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${content}</w:hdr>`
}

function footerXml() {
  const content = [
    linhaDecorativa(),
    paragraph('Pessoa e do Val Advocacia', { font: FOLHA_PADRAO_2026.fonteTitulo, bold: true, size: 18, color: FOLHA_PADRAO_2026.azul, align: 'center', after: 0 }),
    paragraph('Documento gerado internamente para revisão humana obrigatória.', { font: FOLHA_PADRAO_2026.fonteCorpo, size: 14, color: FOLHA_PADRAO_2026.cobre, align: 'center', after: 0 }),
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${content}</w:ftr>`
}

function coreXml() {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Documento Pessoa e do Val Advocacia</dc:title><dc:creator>Pessoa e do Val Advocacia</dc:creator><cp:lastModifiedBy>Pessoa e do Val Advocacia</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Pessoa e do Val Advocacia</Application></Properties>`
}

export function gerarDocumentoDocx(input: unknown, tipoPadrao?: TipoDocumentoGerador): Buffer {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const tipo = tipoDocumentoValido(String(raw.tipoDocumento ?? '')) ? String(raw.tipoDocumento) as TipoDocumentoGerador : tipoPadrao ?? 'contrato_partido'
  const dados = normalizarDadosDocumento(input, tipo)
  const files: ArquivoZip[] = [
    { path: '[Content_Types].xml', data: Buffer.from(contentTypesXml()) },
    { path: '_rels/.rels', data: Buffer.from(relsXml()) },
    { path: 'word/_rels/document.xml.rels', data: Buffer.from(documentRelsXml()) },
    { path: 'word/document.xml', data: Buffer.from(documentXml(dados)) },
    { path: 'word/header1.xml', data: Buffer.from(headerXml()) },
    { path: 'word/footer1.xml', data: Buffer.from(footerXml()) },
    { path: 'docProps/core.xml', data: Buffer.from(coreXml()) },
    { path: 'docProps/app.xml', data: Buffer.from(appXml()) },
  ]
  return criarZip(files)
}

export function nomeArquivoDocumento(dados: DadosDocumento) {
  const base = tituloTipoDocumento(dados.tipoDocumento)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${base || 'documento'}-pedv.docx`
}
