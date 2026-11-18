import type { Ferramenta } from './ferramentas'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

// Kanban no conector MCP: o que a pessoa faz no quadro (ver, criar, mover/alterar e excluir cartões), com as mesmas regras
// da tela: histórico em kanban_historico, SLA recalculado, concluido_em. Toda gravação é em duas etapas (confirmar=true).
// Cartões que vieram do Trello (origem 'trello') não são excluídos por aqui: o sincronizador os recriaria; arquive-os.

const UUID = /^[0-9a-f-]{36}$/i
const STATUS = ['a_fazer', 'fazendo', 'com_pendencia', 'concluido'] as const
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'] as const
const dataOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const marca = (nome: string) => `[registrado via Claude por ${nome}]`

const SELECT_CARTAO = 'id, titulo, descricao, tipo, status, prioridade, data, origem, numero_processo, pendencia_motivo, responsavel_id, processo_id, arquivado, concluido_em, updated_at, trello_list_nome, responsavel:profiles!responsavel_id(id, nome), processo:processos!processo_id(id, numero_processo, titulo)'

function previa(resumo: Record<string, unknown>) {
  return {
    confirmacao_necessaria: true,
    resumo,
    instrucao: 'NADA FOI GRAVADO. Mostre este resumo ao usuário e pergunte se pode gravar. Só depois do "sim" chame de novo, com os mesmos argumentos e confirmar=true.',
  }
}
const CONFIRMAR = { type: 'boolean', description: 'false/ausente = só mostra o resumo; true = grava (só depois do "sim" do usuário)' }

type Db = Parameters<Ferramenta['executar']>[1]['db']

/** Procura o usuário ativo pelo nome; erro se não achar ou se for ambíguo. */
async function perfilPorNome(db: Db, nome: string): Promise<{ id: string; nome: string }> {
  const { data: perfis } = await db.from('profiles').select('id, nome').eq('ativo', true).ilike('nome', `%${nome}%`).limit(5)
  if (!perfis?.length) throw new Error(`Não encontrei usuário ativo com o nome "${nome}".`)
  if (perfis.length > 1) throw new Error(`Mais de um usuário com esse nome: ${perfis.map((p: { nome: string }) => p.nome).join(', ')}. Informe o nome completo.`)
  return perfis[0]
}

function lerStatus(v: unknown) {
  if (v === undefined) return undefined
  const s = STATUS.find(x => x === v)
  if (!s) throw new Error(`status inválido (${STATUS.join(', ')}).`)
  return s
}
function lerPrioridade(v: unknown) {
  if (v === undefined) return undefined
  const p = PRIORIDADES.find(x => x === v)
  if (!p) throw new Error(`prioridade inválida (${PRIORIDADES.join(', ')}).`)
  return p
}
function lerData(v: unknown) {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = dataOk(v)
  if (!d) throw new Error('data inválida (use AAAA-MM-DD).')
  return d
}

const resumoCartao = (c: Record<string, unknown>) => {
  const r = um(c.responsavel as never) as { nome?: string } | null
  const p = um(c.processo as never) as { numero_processo?: string; titulo?: string } | null
  return {
    id: c.id, titulo: c.titulo, status: c.status, prioridade: c.prioridade, prazo: c.data ?? null, responsavel: r?.nome ?? null,
    processo: p ? `${p.numero_processo ?? ''} ${p.titulo ?? ''}`.trim() : (c.numero_processo ?? null), pendencia: c.pendencia_motivo ?? null,
    origem: c.origem, lista_do_trello: c.trello_list_nome ?? null, atualizado_em: c.updated_at,
  }
}

