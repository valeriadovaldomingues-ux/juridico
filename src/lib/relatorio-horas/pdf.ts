import { PDFDocument, rgb, type PDFPage } from 'pdf-lib'
import { embedCarlito, TAM_TEXTO } from '@/lib/pdf/fonte'
import { wrapText, getLogoBytes } from '@/lib/documentos-pecas/pdf'
import { formatDurationMinutes } from '@/lib/agenda-time-entries'
import { type RelatorioHoras } from './dados'

// Mesma folha timbrada e margens das peças (documentos-pecas/pdf.ts). Fonte Carlito 12 (Calibri), como todos os PDFs.
const LARGURA = 595.28
const ALTURA = 841.89
const MARGEM_TOPO = 3685 / 20
const MARGEM_BASE = 2041 / 20
const MARGEM_LADO = 72
const LARGURA_TEXTO = LARGURA - 2 * MARGEM_LADO
const TAM = TAM_TEXTO
const ENTRE_LINHAS = 15

const brData = (iso: string) => iso.split('-').reverse().join('/')

/** PDF do relatório de horas por cliente — somente horas, sem valores. */
export async function gerarRelatorioHorasPdf(r: RelatorioHoras): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const { regular: fonte, negrito } = await embedCarlito(pdf)
  const fundo = await pdf.embedPng(await getLogoBytes())

  let pagina: PDFPage
  let y = 0

  function novaPagina() {
    pagina = pdf.addPage([LARGURA, ALTURA])
    pagina.drawImage(fundo, { x: 0, y: 0, width: LARGURA, height: ALTURA })
    y = ALTURA - MARGEM_TOPO
  }

  function texto(t: string, x: number, opts: { negrito?: boolean; tam?: number } = {}) {
    pagina.drawText(t, { x, y, size: opts.tam ?? TAM, font: opts.negrito ? negrito : fonte, color: rgb(0, 0, 0) })
  }
  function textoADireita(t: string, opts: { negrito?: boolean } = {}) {
    const f = opts.negrito ? negrito : fonte
    texto(t, LARGURA - MARGEM_LADO - f.widthOfTextAtSize(t, TAM), opts)
  }

  novaPagina()

  const titulo = 'RELATÓRIO DE HORAS'
  texto(titulo, (LARGURA - negrito.widthOfTextAtSize(titulo, 16)) / 2, { negrito: true, tam: 16 })
  y -= 26
  texto(`Cliente: ${r.cliente}`, MARGEM_LADO, { negrito: true }); y -= ENTRE_LINHAS + 2
  texto(`Período: ${brData(r.de)} a ${brData(r.ate)}`, MARGEM_LADO); y -= ENTRE_LINHAS + 8

  if (r.linhas.length === 0) {
    texto('Nenhuma hora lançada para este cliente no período.', MARGEM_LADO)
    return pdf.save()
  }

  for (const l of r.linhas) {
    const proc = wrapText(`Processo: ${l.processo ?? '—'}`, fonte, TAM, LARGURA_TEXTO)
    const ativ = wrapText(l.atividade, fonte, TAM, LARGURA_TEXTO)
    const altura = (1 + proc.length + ativ.length) * ENTRE_LINHAS + 8
    if (y - altura < MARGEM_BASE + 40) novaPagina()

    // Linha 1: data e responsável à esquerda, tempo à direita; depois o processo e a atividade.
    texto(`${l.data}  ·  ${l.responsavel}`, MARGEM_LADO, { negrito: true })
    textoADireita(formatDurationMinutes(l.minutos), { negrito: true })
    y -= ENTRE_LINHAS
    for (const t of proc) { texto(t, MARGEM_LADO); y -= ENTRE_LINHAS }
    for (const t of ativ) { texto(t, MARGEM_LADO); y -= ENTRE_LINHAS }
    y += 3
    pagina!.drawLine({ start: { x: MARGEM_LADO, y }, end: { x: LARGURA - MARGEM_LADO, y }, thickness: 0.4, color: rgb(0.75, 0.75, 0.75) })
    y -= 11
  }

  if (y < MARGEM_BASE + 90) novaPagina()
  y -= 4
  pagina!.drawLine({ start: { x: MARGEM_LADO, y }, end: { x: LARGURA - MARGEM_LADO, y }, thickness: 0.6, color: rgb(0.4, 0.4, 0.4) })
  y -= 18
  texto(`Total de horas: ${formatDurationMinutes(r.totalMinutos)}`, MARGEM_LADO, { negrito: true })
  y -= ENTRE_LINHAS + 2
  if (r.porResponsavel.length > 1) {
    for (const p of r.porResponsavel) {
      if (y < MARGEM_BASE + 30) novaPagina()
      texto(`${p.nome}: ${formatDurationMinutes(p.minutos)}`, MARGEM_LADO + 8); y -= ENTRE_LINHAS
    }
  }
  y -= 10
  texto(`Emitido em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())}`, MARGEM_LADO)

  return pdf.save()
}
