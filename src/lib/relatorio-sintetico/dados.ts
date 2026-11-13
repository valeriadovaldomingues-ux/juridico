// Relatório sintético de processos EM NOME DE UMA PESSOA (ex.: José Silvestre, que é parte em processos de várias empresas).
// Reúne os processos em que a pessoa está ligada como parte (partes_processo.pessoa_id) e os processos do cliente de mesmo nome,
// com dados do processo, partes e andamentos. Só leitura; não traz valores de honorários.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ParteRel { nome: string; tipo: string; qualificacao: string | null }
export interface AndamentoRel { data: string; tipo: string; descricao: string }
export interface ProcessoRel {
  id: string
  numero: string
  titulo: string
  area: string
  status: string
  fase: string | null
  tribunal: string | null
  vara: string | null
  comarca: string | null
  classe: string | null
  valorCausa: number | null
  distribuicao: string | null // dd/mm/aaaa
  advogado: string | null
  cliente: string | null
  qualificacaoDaPessoa: string | null
  contrario: string | null
  partes: ParteRel[]
  andamentos: AndamentoRel[]
}
export interface RelatorioSintetico { pessoa: string; processos: ProcessoRel[]; emitidoEm: Date }

const TIPOS_PARTE: Record<string, string> = { autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro', outro: 'Cliente' }
const TIPOS_ANDAMENTO: Record<string, string> = {
  peticao: 'Petição', decisao: 'Decisão', despacho: 'Despacho', audiencia: 'Audiência', prazo: 'Prazo', publicacao: 'Publicação',
  juntada: 'Juntada', contato_cliente: 'Contato com cliente', observacao: 'Andamento', documento: 'Documento', outro: 'Andamento',
}

export const brData = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Qualificação da pessoa (Autor, Réu, Representante…) guardada no vínculo: "[... qualificação: Reu]". */
export function qualificacaoDoVinculo(observacoes: string | null | undefined): string | null {
  const m = /qualifica[cç][aã]o:\s*([^\]]+)\]/i.exec(observacoes ?? '')
  const q = m?.[1]?.trim()
  return q && q !== '-' ? q : null
}

/** Processos importados antes dos andamentos viraram texto em observações: "Último andamento: 03/12/2024 — Tipo — texto". */
export function ultimoAndamentoDasObservacoes(observacoes: string | null | undefined): AndamentoRel | null {
  const m = /[ÚU]ltimo andamento:\s*(\d{2})\/(\d{2})\/(\d{4})\s*[—-]\s*([\s\S]+?)(?:\n\n---|\n\n|$)/i.exec(observacoes ?? '')
  if (!m) return null
  return { data: `${m[1]}/${m[2]}/${m[3]}`, tipo: 'Andamento', descricao: m[4].trim() }
}

const em = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

async function todasAsLinhas<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999)
    if (error) throw new Error(error.message)
    tudo.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return tudo
}

