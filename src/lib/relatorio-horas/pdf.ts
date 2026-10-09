import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import { wrapText, getLogoBytes } from '@/lib/documentos-pecas/pdf'
import { formatDurationMinutes } from '@/lib/agenda-time-entries'
import { type RelatorioHoras } from './dados'

// Mesma folha timbrada e margens das peças (documentos-pecas/pdf.ts).
const LARGURA = 595.28
const ALTURA = 841.89
const MARGEM_TOPO = 3685 / 20
const MARGEM_BASE = 2041 / 20
const MARGEM_LADO = 72
const COL = { data: MARGEM_LADO, processo: MARGEM_LADO + 56, atividade: MARGEM_LADO + 176, resp: MARGEM_LADO + 336, tempo: MARGEM_LADO + 411 }
const LARGURA_ATIV = 154
const LARGURA_RESP = 70
const TAM = 8.5
const ENTRE_LINHAS = 11

const brData = (iso: string) => iso.split('-').reverse().join('/')

/** PDF do relatório de horas por cliente — somente horas, sem valores. */
export async function gerarRelatorioHorasPdf(r: RelatorioHoras): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.TimesRoman)
  const negrito = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const fundo = await pdf.embedPng(await getLogoBytes())

  let pagina: PDFPage
  let y = 0

  function novaPagina(cabecalho: boolean) {
    pagina = pdf.addPage([LARGURA, ALTURA])
    pagina.drawImage(fundo, { x: 0, y: 0, width: LARGURA, height: ALTURA })
    y = ALTURA - MARGEM_TOPO
    if (cabecalho) desenharCabecalhoTabela()
  }

  function texto(t: string, x: number, opts: { negrito?: boolean; tam?: number } = {}) {
    pagina.drawText(t, { x, y, size: opts.tam ?? TAM, font: opts.negrito ? negrito : fonte, color: rgb(0, 0, 0) })
  }

  function desenharCabecalhoTabela() {
    texto('Data', COL.data, { negrito: true }); texto('Processo', COL.processo, { negrito: true })
    texto('Atividade', COL.atividade, { negrito: true }); texto('Responsável', COL.resp, { negrito: true })
    texto('Tempo', COL.tempo, { negrito: true })
    y -= 4
    pagina.drawLine({ start: { x: MARGEM_LADO, y }, end: { x: LARGURA - MARGEM_LADO, y }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) })
    y -= ENTRE_LINHAS
  }

  novaPagina(false)

  const titulo = 'RELATÓRIO DE HORAS'
  texto(titulo, (LARGURA - negrito.widthOfTextAtSize(titulo, 14)) / 2, { negrito: true, tam: 14 })
  y -= 22
  texto(`Cliente: ${r.cliente}`, MARGEM_LADO, { negrito: true, tam: 11 }); y -= 15
  texto(`Período: ${brData(r.de)} a ${brData(r.ate)}`, MARGEM_LADO, { tam: 11 }); y -= 22

  if (r.linhas.length === 0) {
    texto('Nenhuma hora lançada para este cliente no período.', MARGEM_LADO, { tam: 11 })
    return pdf.save()
  }

  desenharCabecalhoTabela()

  for (const l of r.linhas) {
    const ativ = wrapText(l.atividade, fonte, TAM, LARGURA_ATIV)
    const resp = wrapText(l.responsavel, fonte, TAM, LARGURA_RESP)
    const proc = wrapText(l.processo ?? '—', fonte, TAM, 114)
    const linhas = Math.max(ativ.length, resp.length, proc.length, 1)
    if (y - linhas * ENTRE_LINHAS < MARGEM_BASE + 40) novaPagina(true)

    const topo = y
    texto(l.data, COL.data)
    proc.forEach((t, i) => { y = topo - i * ENTRE_LINHAS; texto(t, COL.processo) })
    ativ.forEach((t, i) => { y = topo - i * ENTRE_LINHAS; texto(t, COL.atividade) })
    resp.forEach((t, i) => { y = topo - i * ENTRE_LINHAS; texto(t, COL.resp) })
    y = topo
    texto(formatDurationMinutes(l.minutos), COL.tempo)
    y = topo - linhas * ENTRE_LINHAS - 3
  }

  if (y < MARGEM_BASE + 90) novaPagina(false)
  y -= 6
  pagina!.drawLine({ start: { x: MARGEM_LADO, y }, end: { x: LARGURA - MARGEM_LADO, y }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) })
  y -= 16
  texto(`Total de horas: ${formatDurationMinutes(r.totalMinutos)}`, MARGEM_LADO, { negrito: true, tam: 11 })
  y -= 16
  if (r.porResponsavel.length > 1) {
    for (const p of r.porResponsavel) { texto(`${p.nome}: ${formatDurationMinutes(p.minutos)}`, MARGEM_LADO + 8); y -= ENTRE_LINHAS }
  }
  y -= 8
  texto(`Emitido em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())}`, MARGEM_LADO, { tam: 8 })

  return pdf.save()
}
