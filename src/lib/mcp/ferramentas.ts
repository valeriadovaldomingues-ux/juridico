// Ferramentas de LEITURA do conector MCP do PEDV (as de gravação estão em ferramentas-escrita.ts). Rodam com o cliente de serviço, mas apenas consultas e só do que os
// advogados já veem na tela (processos, agenda, prazos, publicações); nada de financeiro, nada de escrita.

type Db = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any }  // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ContextoMcp { db: Db; userId: string; nome: string; podeEscrever?: boolean }

export interface Ferramenta {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
  executar: (args: Record<string, unknown>, ctx: ContextoMcp) => Promise<unknown>
}

const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10) // data em Brasília
const soma = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86400_000).toISOString().slice(0, 10)
const dataOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const inteiro = (v: unknown, padrao: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : padrao
}
const corta = (v: unknown, n: number) => (typeof v === 'string' && v.length > n ? `${v.slice(0, n)}…` : v)
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export const FERRAMENTAS: Ferramenta[] = [
  {
    name: 'agenda',
    description: 'Compromissos da agenda (tarefas, prazos, audiências, eventos) em um período. Por padrão só os da própria pessoa, de hoje até 14 dias à frente.',
    inputSchema: { type: 'object', properties: {
      de: { type: 'string', description: 'Data inicial AAAA-MM-DD (padrão: hoje)' },
      ate: { type: 'string', description: 'Data final AAAA-MM-DD (padrão: 14 dias depois)' },
      so_meus: { type: 'boolean', description: 'true (padrão) = só os meus; false = de todos' },
    } },
    async executar(args, ctx) {
      const de = dataOk(args.de) ?? hoje()
      const ate = dataOk(args.ate) ?? soma(de, 14)
      let q = ctx.db.from('agenda_items')
        .select('id, titulo, tipo, status, data_inicio, hora_inicio, prazo_final, responsavel, descricao, processo:processos(id, numero_processo, titulo), cliente:clientes(nome)')
        .gte('data_inicio', de).lte('data_inicio', ate).neq('status', 'cancelado')
        .order('data_inicio').order('hora_inicio').limit(100)
      if (args.so_meus !== false) q = q.ilike('responsavel', `%${ctx.nome}%`)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []).map((i: Record<string, unknown>) => ({
        id: i.id, data: i.data_inicio, hora: i.hora_inicio, tipo: i.tipo, status: i.status, titulo: i.titulo,
        prazo_final: i.prazo_final, responsavel: i.responsavel, descricao: corta(i.descricao, 400),
        processo: um(i.processo as never), cliente: (um(i.cliente as never) as { nome?: string } | null)?.nome ?? null,
      }))
    },
  },
  {
    name: 'prazos',
    description: 'Prazos pendentes dos processos, por data final. Por padrão só os da própria pessoa, dos próximos 30 dias (inclui atrasados).',
    inputSchema: { type: 'object', properties: {
      dias: { type: 'number', description: 'Quantos dias à frente (padrão 30, máx. 180)' },
      so_meus: { type: 'boolean', description: 'true (padrão) = só os meus; false = de todos' },
    } },
    async executar(args, ctx) {
      const ate = soma(hoje(), inteiro(args.dias, 30, 1, 180))
      let q = ctx.db.from('prazos')
        .select('id, titulo, tipo, data_final, prioridade, status, descricao, processo:processos(id, numero_processo, titulo)')
        .eq('status', 'pendente').lte('data_final', ate).order('data_final').limit(100)
      if (args.so_meus !== false) q = q.eq('responsavel_id', ctx.userId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []).map((p: Record<string, unknown>) => ({ ...p, descricao: corta(p.descricao, 300), processo: um(p.processo as never) }))
    },
  },
  {
    name: 'buscar_processos',
    description: 'Busca processos por número, título, nome do cliente ou da parte (sem diferenciar acentos). Devolve até 20.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string', description: 'O que procurar' } }, required: ['texto'] },
    async executar(args, ctx) {
      const texto = String(args.texto ?? '').trim()
      if (texto.length < 2) throw new Error('Informe pelo menos 2 caracteres.')
      const { data: ids, error: e1 } = await ctx.db.rpc('processos_ids_busca', { q: texto })
      if (e1) throw new Error(e1.message)
      const lista = ((ids ?? []) as unknown[]).map(x => (typeof x === 'string' ? x : (x as { id?: string })?.id)).filter(Boolean).slice(0, 20)
      if (lista.length === 0) return []
      const { data, error } = await ctx.db.from('processos')
        .select('id, numero_processo, titulo, status, area_direito, cliente:clientes!cliente_id(nome)').in('id', lista)
      if (error) throw new Error(error.message)
      return (data ?? []).map((p: Record<string, unknown>) => ({ ...p, cliente: (um(p.cliente as never) as { nome?: string } | null)?.nome ?? null }))
    },
  },
  {
    name: 'ver_processo',
    description: 'Ficha de um processo: dados, cliente, partes, últimos andamentos, prazos pendentes e próximos compromissos. Use o id devolvido por buscar_processos.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id do processo' } }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Id de processo inválido.')
      const [proc, partes, andamentos, prazos, agenda] = await Promise.all([
        ctx.db.from('processos').select('id, numero_processo, titulo, status, area_direito, descricao, cliente:clientes!cliente_id(nome)').eq('id', id).maybeSingle(),
        ctx.db.from('partes_processo').select('pessoa_nome, tipo_parte').eq('processo_id', id).limit(30),
        ctx.db.from('processo_andamentos').select('data_andamento, tipo, titulo, descricao, origem').eq('processo_id', id).order('data_andamento', { ascending: false }).limit(15),
        ctx.db.from('prazos').select('titulo, tipo, data_final, prioridade').eq('processo_id', id).eq('status', 'pendente').order('data_final').limit(20),
        ctx.db.from('agenda_items').select('titulo, tipo, data_inicio, hora_inicio, responsavel').eq('processo_id', id).neq('status', 'cancelado').gte('data_inicio', hoje()).order('data_inicio').limit(20),
      ])
      if (proc.error) throw new Error(proc.error.message)
      if (!proc.data) throw new Error('Processo não encontrado.')
      const p = proc.data as Record<string, unknown>
      return {
        processo: { ...p, descricao: corta(p.descricao, 800), cliente: (um(p.cliente as never) as { nome?: string } | null)?.nome ?? null },
        partes: partes.data ?? [],
        ultimos_andamentos: (andamentos.data ?? []).map((a: Record<string, unknown>) => ({ ...a, descricao: corta(a.descricao, 500) })),
        prazos_pendentes: prazos.data ?? [],
        proximos_compromissos: agenda.data ?? [],
      }
    },
  },
  {
    name: 'publicacoes',
    description: 'Publicações capturadas (DJEN etc.) nos últimos dias, com prazo/audiência detectados e o processo vinculado. Pode filtrar por texto.',
    inputSchema: { type: 'object', properties: {
      dias: { type: 'number', description: 'Últimos quantos dias (padrão 7, máx. 60)' },
      texto: { type: 'string', description: 'Filtrar por número do processo, tribunal ou texto' },
    } },
    async executar(args, ctx) {
      const desde = soma(hoje(), -inteiro(args.dias, 7, 1, 60))
      const { data, error } = await ctx.db.from('publicacoes')
        .select('*, processo:processos(id, numero_processo, titulo)').gte('data_publicacao', desde).order('data_publicacao', { ascending: false }).limit(60)
      if (error) throw new Error(error.message)
      const q = String(args.texto ?? '').trim().toLowerCase()
      return (data ?? [])
        .filter((p: Record<string, unknown>) => !q || [p.numero_processo, p.tribunal, p.titulo, p.resumo].join(' ').toLowerCase().includes(q))
        .slice(0, 30)
        .map((p: Record<string, unknown>) => ({
          id: p.id, data_publicacao: p.data_publicacao, numero_processo: p.numero_processo, tribunal: p.tribunal, tipo: p.tipo_publicacao,
          texto: corta(p.titulo ?? p.resumo, 700), prazo_detectado: p.prazo_detectado, prazo_data: p.prazo_data,
          audiencia_detectada: p.audiencia_detectada, audiencia_data: p.audiencia_data, processo: um(p.processo as never),
        }))
    },
  },
]
