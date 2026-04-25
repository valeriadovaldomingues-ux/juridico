import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['advogado', 'gerente', 'socio']
const FINANCEIRO_ROLES: UserRole[] = ['gerente', 'socio']

export interface RelatorioClienteData {
  cliente: {
    id:                  string
    nome:                string
    nome_fantasia:       string | null
    cpf_cnpj:            string | null
    cnpj_raiz:           string | null
    tipo_pessoa:         string
    tipo_contato:        string
    socio_representante: string | null
    email:               string | null
    telefone:            string | null
    responsavel:         { id: string; nome: string } | null
  }
  processos: Array<{
    id:                      string
    numero_processo:         string | null
    titulo:                  string
    area_direito:            string
    status:                  string
    tribunal:                string | null
    data_distribuicao:       string | null
    valor_causa:             number | null
    advogado_responsavel_id: string | null
    advogado:                { nome: string } | null
    partes:                  Array<{ pessoa_nome: string; tipo_parte: string }>
  }>
  prazos: Array<{
    id:          string
    titulo:      string
    tipo:        string
    status:      string
    data_inicio: string
    prazo_final: string | null
    prioridade:  string
    processo_id: string | null
  }>
  tarefas: Array<{
    id:         string
    titulo:     string
    status:     string
    tipo:       string | null
    created_at: string
  }>
  publicacoes: Array<{
    id:              string
    numero_processo: string | null
    tribunal:        string | null
    data_publicacao: string | null
    tipo_publicacao: string
    status:          string
  }>
  financeiro: {
    receita_paga:   number
    despesa_paga:   number
    a_receber:      number
    vencidos:       number
  } | null
  documentos_count: number
  resumo: {
    total_processos:  number
    ativos:           number
    prazos_vencidos:  number
    prazos_proximos:  number
    tarefas_abertas:  number
    pub_nao_tratadas: number
  }
}