/** Pessoas ligadas a processos como parte representada (tipo "outro"), com a contagem de processos. */
export async function listarPessoasComProcessos(supabase: SupabaseClient): Promise<{ id: string; nome: string; processos: number }[]> {
  const linhas = await todasAsLinhas<{ pessoa_id: string | null; pessoa_nome: string }>((de, ate) =>
    supabase.from('partes_processo').select('pessoa_id, pessoa_nome').eq('tipo_parte', 'outro').not('pessoa_id', 'is', null).range(de, ate))
  const mapa = new Map<string, { id: string; nome: string; processos: number }>()
  for (const l of linhas) {
    if (!l.pessoa_id) continue
    const atual = mapa.get(l.pessoa_id) ?? { id: l.pessoa_id, nome: l.pessoa_nome, processos: 0 }
    atual.processos += 1
    mapa.set(l.pessoa_id, atual)
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function montarRelatorioSintetico(supabase: SupabaseClient, pessoaId: string, agora = new Date()): Promise<RelatorioSintetico | null> {
  const { data: pessoa } = await supabase.from('pessoas').select('id, nome').eq('id', pessoaId).maybeSingle()
  if (!pessoa) return null

  const vinculos = await todasAsLinhas<{ processo_id: string; observacoes: string | null }>((de, ate) =>
    supabase.from('partes_processo').select('processo_id, observacoes').eq('pessoa_id', pessoaId).range(de, ate))
  const qualificacaoPorProcesso = new Map(vinculos.map(v => [v.processo_id, qualificacaoDoVinculo(v.observacoes)]))

  // Processos do cadastro de cliente com o mesmo nome (a pessoa também pode ser cliente direta).
  const { data: clientesMesmoNome } = await supabase.from('clientes').select('id').ilike('nome', pessoa.nome)
  const clienteIds = (clientesMesmoNome ?? []).map(c => c.id as string)
  const doCliente = clienteIds.length
    ? await todasAsLinhas<{ id: string }>((de, ate) => supabase.from('processos').select('id').in('cliente_id', clienteIds).range(de, ate))
    : []

  const ids = [...new Set([...qualificacaoPorProcesso.keys(), ...doCliente.map(p => p.id)])]
  if (ids.length === 0) return { pessoa: pessoa.nome, processos: [], emitidoEm: agora }

  const campos = 'id, numero_processo, titulo, area_direito, status, fase, tribunal, vara, comarca, classe_processual, valor_causa, data_distribuicao, observacoes, advogado_caso_id, cliente:clientes(nome)'
  const processos: Record<string, unknown>[] = []
  const partes: { processo_id: string; pessoa_nome: string; tipo_parte: string; observacoes: string | null }[] = []
  const andamentos: { processo_id: string; data_andamento: string; tipo: string; titulo: string; descricao: string | null }[] = []
  for (const grupo of em(ids, 80)) {
    processos.push(...await todasAsLinhas<Record<string, unknown>>((de, ate) => supabase.from('processos').select(campos).in('id', grupo).range(de, ate)))
    partes.push(...await todasAsLinhas((de, ate) => supabase.from('partes_processo').select('processo_id, pessoa_nome, tipo_parte, observacoes').in('processo_id', grupo).range(de, ate)))
    andamentos.push(...await todasAsLinhas((de, ate) => supabase.from('processo_andamentos').select('processo_id, data_andamento, tipo, titulo, descricao').in('processo_id', grupo).order('data_andamento', { ascending: false }).range(de, ate)))
  }
  const { data: perfis } = await supabase.from('profiles').select('id, nome')
  const nomePerfil = new Map((perfis ?? []).map(p => [p.id as string, p.nome as string]))

  const partesPor = new Map<string, ParteRel[]>()
  for (const p of partes) {
    const lista = partesPor.get(p.processo_id) ?? []
    lista.push({ nome: p.pessoa_nome, tipo: TIPOS_PARTE[p.tipo_parte] ?? p.tipo_parte, qualificacao: p.tipo_parte === 'outro' ? qualificacaoDoVinculo(p.observacoes) : null })
    partesPor.set(p.processo_id, lista)
  }
  const andamentosPor = new Map<string, AndamentoRel[]>()
  for (const a of andamentos) {
    const lista = andamentosPor.get(a.processo_id) ?? []
    lista.push({ data: brData(a.data_andamento), tipo: TIPOS_ANDAMENTO[a.tipo] ?? 'Andamento', descricao: (a.descricao?.trim() || a.titulo || '').trim() })
    andamentosPor.set(a.processo_id, lista)
  }

  const saida: ProcessoRel[] = processos.map(p => {
    const id = p.id as string
    const todas = partesPor.get(id) ?? []
    const contrarios = todas.filter(x => x.tipo === 'Réu' || x.tipo === 'Autor' || x.tipo === 'Terceiro').map(x => x.nome)
    const ands = andamentosPor.get(id) ?? []
    const fallback = ands.length === 0 ? ultimoAndamentoDasObservacoes(p.observacoes as string | null) : null
    const cli = p.cliente as { nome?: string } | { nome?: string }[] | null
    return {
      id,
      numero: (p.numero_processo as string | null)?.replace(/^"|"$/g, '') ?? 'sem número',
      titulo: p.titulo as string,
      area: p.area_direito as string,
      status: p.status as string,
      fase: (p.fase as string | null) ?? null,
      tribunal: (p.tribunal as string | null) ?? null,
      vara: (p.vara as string | null) ?? null,
      comarca: (p.comarca as string | null) ?? null,
      classe: (p.classe_processual as string | null) ?? null,
      valorCausa: p.valor_causa == null ? null : Number(p.valor_causa),
      distribuicao: brData(p.data_distribuicao as string | null) || null,
      advogado: p.advogado_caso_id ? nomePerfil.get(p.advogado_caso_id as string) ?? null : null,
      cliente: (Array.isArray(cli) ? cli[0]?.nome : cli?.nome) ?? null,
      qualificacaoDaPessoa: qualificacaoPorProcesso.get(id) ?? null,
      contrario: contrarios.length ? contrarios.join('; ') : null,
      partes: todas,
      andamentos: fallback ? [fallback] : ands,
    }
  })
  saida.sort((a, b) => (a.status === 'ativo' ? 0 : 1) - (b.status === 'ativo' ? 0 : 1) || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }))
  return { pessoa: pessoa.nome, processos: saida, emitidoEm: agora }
}
