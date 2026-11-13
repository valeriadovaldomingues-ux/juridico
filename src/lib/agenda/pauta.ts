import { PDFDocument, rgb, type PDFPage } from 'pdf-lib'
import { embedCarlito, TAM_TEXTO } from '@/lib/pdf/fonte'
import type { SupabaseClient } from '@supabase/supabase-js'
import { wrapText, getLogoBytes } from '@/lib/documentos-pecas/pdf'
import {
  AUDIENCIA_MODALIDADES, AUDIENCIA_TIPOS, limparNumeroProcesso, responsaveisDaAudiencia, rotuloStatusAudiencia,
} from './audiencia'

// Pauta de audiências por período (substitui o "Relatório de Agendamentos" do EasyJur): só audiências e perícias, com
// processo, cliente, parte contrária, vara, data e hora, responsáveis, status e descrição. Sai na folha timbrada.

export interface ItemPauta {
  id: string
  data: string                 // YYYY-MM-DD
  horaInicio: string | null    // HH:MM
  horaFim: string | null
  tipoItem: 'audiencia' | 'pericia'
  tipo: string | null          // Inicial, UNA...
  modalidade: string | null    // Presencial, Virtual, Híbrida
  localOuLink: string | null
  status: 'Aberta' | 'Realizada' | 'Cancelada'
  processo: string | null      // nº CNJ
  comarcaVara: string | null
  cliente: string | null
  parteContraria: string | null
  responsaveis: string[]
  descricao: string | null
  semProcesso: boolean
}

type Embutido<T> = T | T[] | null
interface LinhaBanco {
  id: string; tipo: string; status: string; data_inicio: string; hora_inicio: string | null; hora_fim: string | null
  descricao: string | null; responsavel: string | null; process_number: string | null; client_name: string | null
  opposing_party_name: string | null; court: string | null; county: string | null; processo_id: string | null
  audiencia_tipo: string | null; audiencia_modalidade: string | null; audiencia_local: string | null
  cliente: Embutido<{ nome: string | null }>
  processo: Embutido<{
    numero_processo: string | null; vara: string | null; comarca: string | null; tribunal: string | null; parte_contraria: string | null
    cliente: Embutido<{ nome: string | null }>
  }>
}

const um = <T,>(v: Embutido<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : null)

/** Monta um item da pauta: dados do processo vinculado e, nas audiências antigas sem vínculo, os que vieram na importação. */
export function montarItemPauta(l: LinhaBanco): ItemPauta {
  const proc = um(l.processo)
  const cliente = um(l.cliente)?.nome ?? um(proc?.cliente ?? null)?.nome ?? l.client_name
  const vara = proc?.vara ?? l.court
  const comarca = proc?.comarca ?? l.county
  return {
    id: l.id,
    data: l.data_inicio,
    horaInicio: hhmm(l.hora_inicio),
    horaFim: hhmm(l.hora_fim),
    tipoItem: l.tipo === 'pericia' ? 'pericia' : 'audiencia',
    tipo: l.audiencia_tipo && l.audiencia_tipo in AUDIENCIA_TIPOS ? AUDIENCIA_TIPOS[l.audiencia_tipo as keyof typeof AUDIENCIA_TIPOS] : null,
    modalidade: l.audiencia_modalidade && l.audiencia_modalidade in AUDIENCIA_MODALIDADES ? AUDIENCIA_MODALIDADES[l.audiencia_modalidade as keyof typeof AUDIENCIA_MODALIDADES] : null,
    localOuLink: l.audiencia_local,
    status: rotuloStatusAudiencia(l.status),
    processo: proc?.numero_processo ?? limparNumeroProcesso(l.process_number),
    comarcaVara: [vara, comarca].filter(Boolean).join(' — ') || null,
    cliente: cliente ?? null,
    parteContraria: l.opposing_party_name ?? proc?.parte_contraria ?? null,
    responsaveis: responsaveisDaAudiencia(l.responsavel),
    descricao: l.descricao,
    semProcesso: !l.processo_id,
  }
}

