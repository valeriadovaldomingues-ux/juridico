// Geração determinística (sem IA) dos PDFs de honorários.
// Reaproveita o layout/helpers de src/lib/relatorios-inteligentes/pdf.ts.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatCurrency } from '@/lib/utils'
import { formatCompetencia, computeTotais } from './service'
import { HONORARIO_STATUS_LABELS } from './types'
import type { HonorarioMensal, HonorarioStatus, HonorarioTotais } from './types'

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

function formatDataBR(iso: string | null): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

function wrapText(text: string, fontSize: number, maxWidth: number, ratio = 0.52): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  const measure = (v: string) => v.length * fontSize * ratio
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next) <= maxWidth) { current = next; continue }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

interface PdfCtx {
  pdf: PDFDocument
  fontRegular: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
}

async function novoPdf(): Promise<PdfCtx> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  return { pdf, fontRegular, fontBold }
}

function finalizar(ctx: PdfCtx) {
  const pages = ctx.pdf.getPages()
  pages.forEach((p, index) => {
    p.drawText('Controle de Honorários · Sistema PEDV', {
      x: MARGIN, y: 34, size: 9, font: ctx.fontRegular, color: rgb(0.42, 0.48, 0.55),
    })
    p.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: PAGE_W - MARGIN - 72, y: 34, size: 9, font: ctx.fontRegular, color: rgb(0.42, 0.48, 0.55),
    })
  })
  return ctx.pdf.save()
}

const STATUS_SECOES: { status: HonorarioStatus; titulo: string }[] = [
  { status: 'pago',      titulo: 'CLIENTES EM DIA' },
  { status: 'pendente',  titulo: 'CLIENTES PENDENTES' },
  { status: 'parcial',   titulo: 'PAGAMENTO PARCIAL' },
  { status: 'em_atraso', titulo: 'CLIENTES EM ATRASO' },
  { status: 'isento',    titulo: 'ISENTOS' },
]

/** Relatório mensal imprimível (item 6). */
export async function gerarRelatorioMensalPdf(
  competencia: string,
  registros: HonorarioMensal[],
  totais?: HonorarioTotais,
): Promise<Uint8Array> {
  const ctx = await novoPdf()
  const t = totais ?? computeTotais(registros)
  let page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const drawLine = (text: string, font = ctx.fontRegular, size = 11, color = rgb(0.13, 0.16, 0.2), x = MARGIN) => {
    page.drawText(text, { x, y, size, font, color })
  }
  const ensure = (req: number) => {
    if (y - req < MARGIN + 20) { page = ctx.pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
  }

  // Header
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: rgb(0.08, 0.22, 0.29) })
  drawLine('Pessoa e do Val Advocacia', ctx.fontBold, 16, rgb(1, 1, 1))
  y = PAGE_H - MARGIN - 28
  drawLine('Relatório Mensal de Honorários', ctx.fontBold, 13, rgb(1, 1, 1))
  y -= 18
  drawLine(`Competência: ${formatCompetencia(competencia)}`, ctx.fontRegular, 10, rgb(0.9, 0.95, 0.96))
  y = PAGE_H - 96 - 24

  // Totais
  drawLine('RESUMO DO MÊS', ctx.fontBold, 11, rgb(0.08, 0.36, 0.37))
  y -= 16
  drawLine(`Total previsto: ${formatCurrency(t.previsto)}`, ctx.fontRegular, 10); y -= 14
  drawLine(`Total recebido: ${formatCurrency(t.recebido)}`, ctx.fontRegular, 10); y -= 14
  drawLine(`Total pendente: ${formatCurrency(t.pendente)}`, ctx.fontRegular, 10); y -= 14
  drawLine(
    `Em dia: ${t.emDia}  ·  Pendentes: ${t.pendentes}  ·  Parciais: ${t.parciais}  ·  Em atraso: ${t.emAtraso}  ·  Isentos: ${t.isentos}`,
    ctx.fontRegular, 10, rgb(0.4, 0.45, 0.5),
  )
  y -= 22

  // Seções por status
  for (const secao of STATUS_SECOES) {
    const doStatus = registros.filter(r => r.status === secao.status)
    if (!doStatus.length) continue
    ensure(30)
    drawLine(`${secao.titulo} (${doStatus.length})`, ctx.fontBold, 11, rgb(0.08, 0.36, 0.37))
    y -= 16
    for (const r of doStatus) {
      const nome = r.cliente?.nome ?? r.cliente_id
      const linha = `• ${nome} — devido ${formatCurrency(r.valor_devido + r.saldo_anterior)}, pago ${formatCurrency(r.valor_pago)}, saldo ${formatCurrency(r.saldo_pendente)}${r.vencimento ? `, venc. ${formatDataBR(r.vencimento)}` : ''}`
      for (const l of wrapText(linha, 10, CONTENT_W)) {
        ensure(14); drawLine(l, ctx.fontRegular, 10); y -= 14
      }
      if (r.observacoes?.trim()) {
        for (const l of wrapText(`   obs.: ${r.observacoes.trim()}`, 9, CONTENT_W)) {
          ensure(12); drawLine(l, ctx.fontRegular, 9, rgb(0.45, 0.5, 0.55)); y -= 12
        }
      }
    }
    y -= 12
  }

  if (!registros.length) {
    drawLine('Nenhum registro nesta competência.', ctx.fontRegular, 10, rgb(0.45, 0.5, 0.55)); y -= 14
  }

  return finalizar(ctx)
}