/**
 * GET /api/relatorios/cliente?cliente_id=...&periodo=...&status=...&area_direito=...&responsavel_id=...
 *
 * Retorna dados completos de um cliente para composição de relatório.
 */
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const cliente_id    = searchParams.get('cliente_id')
  const periodo       = searchParams.get('periodo') ?? 'todos'
  const statusFiltro  = searchParams.get('status') ?? ''
  const areaFiltro    = searchParams.get('area_direito') ?? ''
  const respFiltro    = searchParams.get('responsavel_id') ?? ''

  if (!cliente_id) {
    return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()
  const hoje     = new Date().toISOString().slice(0, 10)
  const dataCorte = periodoParaData(periodo)

  // ── 1. Cliente ────────────────────────────────────────────────────────────
  const { data: cliente, error: clienteErr } = await supabase
    .from('clientes')
    .select('id, nome, nome_fantasia, cpf_cnpj, cnpj_raiz, tipo_pessoa, tipo_contato, socio_representante, email, telefone, responsavel:profiles!responsavel_id(id, nome)')
    .eq('id', cliente_id)
    .single()

  if (clienteErr || !cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  // ── 2. Processos ──────────────────────────────────────────────────────────
  let processosQuery = supabase
    .from('processos')
    .select(`
      id, numero_processo, titulo, area_direito, status, tribunal,
      data_distribuicao, valor_causa, advogado_responsavel_id,
      advogado:profiles!advogado_responsavel_id(nome),
      partes:partes_processo(pessoa_nome, tipo_parte)
    `)
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })

  if (statusFiltro)   processosQuery = processosQuery.eq('status', statusFiltro)
  if (areaFiltro)     processosQuery = processosQuery.eq('area_direito', areaFiltro)
  if (respFiltro)     processosQuery = processosQuery.eq('advogado_responsavel_id', respFiltro)
  if (dataCorte)      processosQuery = processosQuery.gte('created_at', dataCorte)

  const { data: processos } = await processosQuery
  const processosData = (processos ?? []) as unknown as RelatorioClienteData['processos']
  const processoIds   = processosData.map(p => p.id)
  const numeros       = processosData.map(p => p.numero_processo).filter(Boolean) as string[]

  // ── 3. Prazos / Audiências (agenda_items) ─────────────────────────────────
  let prazosData: RelatorioClienteData['prazos'] = []
  if (processoIds.length > 0) {
    const { data: prazos } = await supabase
      .from('agenda_items')
      .select('id, titulo, tipo, status, data_inicio, prazo_final, prioridade, processo_id')
      .in('tipo', ['prazo', 'audiencia'])
      .in('processo_id', processoIds)
      .order('prazo_final', { ascending: true })
    prazosData = (prazos ?? []) as RelatorioClienteData['prazos']
  }

  // ── 4. Tarefas Kanban ─────────────────────────────────────────────────────
  let tarefasData: RelatorioClienteData['tarefas'] = []
  if (processoIds.length > 0) {
    const { data: tarefas } = await supabase
      .from('kanban_tasks')
      .select('id, titulo, status, tipo, created_at')
      .in('processo_id', processoIds)
      .order('created_at', { ascending: false })
      .limit(100)
    tarefasData = (tarefas ?? []) as RelatorioClienteData['tarefas']
  }

  // ── 5. Publicações ────────────────────────────────────────────────────────
  let pubData: RelatorioClienteData['publicacoes'] = []
  if (processoIds.length > 0 || numeros.length > 0) {
    let pubQuery = supabase
      .from('publicacoes')
      .select('id, numero_processo, tribunal, data_publicacao, tipo_publicacao, status')
      .order('data_publicacao', { ascending: false })
      .limit(50)

    if (processoIds.length > 0) {
      pubQuery = pubQuery.in('processo_id', processoIds)
    } else if (numeros.length > 0) {
      pubQuery = pubQuery.in('numero_processo', numeros)
    }

    const { data: pubs } = await pubQuery
    pubData = (pubs ?? []) as RelatorioClienteData['publicacoes']
  }

  // ── 6. Financeiro (só gerente/sócio) ─────────────────────────────────────
  let financeiro: RelatorioClienteData['financeiro'] = null
  if (FINANCEIRO_ROLES.includes(auth.role)) {
    const { data: lanc } = await supabase
      .from('financeiro_lancamentos')
      .select('tipo, valor, status')
      .eq('cliente_id', cliente_id)
      .neq('status', 'cancelado')

    if (lanc) {
      financeiro = {
        receita_paga: lanc.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + l.valor, 0),
        despesa_paga: lanc.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + l.valor, 0),
        a_receber:    lanc.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0),
        vencidos:     lanc.filter(l => l.status === 'vencido').reduce((s, l) => s + l.valor, 0),
      }
    }
  }

  // ── 7. Contagem de documentos ────────────────────────────────────────────
  const docFilters = [
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('cliente_id', cliente_id),
  ]
  if (processoIds.length > 0) {
    docFilters.push(
      supabase.from('documentos').select('id', { count: 'exact', head: true }).in('processo_id', processoIds)
    )
  }
  const docCounts = await Promise.all(docFilters)
  const documentos_count = docCounts.reduce((s, r) => s + (r.count ?? 0), 0)

  // ── Resumo ────────────────────────────────────────────────────────────────
  const prazosVencidos  = prazosData.filter(p => p.status === 'pendente' && (p.prazo_final ?? p.data_inicio) < hoje)
  const prazosProximos  = prazosData.filter(p => p.status === 'pendente' && (p.prazo_final ?? p.data_inicio) >= hoje)
  const tarefasAbertas  = tarefasData.filter(t => t.status !== 'concluido')
  const pubNaoTratadas  = pubData.filter(p => p.status === 'nao_tratada')

  const resp: RelatorioClienteData = {
    cliente:          cliente as unknown as RelatorioClienteData['cliente'],
    processos:        processosData,
    prazos:           prazosData,
    tarefas:          tarefasData,
    publicacoes:      pubData,
    financeiro,
    documentos_count,
    resumo: {
      total_processos:  processosData.length,
      ativos:           processosData.filter(p => p.status === 'ativo').length,
      prazos_vencidos:  prazosVencidos.length,
      prazos_proximos:  prazosProximos.length,
      tarefas_abertas:  tarefasAbertas.length,
      pub_nao_tratadas: pubNaoTratadas.length,
    },
  }

  return NextResponse.json(resp)
}

// ── Helper ────────────────────────────────────────────────────────────────────

function periodoParaData(periodo: string): string | null {
  const hoje = new Date()
  switch (periodo) {
    case 'este-mes':   return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    case 'trimestre':  return new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1).toISOString()
    case 'ano':        return new Date(hoje.getFullYear(), 0, 1).toISOString()
    default:           return null
  }
}
