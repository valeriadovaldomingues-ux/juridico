// Consultas do Portal do Cliente. SEMPRE recebem o clienteId da sessão e filtram por ele; um id de processo vindo
// da URL só vale se pertencer a esse cliente E for visível (processoVisivelNoPortal). Cada objeto devolvido é
// montado campo a campo, então nada interno (observações, valor da causa, advogado, parte contrária interna,
// documento das partes, notas internas) tem como vazar por descuido.

import type { Db } from './db'
import { checar } from './db'
import {
  ANDAMENTO_ORIGENS_PORTAL, ANDAMENTO_TIPOS_PORTAL, PARTES_TIPOS_PORTAL,
  andamentoVisivelNoPortal, descricaoParaCliente, filtrarVisiveisNoPortal, processoVisivelNoPortal,
} from './visibilidade'
import { isUUID } from '@/lib/portal/validate'

export const CAMPOS_PROCESSO_PORTAL =
  'id, numero_processo, titulo, area_direito, status, fase, tribunal, vara, comarca, classe_processual, data_distribuicao, created_at, segredo_justica, ocultar_portal'

export interface ProcessoPortal {
  id: string
  numero: string | null
  titulo: string
  area: string | null
  status: string
  fase: string | null
  tribunal: string | null
  vara: string | null
  comarca: string | null
  classe: string | null
  distribuicao: string | null
}
export interface ParteProcessoPortal { nome: string; tipo: string }
export interface AndamentoPortal { id: string; data: string; tipo: string; titulo: string; descricao: string | null }
export interface AudienciaPortal {
  id: string
  processoId: string
  processoNumero: string | null
  processoTitulo: string | null
  data: string
  hora: string | null
  tipo: string
  modalidade: string | null
  local: string | null
}

