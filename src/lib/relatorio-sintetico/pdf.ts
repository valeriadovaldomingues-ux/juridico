import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { wrapText, getLogoBytes } from '@/lib/documentos-pecas/pdf'
import { embedCarlito, TAM_TEXTO } from '@/lib/pdf/fonte'
import type { ProcessoRel, RelatorioSintetico } from './dados'

// Folha timbrada e margens das peças; fonte Carlito 12 (Calibri), como todos os PDFs.
const LARGURA = 595.28
const ALTURA = 841.89
const MARGEM_TOPO = 3685 / 20
const MARGEM_BASE = 2041 / 20
const MARGEM_LADO = 72
const LARGURA_TEXTO = LARGURA - 2 * MARGEM_LADO
const TAM = TAM_TEXTO
const ENTRE = 15

const STATUS: Record<string, string> = { ativo: 'Ativo', encerrado: 'Encerrado', arquivado: 'Arquivado', suspenso: 'Suspenso' }
const AREA: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', tributario: 'Tributário', administrativo: 'Administrativo', criminal: 'Penal-Criminal',
  previdenciario: 'Previdenciário', empresarial: 'Empresarial', familia: 'Família e Sucessões', outro: 'Outro',
}
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Campos do processo que aparecem no bloco, na ordem do modelo do EasyJur (só os preenchidos). */
export function camposDoProcesso(p: ProcessoRel): [string, string][] {
  const campos: [string, string | null][] = [
    ['Título', p.titulo],
    ['Tipo de ação', p.classe],
    ['Área', AREA[p.area] ?? p.area],
    ['Tribunal', p.tribunal],
    ['Vara', p.vara],
    ['Comarca', p.comarca],
    ['Data de distribuição', p.distribuicao],
    ['Valor da causa', p.valorCausa != null && p.valorCausa > 0 ? moeda(p.valorCausa) : null],
    ['Advogado', p.advogado],
    ['Cliente', p.cliente],
    ['Qualificação', p.qualificacaoDaPessoa],
    ['Contrário', p.contrario],
    ['Fase atual', p.fase],
    ['Status', STATUS[p.status] ?? p.status],
  ]
  return campos.filter((c): c is [string, string] => !!c[1]?.trim())
}

/** PDF "Relatório sintético de processos" em nome de uma pessoa: cada processo com dados, partes e andamentos. */
export async function gerarRelatorioSinteticoPdf(r: RelatorioSintetico): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const { regular: fonte, negrito } = await embedCarlito(pdf)
  const fundo = await pdf.embedPng(await getLogoBytes())

  let pagina!: PDFPage
  let y = 0

  function novaPagina() {
    pagina = pdf.addPage([LARGURA, ALTURA])
    pagina.drawImage(fundo, { x: 0, y: 0, width: LARGURA, height: ALTURA })
    y = ALTURA - MARGEM_TOPO
  }
  const garantir = (linhas: number) => { if (y - linhas * ENTRE < MARGEM_BASE + 20) novaPagina() }
  function linha(t: string, opts: { negrito?: boolean; tam?: number; x?: number; cor?: [number, number, number] } = {}) {
    const f: PDFFont = opts.negrito ? negrito : fonte
    pagina.drawText(t, { x: opts.x ?? MARGEM_LADO, y, size: opts.tam ?? TAM, font: f, color: rgb(...(opts.cor ?? [0, 0, 0])) })
    y -= ENTRE
  }
  function paragrafo(rotulo: string | null, texto: string, recuo = 0) {
    const completo = rotulo ? `${rotulo}: ${texto}` : texto
    const linhas = wrapText(completo, fonte, TAM, LARGURA_TEXTO - recuo)
    garantir(Math.min(linhas.length, 3))
    for (const l of linhas) { garantir(1); linha(l, { x: MARGEM_LADO + recuo }) }
  }
  function regua(espessura = 0.5) {
    pagina.drawLine({ start: { x: MARGEM_LADO, y: y + 10 }, end: { x: LARGURA - MARGEM_LADO, y: y + 10 }, thickness: espessura, color: rgb(0.4, 0.4, 0.4) })
  }

  novaPagina()
  const titulo = 'RELATÓRIO SINTÉTICO DE PROCESSOS'
  linha(titulo, { negrito: true, tam: 16, x: (LARGURA - negrito.widthOfTextAtSize(titulo, 16)) / 2 })
  y -= 6
  linha(`Em nome de: ${r.pessoa}`, { negrito: true })
  linha(`${r.processos.length} ${r.processos.length === 1 ? 'processo' : 'processos'}`)
  linha(`Emitido em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(r.emitidoEm)}`)
  y -= 8

  if (r.processos.length === 0) {
    linha('Nenhum processo ligado a esta pessoa.')
    return pdf.save()
  }

  for (const p of r.processos) {
    garantir(8)
    y -= 6
    linha(`PROCESSO N° ${p.numero}`, { negrito: true, tam: 13 })
    regua()
    y -= 2
    for (const [rotulo, valor] of camposDoProcesso(p)) paragrafo(rotulo, valor)

    if (p.partes.length) {
      y -= 4
      garantir(3)
      linha('DADOS DAS PARTES', { negrito: true })
      for (const parte of p.partes) paragrafo(null, `${parte.nome}${parte.qualificacao ? ` — ${parte.qualificacao}` : ` — ${parte.tipo}`}`, 8)
    }

    y -= 4
    garantir(3)
    linha('DADOS DO ANDAMENTO', { negrito: true })
    if (p.andamentos.length === 0) paragrafo(null, 'Nenhum andamento registrado.', 8)
    for (const a of p.andamentos) paragrafo(null, `${a.data} — ${a.tipo}: ${a.descricao}`, 8)
    y -= 10
  }

  return pdf.save()
}