/** Audiências e perícias do período (inclusive canceladas, marcadas como tal), em ordem de data e hora. */
export async function buscarPauta(db: SupabaseClient, de: string, ate: string): Promise<ItemPauta[]> {
  const { data, error } = await db.from('agenda_items')
    .select('id, tipo, status, data_inicio, hora_inicio, hora_fim, descricao, responsavel, process_number, client_name, opposing_party_name, court, county, processo_id, audiencia_tipo, audiencia_modalidade, audiencia_local, cliente:clientes(nome), processo:processos(numero_processo, vara, comarca, tribunal, parte_contraria, cliente:clientes(nome))')
    .in('tipo', ['audiencia', 'pericia']).gte('data_inicio', de).lte('data_inicio', ate)
    .order('data_inicio').order('hora_inicio', { nullsFirst: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as LinhaBanco[]).map(montarItemPauta)
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const LARGURA = 595.28
const ALTURA = 841.89
const MARGEM_TOPO = 3685 / 20
const MARGEM_BASE = 2041 / 20
const MARGEM_LADO = 72
const LARGURA_TEXTO = LARGURA - 2 * MARGEM_LADO
const TAM = TAM_TEXTO
const ENTRE = 15
const LIMITE_DESCRICAO = 420

/** A fonte padrão do PDF só entende Latin-1 e algumas pontuações; o resto vira espaço em vez de derrubar o arquivo. */
const compativel = (t: string) => t.replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF–—‘’“”•…€™]/g, ' ').replace(/[ \t]+/g, ' ')

const brData = (iso: string) => iso.split('-').reverse().join('/')
const diaSemana = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
    .replace(/^./, c => c.toUpperCase())

export async function gerarPautaPdf(itens: ItemPauta[], de: string, ate: string, agora = new Date()): Promise<Uint8Array> {
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
  const garantir = (altura: number) => { if (y - altura < MARGEM_BASE + 20) novaPagina() }
  function linha(t: string, opts: { negrito?: boolean; tam?: number; x?: number } = {}) {
    pagina.drawText(compativel(t), { x: opts.x ?? MARGEM_LADO, y, size: opts.tam ?? TAM, font: opts.negrito ? negrito : fonte, color: rgb(0, 0, 0) })
    y -= ENTRE + ((opts.tam ?? TAM) > TAM ? 4 : 0)
  }
  function campo(rotulo: string, valor: string | null, quebrar = true) {
    const texto = compativel(`${rotulo}: ${valor ?? '—'}`)
    const linhas = quebrar ? wrapText(texto, fonte, TAM, LARGURA_TEXTO) : [texto]
    garantir(linhas.length * ENTRE)
    for (const l of linhas) linha(l)
  }

  novaPagina()
  const titulo = 'PAUTA DE AUDIÊNCIAS'
  linha(titulo, { negrito: true, tam: 16, x: (LARGURA - negrito.widthOfTextAtSize(titulo, 16)) / 2 })
  y -= 4
  linha(`Período: ${brData(de)} a ${brData(ate)}`)
  linha(`${itens.length} ${itens.length === 1 ? 'audiência' : 'audiências'} no período`)
  y -= 8

  if (itens.length === 0) {
    linha('Nenhuma audiência ou perícia no período.')
    return pdf.save()
  }

  let diaAtual = ''
  for (const it of itens) {
    garantir(ENTRE * 10)
    if (it.data !== diaAtual) {
      diaAtual = it.data
      y -= 4
      linha(`${diaSemana(it.data)}, ${brData(it.data)}`, { negrito: true, tam: 13 })
      pagina.drawLine({ start: { x: MARGEM_LADO, y: y + 10 }, end: { x: LARGURA - MARGEM_LADO, y: y + 10 }, thickness: 0.6, color: rgb(0.35, 0.35, 0.35) })
      y -= 2
    }

    const horario = it.horaInicio ? `${it.horaInicio}${it.horaFim ? ` – ${it.horaFim}` : ''}` : 'horário a definir'
    const natureza = [it.tipoItem === 'pericia' ? 'PERÍCIA' : 'AUDIÊNCIA', it.tipo?.toUpperCase(), it.modalidade?.toUpperCase()].filter(Boolean).join(' · ')
    linha(`${horario}   ${natureza}   [${it.status.toUpperCase()}]`, { negrito: true })

    campo('Processo', it.semProcesso ? `${it.processo ?? '—'} (SEM PROCESSO VINCULADO NO SISTEMA)` : it.processo)
    campo('Vara/Comarca', it.comarcaVara)
    campo('Cliente', it.cliente)
    campo('Parte contrária', it.parteContraria)
    campo('Responsáveis', it.responsaveis.length ? it.responsaveis.join(' e ') : null)
    if (it.localOuLink) campo('Local/Link', it.localOuLink)
    if (it.descricao?.trim()) {
      const d = compativel(it.descricao.replace(/\s+/g, ' ').trim())
      campo('Descrição', d.length > LIMITE_DESCRICAO ? `${d.slice(0, LIMITE_DESCRICAO).trimEnd()}…` : d)
    }
    y -= 6
  }

  garantir(ENTRE * 2)
  y -= 4
  linha(`Emitido em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(agora)}`)
  return pdf.save()
}
