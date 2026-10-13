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

// "**texto**" = negrito no recibo (nome do escritório e de quem assina).
const ESCRITORIO =
  '**PESSOA E DO VAL ADVOCACIA**, sociedade de advogados devidamente registrada na Ordem dos Advogados do Brasil – OAB, ' +
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
  return `Eu, **${d.nomeCompleto}**, ${qualificacao(d, { comOab: true })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente às verbas descritas na cláusula ` +
    `oitava do Contrato de Associação de Advogado, quanto aos serviços prestados, na forma da cláusula sexta do mesmo ` +
    `instrumento, no mês de ${mes}/${mesReferencia.slice(0, 4)}.`
}

/** Funcionário/colaborador (recibo único, valor total) — Célio, Luciana e afins. */
export function corpoReciboFuncionario(d: DadosPessoais, valor: number, mesReferencia: string): string {
  const mes = mesReferenciaLabel(mesReferencia)
  return `Eu, **${d.nomeCompleto}**, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente ao mês de ${mes} de ${mesReferencia.slice(0, 4)}.`
}

/** Bolsa de estágio. */
export function corpoReciboEstagiario(d: DadosPessoais, valor: number, mesReferencia: string): string {
  const mes = mesReferenciaLabel(mesReferencia)
  const { inicio, fim } = periodoBeneficio(mesReferencia)
  return `Eu, **${d.nomeCompleto}**, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente a bolsa de estágio, quanto aos ` +
    `serviços prestados no mês de ${mes}, durante o período de ${inicio.replaceAll('.', '/')} a ${fim.replaceAll('.', '/')}, exceto período de férias.`
}

/**
 * Recibo de SALÁRIO (CLT com benefícios pagos à parte, como a Luana): só a parte do salário —
 * transporte e alimentação saem em recibos próprios. `comVerbas` = há extra/gratificação/1/3 de férias no valor.
 */
export function corpoReciboSalario(d: DadosPessoais, valor: number, mesReferencia: string, comVerbas = false): string {
  const mes = mesReferenciaLabel(mesReferencia)
  const o = comVerbas ? 'ao salário e demais verbas' : 'ao salário'
  return `Eu, **${d.nomeCompleto}**, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente ${o} do mês de ${mes} de ${mesReferencia.slice(0, 4)}.`
}

export type TipoBeneficio = 'transporte' | 'alimentacao'

/** Recibo de benefício avulso (transporte / auxílio alimentação) — padrão usado pra Luana. */
export function corpoReciboBeneficio(d: DadosPessoais, valor: number, mesReferencia: string, tipo: TipoBeneficio): string {
  const { inicio, fim } = periodoBeneficio(mesReferencia)
  const descricao = tipo === 'transporte' ? 'transporte' : 'auxílio alimentação'
  return `Eu, **${d.nomeCompleto}**, ${qualificacao(d, { comOab: false })}, recebi de ${ESCRITORIO}, ` +
    `a importância de ${formatarValorBRL(valor)} (${valorPorExtenso(valor)}), referente ao ${descricao} no período de ${inicio} a ${fim}.`
}

// ─── Geração do PDF ───────────────────────────────────────────────────────────

export interface PalavraRecibo { texto: string; negrito: boolean }

/** Uma "palavra" na linha pode juntar pedaços sem espaço entre eles (ex.: nome em negrito + vírgula normal). */
export type UnidadeRecibo = PalavraRecibo[]

/** Divide o texto em unidades, respeitando os trechos entre "**" (negrito). Pontuação colada ao negrito fica junto, sem espaço. */
export function unidadesDoRecibo(corpo: string): UnidadeRecibo[] {
  const unidades: UnidadeRecibo[] = []
  let anteriorTerminaEmEspaco = true
  corpo.split('**').forEach((trecho, i) => {
    const negrito = i % 2 === 1
    // Só cola no que veio antes quando não há espaço entre os dois trechos (ex.: "**Nome**," ).
    const colaNoAnterior = trecho.length > 0 && !/^\s/.test(trecho) && !anteriorTerminaEmEspaco
    trecho.split(/\s+/).filter(Boolean).forEach((texto, j) => {
      if (j === 0 && colaNoAnterior && unidades.length > 0) unidades[unidades.length - 1].push({ texto, negrito })
      else unidades.push([{ texto, negrito }])
    })
    if (trecho.length > 0) anteriorTerminaEmEspaco = /\s$/.test(trecho)
  })
  return unidades
}

export interface LinhaRecibo { unidades: UnidadeRecibo[]; ultima: boolean }

/** Quebra em linhas que cabem em `largura`; `medir` dá a largura real de uma unidade (com a fonte certa de cada pedaço). */
export function quebrarEmLinhas(unidades: UnidadeRecibo[], largura: number, medir: (u: UnidadeRecibo) => number, espaco: number): LinhaRecibo[] {
  const linhas: LinhaRecibo[] = []
  let atual: UnidadeRecibo[] = []
  let usado = 0
  for (const u of unidades) {
    const w = medir(u)
    const proximo = atual.length === 0 ? w : usado + espaco + w
    if (proximo <= largura || atual.length === 0) { atual.push(u); usado = proximo; continue }
    linhas.push({ unidades: atual, ultima: false })
    atual = [u]; usado = w
  }
  if (atual.length) linhas.push({ unidades: atual, ultima: true })
  return linhas
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

  // Texto justificado: as palavras se espalham até as duas margens; a última linha fica alinhada à esquerda.
  const tamanho = 12
  const fonteDe = (p: PalavraRecibo) => (p.negrito ? fontBold : font)
  const larguraEspaco = font.widthOfTextAtSize(' ', tamanho)
  const larguraUnidade = (u: UnidadeRecibo) => u.reduce((a, p) => a + fonteDe(p).widthOfTextAtSize(p.texto, tamanho), 0)
  const linhas = quebrarEmLinhas(unidadesDoRecibo(corpo), contentWidth, larguraUnidade, larguraEspaco)
  linhas.forEach(linha => {
    const soma = linha.unidades.reduce((a, u) => a + larguraUnidade(u), 0)
    const lacunas = linha.unidades.length - 1
    const espaco = linha.ultima || lacunas === 0 ? larguraEspaco : (contentWidth - soma) / lacunas
    let x = margin
    linha.unidades.forEach(u => {
      u.forEach(p => {
        page.drawText(p.texto, { x, y, size: tamanho, font: fonteDe(p), color: rgb(0, 0, 0) })
        x += fonteDe(p).widthOfTextAtSize(p.texto, tamanho)
      })
      x += espaco
    })
    y -= lineHeight
  })

  // Data, linha de assinatura e nome do assinante: centralizados na página.
  const centralizado = (texto: string, fonte: typeof font) => (pageWidth - fonte.widthOfTextAtSize(texto, 12)) / 2
  y -= 40
  const dataLocal = `Belo Horizonte, ${dataAssinaturaExtenso(mesReferencia)}`
  page.drawText(dataLocal, { x: centralizado(dataLocal, font), y, size: 12, font })
  y -= 60
  const linha = '_'.repeat(58)
  page.drawText(linha, { x: centralizado(linha, font), y, size: 12, font })
  y -= 16
  const nome = nomeAssinante.toUpperCase()
  page.drawText(nome, { x: centralizado(nome, fontBold), y, size: 12, font: fontBold })

  return pdf.save()
}
