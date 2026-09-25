import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { dataAssinaturaExtenso, formatarValorBRL, mesReferenciaLabel, periodoBeneficio, valorPorExtenso } from './extenso'

export interface DadosPessoais {
  nomeCompleto:  string
  nacionalidade: string | null
  estadoCivil:   string | null
  cpf:           string | null
  rg:            string | null
  oabNumero:     string | null
  oabSecao:      string | null
  endereco:      string | null
}

const ESCRITORIO =
  'PESSOA E DO VAL ADVOCACIA, sociedade de advogados devidamente registrada na Ordem dos Advogados do Brasil – OAB, ' +
  'Seção do Estado de Minas Gerais, sob o nº 2.422, com escritório à rua Gonçalves Dias, nº 874, 8º andar, ' +
  'bairro Savassi – Belo Horizonte/MG'

// RG só aparece nos recibos de advogado(a) — os demais modelos (funcionário,
// estagiário, benefício) só citam CPF, mesmo quando o RG está cadastrado.
function qualificacao(d: DadosPessoais, { comOab }: { comOab: boolean }): string {
  const partes = [
    d.nacionalidade ?? 'brasileiro(a)',
    d.estadoCivil ?? '',
  ].filter(Boolean)

  if (comOab && d.oabNumero) {
    partes.push(`advogado(a) devidamente inscrito(a) na Ordem dos Advogados do Brasil, Seção Minas Gerais, sob o nº ${d.oabNumero}`)
  }
  if (d.cpf) partes.push(`portador(a) do CPF/MF nº ${d.cpf}`)
  if (comOab && d.rg) partes.push(`da Carteira de Identidade nº ${d.rg}`)
  if (d.endereco) partes.push(`residente e domiciliado(a) à ${d.endereco}`)

  return partes.join(', ')
}

// ─── Corpo de cada tipo de recibo ─────────────────────────────────────────────

/** Advogado(a) Associado(a): um recibo com o valor total da folha. */
export function corpoReciboAdvogado(d: DadosPessoais, valor: number, mesReferencia: string): string {
  const mes = mesReferenciaLabel(mesReferencia)
  return `Eu, ${d.nomeCompleto}, ${qualificacao(d, { comOab: true })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente às verbas descritas na cláusula ` +
    `oitava do Contrato de Associação de Advogado, quanto aos serviços prestados, na forma da cláusula sexta do mesmo ` +
    `instrumento, no mês de ${mes}/${mesReferencia.slice(0, 4)}.`
}

/** Funcionário/colaborador (recibo único, valor total) — Célio, Luciana e afins. */
export function corpoReciboFuncionario(d: DadosPessoais, valor: number, mesReferencia: string): string {
  const mes = mesReferenciaLabel(mesReferencia)
  return `Eu, ${d.nomeCompleto}, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente ao mês de ${mes} de ${mesReferencia.slice(0, 4)}.`
}

/** Bolsa de estágio. */
export function corpoReciboEstagiario(d: DadosPessoais, valor: number, mesReferencia: string): string {
  const mes = mesReferenciaLabel(mesReferencia)
  const { inicio, fim } = periodoBeneficio(mesReferencia)
  return `Eu, ${d.nomeCompleto}, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente a bolsa de estágio, quanto aos ` +
    `serviços prestados no mês de ${mes}, durante o período de ${inicio.replaceAll('.', '/')} a ${fim.replaceAll('.', '/')}, exceto período de férias.`
}

export type TipoBeneficio = 'transporte' | 'alimentacao'

/** Recibo de benefício avulso (transporte / auxílio alimentação) — padrão usado pra Luana. */
export function corpoReciboBeneficio(d: DadosPessoais, valor: number, mesReferencia: string, tipo: TipoBeneficio): string {
  const { inicio, fim } = periodoBeneficio(mesReferencia)
  const descricao = tipo === 'transporte' ? 'transporte' : 'auxílio alimentação'
  return `Eu, ${d.nomeCompleto}, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente ao ${descricao} no período de ${inicio} a ${fim}.`
}

// ─── Geração do PDF ───────────────────────────────────────────────────────────

function wrapText(text: string, fontSize: number, maxWidth: number, charWidthRatio = 0.5) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  const measure = (value: string) => value.length * fontSize * charWidthRatio

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next) <= maxWidth) { current = next; continue }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

export async function gerarReciboPdfBytes(params: {
  corpo:           string
  nomeAssinante:   string
  mesReferencia:   string
}) {
  const { corpo, nomeAssinante, mesReferencia } = params

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 70
  const contentWidth = pageWidth - margin * 2
  const lineHeight = 18

  const page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - 100

  // Título espaçado: "R E C I B O"
  const titulo = 'RECIBO'.split('').join(' ')
  const tituloWidth = fontBold.widthOfTextAtSize(titulo, 16)
  page.drawText(titulo, { x: (pageWidth - tituloWidth) / 2, y, size: 16, font: fontBold, color: rgb(0, 0, 0) })
  y -= 48

  const lines = wrapText(corpo, 12, contentWidth)
  lines.forEach(line => {
    page.drawText(line, { x: margin, y, size: 12, font, color: rgb(0, 0, 0) })
    y -= lineHeight
  })

  y -= 40
  page.drawText(`Belo Horizonte, ${dataAssinaturaExtenso(mesReferencia)}`, { x: margin, y, size: 12, font })
  y -= 60
  const linha = '_'.repeat(58)
  page.drawText(linha, { x: margin, y, size: 12, font })
  y -= 16
  const nomeWidth = font.widthOfTextAtSize(nomeAssinante.toUpperCase(), 12)
  page.drawText(nomeAssinante.toUpperCase(), { x: margin + (font.widthOfTextAtSize(linha, 12) - nomeWidth) / 2, y, size: 12, font })

  return pdf.save()
}