export const KANBAN_LEITURA: Ferramenta[] = [
  {
    name: 'kanban',
    description: 'Cartões do Kanban (a fazer, fazendo, com pendência, concluído). Por padrão só os da própria pessoa, sem os concluídos e sem os arquivados. Pode filtrar por responsável, status e texto (título, descrição, número do processo).',
    inputSchema: { type: 'object', properties: {
      so_meus: { type: 'boolean', description: 'true (padrão) = só os meus; false = de todos' },
      responsavel: { type: 'string', description: 'Parte do nome do responsável (usa todos os cartões dele; ignora so_meus)' },
      status: { type: 'string', enum: [...STATUS], description: 'Só desta coluna' },
      texto: { type: 'string', description: 'Palavras do título/descrição/número do processo' },
      incluir_concluidos: { type: 'boolean', description: 'true = inclui os concluídos (padrão: não)' },
    } },
    async executar(args, ctx) {
      const status = lerStatus(args.status)
      let q = ctx.db.from('kanban_tasks').select(SELECT_CARTAO).eq('arquivado', false).order('updated_at', { ascending: false }).limit(500)
      if (status) q = q.eq('status', status)
      else if (args.incluir_concluidos !== true) q = q.neq('status', 'concluido')
      const nomeResp = texto(args.responsavel, 120)
      if (nomeResp) q = q.eq('responsavel_id', (await perfilPorNome(ctx.db, nomeResp)).id)
      else if (args.so_meus !== false) q = q.eq('responsavel_id', ctx.userId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const palavras = semAcento(String(args.texto ?? '')).split(/\s+/).filter(Boolean)
      const digitos = String(args.texto ?? '').replace(/\D/g, '')
      const lista = (data ?? []).filter((c: Record<string, unknown>) => {
        if (!palavras.length) return true
        const campo = semAcento([c.titulo, c.descricao, c.numero_processo].filter(Boolean).join(' '))
        const soDigitos = String(c.numero_processo ?? '').replace(/\D/g, '') + String(c.titulo ?? '').replace(/\D/g, '')
        return palavras.every(p => campo.includes(p)) || (digitos.length >= 7 && soDigitos.includes(digitos))
      })
      return { total: lista.length, mostrando: Math.min(lista.length, 60), cartoes: lista.slice(0, 60).map(resumoCartao) }
    },
  },
]

async function buscarCartao(ctx: Parameters<Ferramenta['executar']>[1], id: string) {
  if (!UUID.test(id)) throw new Error('Id de cartão inválido.')
  const { data: c, error } = await ctx.db.from('kanban_tasks').select(SELECT_CARTAO).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!c) throw new Error('Cartão não encontrado.')
  return c as Record<string, unknown>
}