/** Relatório de inadimplência por cliente — histórico dos últimos 24 meses (item 7). */
export async function gerarInadimplenciaClientePdf(
  clienteNome: string,
  registros: HonorarioMensal[],
): Promise<Uint8Array> {
  const ctx = await novoPdf()
  // Ordena da competência mais recente para a mais antiga.
  const ordenados = [...registros].sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 24)
  let page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const drawLine = (text: string, font = ctx.fontRegular, size = 11, color = rgb(0.13, 0.16, 0.2), x = MARGIN) => {
    page.drawText(text, { x, y, size, font, color })
  }
  const ensure = (req: number) => {
    if (y - req < MARGIN + 20) { page = ctx.pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
  }

  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: rgb(0.08, 0.22, 0.29) })
  drawLine('Pessoa e do Val Advocacia', ctx.fontBold, 16, rgb(1, 1, 1))
  y = PAGE_H - MARGIN - 28
  drawLine('Relatório de Inadimplência — Histórico 24 meses', ctx.fontBold, 13, rgb(1, 1, 1))
  y -= 18
  drawLine(`Cliente: ${clienteNome}`, ctx.fontRegular, 10, rgb(0.9, 0.95, 0.96))
  y = PAGE_H - 96 - 24

  const totalPendente = ordenados
    .filter(r => r.status !== 'isento')
    .reduce((s, r) => s + Math.max(0, r.saldo_pendente), 0)
  drawLine(`Saldo pendente acumulado no período: ${formatCurrency(totalPendente)}`, ctx.fontBold, 10, rgb(0.08, 0.36, 0.37))
  y -= 22

  if (!ordenados.length) {
    drawLine('Sem registros para este cliente.', ctx.fontRegular, 10, rgb(0.45, 0.5, 0.55))
    return finalizar(ctx)
  }

  for (const r of ordenados) {
    const linha = `• ${formatCompetencia(r.competencia)} — ${HONORARIO_STATUS_LABELS[r.status]}: devido ${formatCurrency(r.valor_devido + r.saldo_anterior)}, pago ${formatCurrency(r.valor_pago)}, saldo ${formatCurrency(r.saldo_pendente)}`
    for (const l of wrapText(linha, 10, CONTENT_W)) {
      ensure(14); drawLine(l, ctx.fontRegular, 10); y -= 14
    }
  }

  return finalizar(ctx)
}
