import { createClient } from '@/lib/supabase/server'
import IniciaisDespachosPanel, { type LinhaPainel } from './IniciaisDespachosPanel'

// Listas do Trello geradas por automação (publicações/DJEN) — o título delas cita
// "inicial"/"despacho" por causa do teor da publicação, não são iniciais a fazer.
const LISTAS_AUTOMATICAS = ['PLANILHA SEMANAL', 'PLANILHA DIÁRIA', 'Pesquisa automática DJEN (Planilha diária)']

const sem = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** "Tainã" (lista do Trello) → "Tainã Carlos" (perfil), se o primeiro nome for único. */
function nomeDoPerfilPorLista(lista: string | null, perfis: { id: string; nome: string }[]): string | null {
  if (!lista) return null
  const alvo = sem(lista)
  const candidatos = perfis.filter(p => sem(p.nome).split(/\s+/)[0] === alvo)
  return candidatos.length === 1 ? candidatos[0].nome : null
}

type Row = {
  id: string; titulo: string; descricao: string | null; status: string
  data: string | null; numero_processo: string | null; partes_resumidas: string | null
  pendencia_motivo: string | null; categoria: 'inicial' | 'despacho' | null
  origem: string; trello_list_nome: string | null; created_at: string
  responsavel: { id: string; nome: string } | null
}

const SELECT = 'id, titulo, descricao, status, data, numero_processo, partes_resumidas, pendencia_motivo, categoria, origem, trello_list_nome, created_at, responsavel:profiles!responsavel_id(id, nome)'

/**
 * Painel do Dashboard para o Cristiano: iniciais repassadas (cadastradas + cards do
 * Trello com "INICIAL" no título) e despachos a fazer, por responsável e com a posição.
 * Cada cadastro vira um card no Kanban do responsável (kanban_tasks.categoria).
 */
export default async function IniciaisDespachosBlock() {
  const supabase = await createClient()

  const [{ data: cadastrados }, { data: doTrello }, { data: perfis }] = await Promise.all([
    supabase.from('kanban_tasks').select(SELECT)
      .not('categoria', 'is', null).eq('arquivado', false).order('created_at', { ascending: false }).limit(500),
    supabase.from('kanban_tasks').select(SELECT)
      .is('categoria', null).eq('origem', 'trello').eq('arquivado', false).neq('status', 'concluido')
      .ilike('titulo', '%inicial%').not('descricao', 'ilike', '%AUTOMACAO_PUBLICACOES%')
      .order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id, nome').eq('ativo', true).neq('role', 'cliente').order('nome'),
  ])

  const trello = ((doTrello ?? []) as unknown as Row[])
    .filter(r => !LISTAS_AUTOMATICAS.includes(r.trello_list_nome ?? ''))
    .map(r => ({ ...r, categoria: 'inicial' as const }))

  const linhas: LinhaPainel[] = ([...((cadastrados ?? []) as unknown as Row[]), ...trello]).map(r => ({
    id: r.id,
    categoria: r.categoria as 'inicial' | 'despacho',
    titulo: r.titulo,
    detalhe: r.descricao,
    processo: r.numero_processo,
    partes: r.partes_resumidas,
    prazo: r.data,
    status: r.status,
    pendencia: r.pendencia_motivo,
    responsavel: r.responsavel?.nome ?? nomeDoPerfilPorLista(r.trello_list_nome, perfis ?? []) ?? r.trello_list_nome ?? 'Sem responsável',
    origem: r.origem === 'trello' ? 'trello' : 'cadastro',
  }))

  return <IniciaisDespachosPanel linhas={linhas} perfis={perfis ?? []} />
}