export const KANBAN_ESCRITA: Ferramenta[] = [
  {
    name: 'criar_cartao_kanban',
    description: 'Cria um cartão no Kanban (título, coluna, prioridade, responsável, prazo, processo). O responsável padrão é a própria pessoa. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      titulo: { type: 'string' }, descricao: { type: 'string' },
      status: { type: 'string', enum: [...STATUS], description: 'Coluna (padrão a_fazer)' },
      prioridade: { type: 'string', enum: [...PRIORIDADES], description: 'Padrão media' },
      responsavel: { type: 'string', description: 'Nome de quem cuida (padrão: eu)' },
      prazo: { type: 'string', description: 'AAAA-MM-DD' },
      processo_id: { type: 'string', description: 'Id do processo (de buscar_processos), se for de um processo' },
      pendencia_motivo: { type: 'string', description: 'Só para a coluna com_pendencia' },
      confirmar: CONFIRMAR,
    }, required: ['titulo'] },
    async executar(args, ctx) {
      const titulo = texto(args.titulo, 300)
      if (!titulo) throw new Error('Informe o título do cartão.')
      const status = lerStatus(args.status) ?? 'a_fazer'
      const prioridade = lerPrioridade(args.prioridade) ?? 'media'
      const prazo = lerData(args.prazo) ?? null
      const resp = texto(args.responsavel, 120) ? await perfilPorNome(ctx.db, String(args.responsavel)) : { id: ctx.userId, nome: ctx.nome }
      let processo: { id: string; numero_processo: string | null; titulo: string | null } | null = null
      if (args.processo_id) {
        const pid = String(args.processo_id)
        if (!UUID.test(pid)) throw new Error('Id de processo inválido.')
        const { data: p } = await ctx.db.from('processos').select('id, numero_processo, titulo').eq('id', pid).maybeSingle()
        if (!p) throw new Error('Processo não encontrado.')
        processo = p
      }
      const descricao = [texto(args.descricao, 4000), marca(ctx.nome)].filter(Boolean).join('\n\n')
      const resumo = {
        criar_cartao: titulo, coluna: status, prioridade, responsavel: resp.nome, prazo,
        processo: processo ? `${processo.numero_processo ?? ''} ${processo.titulo ?? ''}`.trim() : null,
        pendencia: status === 'com_pendencia' ? texto(args.pendencia_motivo, 500) : null,
      }
      if (args.confirmar !== true) return previa(resumo)
      const { data: maxRow } = await ctx.db.from('kanban_tasks').select('ordem').eq('status', status).order('ordem', { ascending: false }).limit(1).maybeSingle()
      const sla = calculateSimpleSLA({ tipo: 'tarefa', origem: 'manual', data: prazo, status, prioridade })
      const agora = new Date().toISOString()
      const { data: criado, error } = await ctx.db.from('kanban_tasks').insert({
        titulo, descricao, tipo: 'tarefa', criado_por: ctx.userId, status, prioridade, responsavel_id: resp.id,
        processo_id: processo?.id ?? null, numero_processo: processo?.numero_processo ?? null, origem: 'manual', data: prazo,
        pendencia_motivo: status === 'com_pendencia' ? texto(args.pendencia_motivo, 500) : null,
        ordem: maxRow ? Number(maxRow.ordem) + 1 : 0, sla_level: sla.sla_level, sla_due_at: sla.sla_due_at, updated_at: agora,
        concluido_em: status === 'concluido' ? agora : null,
      }).select('id').single()
      if (error) throw new Error(error.message)
      await ctx.db.from('kanban_historico').insert({ task_id: criado.id, usuario_id: ctx.userId, acao: 'criacao', para_status: status, para_responsavel_id: resp.id })
      return { gravado: true, id: criado.id, ...resumo }
    },
  },
  {
    name: 'atualizar_cartao_kanban',
    description: 'Altera um cartão do Kanban: move de coluna (status), muda prioridade, responsável, prazo, título, descrição ou o motivo da pendência, ou arquiva/restaura. Pode alterar cartões de qualquer pessoa, como na tela. Duas etapas: sem confirmar=true só mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id do cartão (da ferramenta kanban)' },
      status: { type: 'string', enum: [...STATUS] }, prioridade: { type: 'string', enum: [...PRIORIDADES] },
      responsavel: { type: 'string', description: 'Nome de quem passa a cuidar' },
      prazo: { type: 'string', description: 'AAAA-MM-DD; "" limpa o prazo' },
      titulo: { type: 'string' }, descricao: { type: 'string' }, pendencia_motivo: { type: 'string' },
      arquivado: { type: 'boolean', description: 'true arquiva (some do quadro); false restaura' },
      confirmar: CONFIRMAR,
    }, required: ['id'] },
    async executar(args, ctx) {
      const atual = await buscarCartao(ctx, String(args.id ?? ''))
      const mudar: Record<string, unknown> = {}
      const antes: Record<string, unknown> = {}
      const depois: Record<string, unknown> = {}
      const registra = (campo: string, rotulo: string, novo: unknown, antigo: unknown) => {
        if (novo === antigo) return
        mudar[campo] = novo; antes[rotulo] = antigo ?? null; depois[rotulo] = novo ?? null
      }
      const status = lerStatus(args.status); if (status !== undefined) registra('status', 'coluna', status, atual.status)
      const prio = lerPrioridade(args.prioridade); if (prio !== undefined) registra('prioridade', 'prioridade', prio, atual.prioridade)
      const prazo = lerData(args.prazo); if (prazo !== undefined) registra('data', 'prazo', prazo, atual.data ?? null)
      if (args.titulo !== undefined) { const t = texto(args.titulo, 300); if (!t) throw new Error('O título não pode ficar vazio.'); registra('titulo', 'titulo', t, atual.titulo) }
      if (args.descricao !== undefined) registra('descricao', 'descricao', texto(args.descricao, 4000), atual.descricao ?? null)
      if (args.pendencia_motivo !== undefined) registra('pendencia_motivo', 'pendencia', texto(args.pendencia_motivo, 500), atual.pendencia_motivo ?? null)
      let novoRespId: string | undefined
      if (args.responsavel !== undefined) {
        const nome = texto(args.responsavel, 120)
        if (!nome) throw new Error('Informe o nome de quem passa a cuidar.')
        const p = await perfilPorNome(ctx.db, nome)
        novoRespId = p.id
        const r = um(atual.responsavel as never) as { nome?: string } | null
        if (p.id !== atual.responsavel_id) { mudar.responsavel_id = p.id; antes.responsavel = r?.nome ?? null; depois.responsavel = p.nome }
      }
      if (args.arquivado !== undefined) registra('arquivado', 'arquivado', args.arquivado === true, Boolean(atual.arquivado))
      if (!Object.keys(mudar).length) throw new Error('Diga o que mudar (status, prioridade, responsavel, prazo, titulo, descricao, pendencia_motivo ou arquivado) — ou o cartão já está assim.')
      const resumo = { cartao: `${atual.titulo}`, antes, depois }
      if (args.confirmar !== true) return previa(resumo)

      const updates: Record<string, unknown> = { ...mudar, updated_at: new Date().toISOString() }
      if (mudar.status === 'concluido') updates.concluido_em = new Date().toISOString()
      else if (mudar.status) updates.concluido_em = null
      if ('arquivado' in mudar) { updates.arquivado_em = mudar.arquivado ? new Date().toISOString() : null; updates.arquivado_por = mudar.arquivado ? ctx.userId : null }
      if (['status', 'data', 'prioridade'].some(c => c in mudar)) {
        const sla = calculateSimpleSLA({
          tipo: atual.tipo as string | null, origem: atual.origem as string,
          data: ('data' in updates ? updates.data : atual.data) as string | null,
          status: (updates.status ?? atual.status) as string, prioridade: (updates.prioridade ?? atual.prioridade) as string | null,
        })
        updates.sla_level = sla.sla_level
        updates.sla_due_at = sla.sla_due_at
      }
      const { error } = await ctx.db.from('kanban_tasks').update(updates).eq('id', atual.id)
      if (error) throw new Error(error.message)

      const statusMudou = 'status' in mudar
      const respMudou = 'responsavel_id' in mudar
      const arqMudou = 'arquivado' in mudar
      const acao = arqMudou ? (mudar.arquivado ? 'arquivamento' : 'restauracao')
        : statusMudou && respMudou ? 'status_responsavel' : statusMudou ? 'status' : respMudou ? 'responsavel' : 'edicao'
      await ctx.db.from('kanban_historico').insert({
        task_id: atual.id, usuario_id: ctx.userId, acao,
        de_status: statusMudou ? atual.status : null, para_status: statusMudou ? mudar.status : null,
        de_responsavel_id: respMudou ? atual.responsavel_id : null, para_responsavel_id: respMudou ? novoRespId : null,
      })
      return { gravado: true, ...resumo }
    },
  },
  {
    name: 'excluir_cartao_kanban',
    description: 'Exclui um cartão do Kanban (qualquer um criado no sistema, como na tela). Não exclui cartões que vieram do Trello (seriam recriados na próxima sincronização): para esses use atualizar_cartao_kanban com arquivado=true. Se o cartão está ligado a um compromisso da agenda, ele continua lá. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id do cartão (da ferramenta kanban)' }, confirmar: CONFIRMAR }, required: ['id'] },
    async executar(args, ctx) {
      const c = await buscarCartao(ctx, String(args.id ?? ''))
      if (c.origem === 'trello') throw new Error('Este cartão veio do Trello e seria recriado na próxima sincronização. Para tirá-lo do quadro, arquive: atualizar_cartao_kanban com arquivado=true (ou exclua no próprio Trello).')
      const resumo = { excluir_cartao: resumoCartao(c) }
      if (args.confirmar !== true) return previa(resumo)
      const { error } = await ctx.db.from('kanban_tasks').delete().eq('id', c.id)
      if (error) throw new Error(error.message)
      return { gravado: true, excluido: true, ...resumo }
    },
  },
]