export const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal', penal: 'Criminal', tributario: 'Tributário',
  previdenciario: 'Previdenciário', administrativo: 'Administrativo', familia: 'Família', empresarial: 'Empresarial', outro: 'Outra área',
}
export const STATUS_LABELS: Record<string, string> = { ativo: 'Em andamento', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado' }
export const TIPO_PARTE_LABELS: Record<string, string> = { autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro interessado' }
export const TIPO_ANDAMENTO_LABELS: Record<string, string> = {
  peticao: 'Petição', decisao: 'Decisão', despacho: 'Despacho', audiencia: 'Audiência', juntada: 'Juntada', publicacao: 'Publicação',
}
const AUDIENCIA_TIPO_LABELS: Record<string, string> = {
  inicial: 'Audiência inicial', una: 'Audiência una', instrucao: 'Audiência de instrução', conciliacao: 'Audiência de conciliação', outra: 'Audiência',
}
const MODALIDADE_LABELS: Record<string, string> = { presencial: 'Presencial', virtual: 'Por videoconferência', hibrida: 'Híbrida' }

export const hojeSP = (agora: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)

const lotes = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function paraProcessoPortal(p: Record<string, unknown>): ProcessoPortal {
  return {
    id: p.id as string,
    numero: texto(p.numero_processo)?.replace(/^"|"$/g, '') ?? null,
    titulo: (texto(p.titulo) ?? 'Processo'),
    area: texto(p.area_direito),
    status: (texto(p.status) ?? 'ativo'),
    fase: texto(p.fase),
    tribunal: texto(p.tribunal),
    vara: texto(p.vara),
    comarca: texto(p.comarca),
    classe: texto(p.classe_processual),
    distribuicao: texto(p.data_distribuicao),
  }
}

/** Todos os processos VISÍVEIS do cliente. */
export async function listarProcessosDoCliente(db: Db, clienteId: string): Promise<ProcessoPortal[]> {
  const base = db.from('processos').select(CAMPOS_PROCESSO_PORTAL).eq('cliente_id', clienteId)
  const { data, error } = await filtrarVisiveisNoPortal(base).order('created_at', { ascending: false }).limit(2000)
  checar(error, 'processos')
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter(p => processoVisivelNoPortal(p as { segredo_justica?: boolean | null; ocultar_portal?: boolean | null }))
    .map(paraProcessoPortal)
}

/** Um processo do cliente. Qualquer outra situação (não é dele, oculto, segredo, inexistente, id inválido) = null → 404. */
export async function obterProcessoDoCliente(db: Db, clienteId: string, processoId: string): Promise<ProcessoPortal | null> {
  if (!isUUID(processoId)) return null
  const base = db.from('processos').select(CAMPOS_PROCESSO_PORTAL).eq('id', processoId).eq('cliente_id', clienteId)
  const { data, error } = await filtrarVisiveisNoPortal(base).maybeSingle()
  checar(error, 'processos')
  if (!data || !processoVisivelNoPortal(data as { segredo_justica?: boolean | null; ocultar_portal?: boolean | null })) return null
  return paraProcessoPortal(data as unknown as Record<string, unknown>)
}

export async function listarPartes(db: Db, processoIds: string[]): Promise<Map<string, ParteProcessoPortal[]>> {
  const mapa = new Map<string, ParteProcessoPortal[]>()
  for (const grupo of lotes(processoIds, 80)) {
    const { data, error } = await db
      .from('partes_processo')
      .select('processo_id, pessoa_nome, tipo_parte')
      .in('processo_id', grupo)
      .in('tipo_parte', [...PARTES_TIPOS_PORTAL])
    checar(error, 'partes')
    for (const p of (data ?? []) as { processo_id: string; pessoa_nome: string; tipo_parte: string }[]) {
      const nome = texto(p.pessoa_nome)
      if (!nome) continue
      const lista = mapa.get(p.processo_id) ?? []
      lista.push({ nome, tipo: TIPO_PARTE_LABELS[p.tipo_parte] ?? 'Parte' })
      mapa.set(p.processo_id, lista)
    }
  }
  return mapa
}

const limpar = (v: string | null, max: number): string | null => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

function paraAndamentoPortal(a: Record<string, unknown>): AndamentoPortal | null {
  if (!andamentoVisivelNoPortal({ tipo: a.tipo as string, origem: a.origem as string })) return null
  const titulo = limpar(texto(a.titulo), 200)
  if (!titulo) return null
  return {
    id: a.id as string,
    data: a.data_andamento as string,
    tipo: TIPO_ANDAMENTO_LABELS[a.tipo as string] ?? 'Andamento',
    titulo,
    descricao: descricaoParaCliente(texto(a.descricao)),
  }
}

/** Andamentos client-safe de UM processo (o chamador já provou que o processo é do cliente e visível). */
export async function listarAndamentos(db: Db, processoId: string, limite = 100): Promise<AndamentoPortal[]> {
  const { data, error } = await db
    .from('processo_andamentos')
    .select('id, processo_id, data_andamento, tipo, titulo, descricao, origem')
    .eq('processo_id', processoId)
    .in('tipo', [...ANDAMENTO_TIPOS_PORTAL])
    .in('origem', [...ANDAMENTO_ORIGENS_PORTAL])
    .order('data_andamento', { ascending: false })
    .limit(limite)
  checar(error, 'andamentos')
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(paraAndamentoPortal).filter((a): a is AndamentoPortal => !!a)
}

/** Andamentos client-safe de vários processos (já visíveis do cliente), agrupados por processo, mais recentes primeiro. */
export async function listarAndamentosDosProcessos(db: Db, processoIds: string[], porProcesso = 50): Promise<Map<string, AndamentoPortal[]>> {
  const mapa = new Map<string, AndamentoPortal[]>()
  for (const grupo of lotes(processoIds, 80)) {
    // O PostgREST devolve no máximo 1000 linhas por chamada: pagina (até 20 páginas por lote).
    for (let pagina = 0; pagina < 20; pagina++) {
      const { data, error } = await db
        .from('processo_andamentos')
        .select('id, processo_id, data_andamento, tipo, titulo, descricao, origem')
        .in('processo_id', grupo)
        .in('tipo', [...ANDAMENTO_TIPOS_PORTAL])
        .in('origem', [...ANDAMENTO_ORIGENS_PORTAL])
        .order('data_andamento', { ascending: false })
        .range(pagina * 1000, pagina * 1000 + 999)
      checar(error, 'andamentos')
      const linhas = (data ?? []) as unknown as Record<string, unknown>[]
      for (const a of linhas) {
        const item = paraAndamentoPortal(a)
        if (!item) continue
        const lista = mapa.get(a.processo_id as string) ?? []
        if (lista.length < porProcesso) lista.push(item)
        mapa.set(a.processo_id as string, lista)
      }
      if (linhas.length < 1000) break
    }
  }
  return mapa
}

/** Audiências futuras (pendentes) dos processos visíveis do cliente. Sem prazos, sem descrição interna. */
export async function listarAudienciasFuturas(db: Db, clienteId: string, agora: Date = new Date(), processos?: ProcessoPortal[]): Promise<AudienciaPortal[]> {
  const visiveis = processos ?? await listarProcessosDoCliente(db, clienteId)
  if (!visiveis.length) return []
  const porId = new Map(visiveis.map(p => [p.id, p]))
  const hoje = hojeSP(agora)
  const saida: AudienciaPortal[] = []
  for (const grupo of lotes([...porId.keys()], 80)) {
    let { data, error } = await db
      .from('agenda_items')
      .select('id, processo_id, tipo, status, data_inicio, hora_inicio, audiencia_tipo, audiencia_modalidade, audiencia_local')
      .in('processo_id', grupo)
      .in('tipo', ['audiencia', 'audiencia_processual'])
      .eq('status', 'pendente')
      .gte('data_inicio', hoje)
      .order('data_inicio', { ascending: true })
      .limit(500)
    if (error && ['42703', 'PGRST204'].includes(error.code ?? '')) {
      // colunas próprias da audiência ainda não existem neste banco: usa só o básico
      const alt = await db
        .from('agenda_items')
        .select('id, processo_id, tipo, status, data_inicio, hora_inicio')
        .in('processo_id', grupo)
        .in('tipo', ['audiencia', 'audiencia_processual'])
        .eq('status', 'pendente')
        .gte('data_inicio', hoje)
        .order('data_inicio', { ascending: true })
        .limit(500)
      data = alt.data as typeof data
      error = alt.error
    }
    checar(error, 'agenda')
    for (const a of (data ?? []) as unknown as Record<string, unknown>[]) {
      const proc = porId.get(a.processo_id as string)
      if (!proc) continue // defesa: só audiência de processo visível do cliente
      saida.push({
        id: a.id as string,
        processoId: proc.id,
        processoNumero: proc.numero,
        processoTitulo: proc.titulo,
        data: a.data_inicio as string,
        hora: texto(a.hora_inicio)?.slice(0, 5) ?? null,
        tipo: AUDIENCIA_TIPO_LABELS[(a.audiencia_tipo as string) ?? ''] ?? 'Audiência',
        modalidade: MODALIDADE_LABELS[(a.audiencia_modalidade as string) ?? ''] ?? null,
        local: limpar(texto(a.audiencia_local), 300),
      })
    }
  }
  return saida.sort((a, b) => `${a.data} ${a.hora ?? ''}`.localeCompare(`${b.data} ${b.hora ?? ''}`))
}

export interface ResumoPortal {
  totalProcessos: number
  processosEmAndamento: number
  proximasAudiencias: AudienciaPortal[]
  ultimosAndamentos: (AndamentoPortal & { processoId: string; processoNumero: string | null; processoTitulo: string })[]
}

export async function montarResumo(db: Db, clienteId: string, agora: Date = new Date()): Promise<ResumoPortal> {
  const processos = await listarProcessosDoCliente(db, clienteId)
  const audiencias = await listarAudienciasFuturas(db, clienteId, agora, processos)
  const porProcesso = await listarAndamentosDosProcessos(db, processos.map(p => p.id), 3)
  const porId = new Map(processos.map(p => [p.id, p]))
  const todos = [...porProcesso.entries()].flatMap(([pid, lista]) =>
    lista.map(a => ({ ...a, processoId: pid, processoNumero: porId.get(pid)?.numero ?? null, processoTitulo: porId.get(pid)?.titulo ?? 'Processo' })))
  todos.sort((a, b) => b.data.localeCompare(a.data))
  return {
    totalProcessos: processos.length,
    processosEmAndamento: processos.filter(p => p.status === 'ativo').length,
    proximasAudiencias: audiencias.slice(0, 3),
    ultimosAndamentos: todos.slice(0, 5),
  }
}
