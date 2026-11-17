import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { diasSemMovimento, movimentacaoMaisRecente, type CartaoDoProcesso } from '@/lib/kanban/pesquisa'
import type { UserRole } from '@/types'

// GET /api/kanban-pesquisa?q=… — pesquisa o processo (número, título, cliente, parte) em TODO o sistema, não só no quadro:
// devolve, por processo, a última movimentação (andamento ou publicação), quantos dias está parado, os prazos pendentes e
// os cartões dele no Kanban (inclusive concluídos e arquivados). Cartões que citam o número mas não estão ligados a um
// processo vêm em `soKanban`.
const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
const LIMITE = 10

const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

type CartaoBanco = {
  id: string; titulo: string; status: string; arquivado: boolean | null; concluido_em: string | null; origem: string | null
  processo_id: string | null; numero_processo: string | null
  responsavel: { nome: string | null } | { nome: string | null }[] | null
}
const paraCartao = (c: CartaoBanco): CartaoDoProcesso => ({
  id: c.id, titulo: c.titulo, status: c.status, arquivado: Boolean(c.arquivado), concluidoEm: c.concluido_em,
  responsavel: um(c.responsavel)?.nome ?? null, origem: c.origem,
})

export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120)
  if (q.length < 3) return NextResponse.json({ processos: [], soKanban: [] })
  const supabase = await createClient()
  const hoje = hojeBR()

  // 1) Processos: número, título, cliente (nome/CPF-CNPJ) e partes, sem acento; todos os status.
  const { data: idsBusca, error: e1 } = await supabase.rpc('processos_ids_busca', { q })
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  const ids = ((idsBusca ?? []) as unknown[]).map(x => (typeof x === 'string' ? x : (x as { id?: string })?.id)).filter((x): x is string => !!x).slice(0, LIMITE)

  const { data: procs } = ids.length
    ? await supabase.from('processos').select('id, numero_processo, titulo, status, fase, cliente:clientes!cliente_id(nome)').in('id', ids)
    : { data: [] as never[] }
  const lista = (procs ?? []) as unknown as { id: string; numero_processo: string | null; titulo: string | null; status: string | null; fase: string | null; cliente: { nome: string | null } | { nome: string | null }[] | null }[]
  const numeros = lista.map(p => p.numero_processo).filter((n): n is string => !!n)

  // 2) Por processo: último andamento, última publicação e prazos pendentes.
  const detalhes = await Promise.all(lista.map(async p => {
    const [and, pub, prazos] = await Promise.all([
      supabase.from('processo_andamentos').select('data_andamento, titulo').eq('processo_id', p.id).lte('data_andamento', `${hoje}T23:59:59-03:00`).order('data_andamento', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('publicacoes').select('data_publicacao, titulo').eq('processo_id', p.id).lte('data_publicacao', hoje).order('data_publicacao', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('prazos').select('data_final').eq('processo_id', p.id).eq('status', 'pendente').order('data_final', { ascending: true }).limit(50),
    ])
    return { id: p.id, and: and.data, pub: pub.data, prazos: prazos.data ?? [] }
  }))

  // 3) Cartões do Kanban: ligados a esses processos, ou que citam o número (ou o texto pesquisado) sem estar ligados.
  const seletor = 'id, titulo, status, arquivado, concluido_em, origem, processo_id, numero_processo, responsavel:profiles!responsavel_id(nome)'
  const cartoes: CartaoBanco[] = []
  const vistos = new Set<string>()
  const juntar = (rows: unknown) => { for (const c of (rows ?? []) as CartaoBanco[]) if (!vistos.has(c.id)) { vistos.add(c.id); cartoes.push(c) } }
  if (ids.length) juntar((await supabase.from('kanban_tasks').select(seletor).in('processo_id', ids).limit(300)).data)
  if (numeros.length) juntar((await supabase.from('kanban_tasks').select(seletor).in('numero_processo', numeros).limit(300)).data)
  const termo = q.replace(/[%,()]/g, ' ').trim()
  if (termo.length >= 4) juntar((await supabase.from('kanban_tasks').select(seletor).or(`numero_processo.ilike.%${termo}%,titulo.ilike.%${termo}%`).limit(60)).data)

  const processos = lista.map(p => {
    const d = detalhes.find(x => x.id === p.id)!
    const mov = movimentacaoMaisRecente(
      d.and ? { data: d.and.data_andamento as string, titulo: d.and.titulo as string | null } : null,
      d.pub ? { data: d.pub.data_publicacao as string, titulo: d.pub.titulo as string | null } : null,
      hoje,
    )
    const proximos = d.prazos.map(x => String(x.data_final)).filter(Boolean)
    const meus = cartoes.filter(c => c.processo_id === p.id || (!!p.numero_processo && c.numero_processo === p.numero_processo))
    return {
      id: p.id, numero: p.numero_processo, titulo: p.titulo, cliente: um(p.cliente)?.nome ?? null, status: p.status, fase: p.fase,
      ultimaMovimentacao: mov, diasSemMovimento: diasSemMovimento(mov?.data, hoje),
      prazosPendentes: proximos.length, proximoPrazo: proximos[0] ?? null,
      cartoes: meus.map(paraCartao),
    }
  })
  const idsDosProcessos = new Set(lista.map(p => p.id))
  const numerosDosProcessos = new Set(numeros)
  const soKanban = cartoes
    .filter(c => !(c.processo_id && idsDosProcessos.has(c.processo_id)) && !(c.numero_processo && numerosDosProcessos.has(c.numero_processo)))
    .map(paraCartao)

  return NextResponse.json({ processos, soKanban })
}
