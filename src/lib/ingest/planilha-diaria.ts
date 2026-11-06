import { calculateSimpleSLA } from '@/lib/kanban-sla'

// Entrada dos cartões da Planilha Diária (a coleta do DJEN por OAB/processo/recortes, que roda na VPS) direto no Kanban
// do PEDV, sem passar pelo Trello. A coleta continua montando título e descrição; aqui só se valida, se evita duplicata
// (chave = processo + data de disponibilização, garantida pelo banco) e se grava o cartão na coluna do DJEN.
//
// Modo sombra (visivel=false): grava o cartão já ARQUIVADO e sem data de arquivamento, para comparar com o que o Trello
// recebeu sem aparecer no quadro. Quando a coleta passa a mandar visivel=true, os cartões de sombra são revelados.

type Db = { from: (t: string) => any }  // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ItemEntrada { numero_cnj?: unknown; data_disponibilizacao?: unknown; titulo?: unknown; descricao?: unknown }
export interface Item { cnjDigitos: string; cnj: string; data: string; titulo: string; descricao: string | null }
export type Resultado = 'criado' | 'duplicado' | 'revelado' | 'sem_data' | 'cnj_invalido' | 'sem_titulo' | 'falha'
export interface Resumo { criados: number; duplicados: number; revelados: number; recusados: number; falhas: number; itens: Array<{ cnj: string; resultado: Resultado }> }

const NOME_LISTA_DJEN = 'Pesquisa automática DJEN%'

/** CNJ só com dígitos (20) ou null. */
export function digitosCnj(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length === 20 ? d : null
}

export function formatarCnj(d: string): string {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`
}

/** Chave que o banco usa para barrar cartão em dobro: o processo E a data (nunca só o processo). */
export const chaveDedup = (cnjDigitos: string, data: string) => `${cnjDigitos}:${data}`

const dataValida = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Sem data de disponibilização declarada não há cartão: data presumida faria contar prazo errado. */
export function validarItem(raw: ItemEntrada): { ok: true; item: Item } | { ok: false; motivo: 'sem_data' | 'cnj_invalido' | 'sem_titulo' } {
  const cnjDigitos = digitosCnj(raw.numero_cnj)
  if (!cnjDigitos) return { ok: false, motivo: 'cnj_invalido' }
  if (!dataValida(raw.data_disponibilizacao)) return { ok: false, motivo: 'sem_data' }
  const titulo = typeof raw.titulo === 'string' ? raw.titulo.trim().slice(0, 500) : ''
  if (!titulo) return { ok: false, motivo: 'sem_titulo' }
  const descricao = typeof raw.descricao === 'string' && raw.descricao.trim() ? raw.descricao.slice(0, 20000) : null
  return { ok: true, item: { cnjDigitos, cnj: formatarCnj(cnjDigitos), data: raw.data_disponibilizacao, titulo, descricao } }
}

export async function gravarCartoes(db: Db, itensBrutos: ItemEntrada[], opts: { visivel: boolean; agora?: Date }): Promise<Resumo | { erro: string }> {
  const agora = (opts.agora ?? new Date()).toISOString()
  const { data: lista } = await db.from('trello_list_mappings')
    .select('trello_list_id, trello_list_name, posicao').ilike('trello_list_name', NOME_LISTA_DJEN).limit(1).maybeSingle()
  if (!lista?.trello_list_id) return { erro: 'A coluna "Pesquisa automática DJEN" não está cadastrada no Kanban.' }

  const resumo: Resumo = { criados: 0, duplicados: 0, revelados: 0, recusados: 0, falhas: 0, itens: [] }
  const registrar = (cnj: string, resultado: Resultado) => {
    resumo.itens.push({ cnj, resultado })
    if (resultado === 'criado') resumo.criados++
    else if (resultado === 'duplicado') resumo.duplicados++
    else if (resultado === 'revelado') resumo.revelados++
    else if (resultado === 'falha') resumo.falhas++
    else resumo.recusados++
  }

  for (const bruto of itensBrutos) {
    const v = validarItem(bruto)
    if (!v.ok) { registrar(String(bruto.numero_cnj ?? ''), v.motivo); continue }
    const { item } = v
    const chave = chaveDedup(item.cnjDigitos, item.data)

    const { data: existente } = await db.from('kanban_tasks')
      .select('id, arquivado, arquivado_em').eq('origem', 'automacao').eq('origem_id', chave).maybeSingle()
    if (existente) {
      // Cartão de sombra (arquivado sem data de arquivamento) vira visível quando a coleta sai do modo sombra.
      if (opts.visivel && existente.arquivado && !existente.arquivado_em) {
        const { error } = await db.from('kanban_tasks').update({ arquivado: false, updated_at: agora }).eq('id', existente.id)
        registrar(item.cnj, error ? 'falha' : 'revelado')
      } else {
        registrar(item.cnj, 'duplicado')
      }
      continue
    }

    const { data: processos } = await db.from('processos').select('id').eq('numero_processo', item.cnj).limit(2)
    const processoId = Array.isArray(processos) && processos.length === 1 ? processos[0].id : null

    const { data: maxRow } = await db.from('kanban_tasks')
      .select('ordem').eq('status', 'a_fazer').order('ordem', { ascending: false }).limit(1).maybeSingle()
    const ordem = maxRow ? maxRow.ordem + 1 : 0
    const sla = calculateSimpleSLA({ tipo: 'tarefa', origem: 'automacao', data: null, status: 'a_fazer', prioridade: 'media' } as Parameters<typeof calculateSimpleSLA>[0])

    const { error } = await db.from('kanban_tasks').insert({
      titulo: item.titulo, descricao: item.descricao, status: 'a_fazer', tipo: 'tarefa', prioridade: 'media',
      numero_processo: item.cnj, processo_id: processoId,
      trello_list_id: lista.trello_list_id, trello_list_nome: lista.trello_list_name, trello_list_pos: lista.posicao ?? null,
      origem: 'automacao', origem_id: chave, ordem, sla_level: sla.sla_level, sla_due_at: sla.sla_due_at,
      arquivado: !opts.visivel, updated_at: agora,
    })
    if (error) registrar(item.cnj, error.code === '23505' ? 'duplicado' : 'falha')
    else registrar(item.cnj, 'criado')
  }
  return resumo
}
