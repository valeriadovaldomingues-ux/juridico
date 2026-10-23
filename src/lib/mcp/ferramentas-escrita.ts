import type { Ferramenta } from './ferramentas'
import { ADVOGADO_RESPONSAVEL_ID, ADVOGADO_RESPONSAVEL_NOME } from '@/lib/processos/responsavel'
import { sincronizarGoogleEmSegundoPlano } from '@/lib/google/agenda-disparo'
import { criarCalendario, googleAgendaConfigurado } from '@/lib/google/calendar'
import { enviarCompromissoAoGoogle } from '@/lib/google/agenda-sync'

// Ferramentas de ESCRITA do conector MCP. Regras: (1) só quem está em MCP_USUARIOS_ESCRITA; (2) toda escrita é em duas
// etapas — sem `confirmar: true` só devolve o resumo do que seria gravado, e o Claude precisa mostrar ao usuário e
// esperar o "sim"; (3) o que é gravado leva a marca de que veio pelo Claude e quem pediu; (4) só se apaga o que o próprio
// conector criou pela mesma pessoa (excluir_compromisso) ou a ligação de uma parte com o processo (remover_parte_processo).

const UUID = /^[0-9a-f-]{36}$/i
const dataOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const horaOk = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null)
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const marca = (nome: string) => `[registrado via Claude por ${nome}]`

const AREAS = ['civil', 'trabalhista', 'criminal', 'tributario', 'previdenciario', 'administrativo', 'familia', 'empresarial', 'outro'] as const
const TIPOS_AGENDA = ['tarefa', 'prazo', 'audiencia', 'evento'] as const
const TIPOS_ANDAMENTO = ['peticao', 'decisao', 'despacho', 'audiencia', 'prazo', 'publicacao', 'juntada', 'contato_cliente', 'observacao', 'documento', 'outro'] as const

function previa(resumo: Record<string, unknown>) {
  return {
    confirmacao_necessaria: true,
    resumo,
    instrucao: 'NADA FOI GRAVADO. Mostre este resumo ao usuário e pergunte se pode gravar. Só depois do "sim" chame de novo, com os mesmos argumentos e confirmar=true.',
  }
}

const CONFIRMAR = { type: 'boolean', description: 'false/ausente = só mostra o resumo; true = grava (só depois do "sim" do usuário)' }

export const FERRAMENTAS_ESCRITA: Ferramenta[] = [
  {
    name: 'criar_andamento',
    description: 'Registra um andamento no histórico de um processo. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      processo_id: { type: 'string', description: 'Id do processo (de buscar_processos)' },
      titulo: { type: 'string' }, descricao: { type: 'string' },
      tipo: { type: 'string', enum: [...TIPOS_ANDAMENTO], description: 'Padrão: observacao' },
      data: { type: 'string', description: 'AAAA-MM-DD (padrão: hoje)' }, confirmar: CONFIRMAR,
    }, required: ['processo_id', 'titulo'] },
    async executar(args, ctx) {
      const processoId = String(args.processo_id ?? '')
      const titulo = texto(args.titulo, 300)
      if (!UUID.test(processoId) || !titulo) throw new Error('Informe o processo (id) e o título.')
      const tipo = TIPOS_ANDAMENTO.includes(args.tipo as never) ? String(args.tipo) : 'observacao'
      const data = dataOk(args.data)
      const { data: proc, error } = await ctx.db.from('processos').select('id, numero_processo, titulo').eq('id', processoId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!proc) throw new Error('Processo não encontrado.')
      const descricao = [texto(args.descricao, 4000), marca(ctx.nome)].filter(Boolean).join('\n\n')
      const resumo = { processo: `${proc.numero_processo ?? ''} ${proc.titulo ?? ''}`.trim(), tipo, titulo, descricao, data: data ?? 'hoje' }
      if (args.confirmar !== true) return previa(resumo)
      const { data: criado, error: e2 } = await ctx.db.from('processo_andamentos').insert({
        processo_id: processoId, tipo, titulo, descricao, origem: 'manual',
        data_andamento: data ? `${data}T12:00:00-03:00` : new Date().toISOString(), responsavel_id: ctx.userId, criado_por: ctx.userId,
      }).select('id').single()
      if (e2) throw new Error(e2.message)
      return { gravado: true, id: criado.id, ...resumo }
    },
  },
  {
    name: 'criar_compromisso',
    description: 'Cria um compromisso na agenda (tarefa, prazo, audiência ou evento), opcionalmente ligado a um processo. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      titulo: { type: 'string' }, tipo: { type: 'string', enum: [...TIPOS_AGENDA] },
      data_inicio: { type: 'string', description: 'AAAA-MM-DD' }, hora_inicio: { type: 'string', description: 'HH:MM (opcional)' },
      prazo_final: { type: 'string', description: 'AAAA-MM-DD (para prazos; padrão = data_inicio)' },
      processo_id: { type: 'string', description: 'Id do processo (opcional)' },
      responsavel: { type: 'string', description: 'Nome (padrão: quem está pedindo). Para audiência, até 2 nomes separados por " / "' },
      prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] }, descricao: { type: 'string' }, confirmar: CONFIRMAR,
    }, required: ['titulo', 'tipo', 'data_inicio'] },
    async executar(args, ctx) {
      const titulo = texto(args.titulo, 300)
      const tipo = TIPOS_AGENDA.find(t => t === args.tipo)
      const dataInicio = dataOk(args.data_inicio)
      if (!titulo || !tipo || !dataInicio) throw new Error('Informe título, tipo (tarefa, prazo, audiencia ou evento) e data_inicio (AAAA-MM-DD).')
      const hora = horaOk(args.hora_inicio)
      let processo: { id: string; numero_processo: string | null; titulo: string | null; cliente_id: string | null } | null = null
      if (args.processo_id) {
        if (!UUID.test(String(args.processo_id))) throw new Error('Id de processo inválido.')
        const { data, error } = await ctx.db.from('processos').select('id, numero_processo, titulo, cliente_id').eq('id', String(args.processo_id)).maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) throw new Error('Processo não encontrado.')
        processo = data
      }
      const limite = tipo === 'audiencia' ? 2 : 1
      const responsavel = (texto(args.responsavel, 200) ?? ctx.nome).split(' / ').map(n => n.trim()).filter(Boolean).slice(0, limite).join(' / ')
      const prioridade = ['baixa', 'media', 'alta'].includes(String(args.prioridade)) ? String(args.prioridade) : 'media'
      const descricao = [texto(args.descricao, 2000), marca(ctx.nome)].filter(Boolean).join('\n\n')
      const resumo = {
        tipo, titulo, data_inicio: dataInicio, hora_inicio: hora, prazo_final: tipo === 'prazo' ? (dataOk(args.prazo_final) ?? dataInicio) : null,
        responsavel, prioridade, processo: processo ? `${processo.numero_processo ?? ''} ${processo.titulo ?? ''}`.trim() : null, descricao,
      }
      if (args.confirmar !== true) return previa(resumo)
      const { data: criado, error } = await ctx.db.from('agenda_items').insert({
        titulo, descricao, tipo, status: 'pendente', data_inicio: dataInicio, hora_inicio: hora, prazo_final: resumo.prazo_final,
        prioridade, processo_id: processo?.id ?? null, cliente_id: processo?.cliente_id ?? null, responsavel,
      }).select('id').single()
      if (error) throw new Error(error.message)
      sincronizarGoogleEmSegundoPlano()
      return { gravado: true, id: criado.id, ...resumo }
    },
  },
  {
    name: 'concluir_compromisso',
    description: 'Marca um compromisso da agenda como concluído. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id do compromisso (da ferramenta agenda)' }, confirmar: CONFIRMAR }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de compromisso inválido.')
      const { data: item, error } = await ctx.db.from('agenda_items').select('id, titulo, tipo, status, data_inicio').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!item) throw new Error('Compromisso não encontrado.')
      if (item.status === 'concluido') return { gravado: false, aviso: 'Já estava concluído.', compromisso: item }
      const resumo = { compromisso: `${item.tipo}: ${item.titulo} (${item.data_inicio})`, de: item.status, para: 'concluido' }
      if (args.confirmar !== true) return previa(resumo)
      const { error: e2 } = await ctx.db.from('agenda_items').update({ status: 'concluido' }).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, ...resumo }
    },
  },
  {
    name: 'excluir_compromisso',
    description: 'Exclui um compromisso da agenda, mas SÓ um que foi criado por este conector pela própria pessoa (com a marca "registrado via Claude"), ainda pendente — serve para desfazer um lançamento errado ou de teste. Não apaga compromissos feitos pelo sistema ou por outras pessoas. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id do compromisso (da ferramenta agenda)' }, confirmar: CONFIRMAR }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de compromisso inválido.')
      const { data: item, error } = await ctx.db.from('agenda_items').select('id, titulo, tipo, status, data_inicio, descricao').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!item) throw new Error('Compromisso não encontrado.')
      if (!String(item.descricao ?? '').includes(marca(ctx.nome))) throw new Error('Só posso excluir compromissos criados por este conector por você. Este foi criado de outra forma: exclua pela tela da agenda.')
      if (item.status === 'concluido') throw new Error('Este compromisso já foi concluído; para não perder o histórico, não é excluído por aqui.')
      const resumo = { excluir: `${item.tipo}: ${item.titulo} (${item.data_inicio})` }
      if (args.confirmar !== true) return previa(resumo)
      const { error: e2 } = await ctx.db.from('agenda_items').delete().eq('id', id)
      if (e2) throw new Error(e2.message)
      sincronizarGoogleEmSegundoPlano()
      return { gravado: true, excluido: true, ...resumo }
    },
  },
  {
    name: 'definir_quem_cuida_do_caso',
    description: 'Define quem cuida do caso (o advogado que toca o processo no dia a dia). O advogado responsável é sempre a Valéria e não muda. Passe advogado vazio para deixar sem ninguém. Duas etapas: sem confirmar=true mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      processo_id: { type: 'string' }, advogado: { type: 'string', description: 'Nome (ou parte do nome) de quem vai cuidar do caso; vazio para limpar' }, confirmar: CONFIRMAR,
    }, required: ['processo_id'] },
    async executar(args, ctx) {
      const id = String(args.processo_id ?? '')
      const nome = texto(args.advogado, 120)
      if (!UUID.test(id)) throw new Error('Informe o processo (id).')
      const { data: proc, error } = await ctx.db.from('processos').select('id, numero_processo, titulo, advogado_caso_id').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!proc) throw new Error('Processo não encontrado.')
      let novoId: string | null = null
      let depois: string | null = null
      if (nome) {
        const { data: perfis } = await ctx.db.from('profiles').select('id, nome').eq('ativo', true).ilike('nome', `%${nome}%`).limit(5)
        if (!perfis?.length) throw new Error(`Não encontrei usuário ativo com o nome "${nome}".`)
        if (perfis.length > 1) throw new Error(`Mais de um usuário com esse nome: ${perfis.map((p: { nome: string }) => p.nome).join(', ')}. Informe o nome completo.`)
        novoId = perfis[0].id
        depois = perfis[0].nome
      }
      let antes: string | null = null
      if (proc.advogado_caso_id) {
        const { data: a } = await ctx.db.from('profiles').select('nome').eq('id', proc.advogado_caso_id).maybeSingle()
        antes = a?.nome ?? null
      }
      const resumo = { processo: `${proc.numero_processo ?? ''} ${proc.titulo ?? ''}`.trim(), advogado_responsavel: ADVOGADO_RESPONSAVEL_NOME, quem_cuida_do_caso: { antes, depois } }
      if (args.confirmar !== true) return previa(resumo)
      const { error: e2 } = await ctx.db.from('processos').update({ advogado_caso_id: novoId }).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, ...resumo }
    },
  },
  {
    name: 'atualizar_compromisso',
    description: 'Edita um compromisso da agenda (título, tipo, data, hora, prazo final, prioridade, responsável, descrição) e/ou o vincula a um processo. Duas etapas: sem confirmar=true mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id do compromisso (da ferramenta agenda)' }, titulo: { type: 'string' }, tipo: { type: 'string', enum: [...TIPOS_AGENDA] },
      data_inicio: { type: 'string', description: 'AAAA-MM-DD' }, hora_inicio: { type: 'string', description: 'HH:MM' }, prazo_final: { type: 'string', description: 'AAAA-MM-DD' },
      prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] }, responsavel: { type: 'string' }, descricao: { type: 'string' },
      processo_id: { type: 'string', description: 'Vincula ao processo (id). O cliente do compromisso passa a ser o do processo.' }, confirmar: CONFIRMAR,
    }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de compromisso inválido.')
      const novo: Record<string, unknown> = {}
      const t = texto(args.titulo, 300); if (t) novo.titulo = t
      if (args.tipo !== undefined) { const tp = TIPOS_AGENDA.find(x => x === args.tipo); if (!tp) throw new Error('tipo inválido (tarefa, prazo, audiencia ou evento).'); novo.tipo = tp }
      if (args.data_inicio !== undefined) { const d = dataOk(args.data_inicio); if (!d) throw new Error('data_inicio: use AAAA-MM-DD.'); novo.data_inicio = d }
      if (args.hora_inicio !== undefined) { const h = horaOk(args.hora_inicio); if (!h) throw new Error('hora_inicio: use HH:MM.'); novo.hora_inicio = h }
      if (args.prazo_final !== undefined) { const d = dataOk(args.prazo_final); if (!d) throw new Error('prazo_final: use AAAA-MM-DD.'); novo.prazo_final = d }
      if (args.prioridade !== undefined) { if (!['baixa', 'media', 'alta'].includes(String(args.prioridade))) throw new Error('prioridade inválida.'); novo.prioridade = args.prioridade }
      const r = texto(args.responsavel, 200); if (r) novo.responsavel = r.split(' / ').map(n => n.trim()).filter(Boolean).slice(0, 2).join(' / ')
      const d = texto(args.descricao, 2000); if (d) novo.descricao = `${d}\n\n${marca(ctx.nome)}`
      let processo: { id: string; numero_processo: string | null; titulo: string | null; cliente_id: string | null } | null = null
      if (args.processo_id !== undefined) {
        if (!UUID.test(String(args.processo_id))) throw new Error('Id de processo inválido.')
        const { data: p, error: ep } = await ctx.db.from('processos').select('id, numero_processo, titulo, cliente_id').eq('id', String(args.processo_id)).maybeSingle()
        if (ep) throw new Error(ep.message)
        if (!p) throw new Error('Processo não encontrado.')
        processo = p; novo.processo_id = p.id; novo.cliente_id = p.cliente_id
      }
      if (Object.keys(novo).length === 0) throw new Error('Informe ao menos um campo para alterar.')
      const colunas = Object.keys(novo).filter(k => k !== 'cliente_id')
      const { data: atual, error } = await ctx.db.from('agenda_items').select(['id', ...colunas].join(', ')).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!atual) throw new Error('Compromisso não encontrado.')
      const mudancas = Object.fromEntries(colunas.map(k => [k, { antes: (atual as Record<string, unknown>)[k] ?? null, depois: k === 'processo_id' && processo ? `${processo.numero_processo ?? ''} ${processo.titulo ?? ''}`.trim() : novo[k] }]))
      if (args.confirmar !== true) return previa({ compromisso_id: id, mudancas })
      const { error: e2 } = await ctx.db.from('agenda_items').update(novo).eq('id', id)
      if (e2) throw new Error(e2.message)
      sincronizarGoogleEmSegundoPlano()
      return { gravado: true, compromisso_id: id, mudancas }
    },
  },
  {
    name: 'atualizar_parte_processo',
    description: 'Corrige uma parte de um processo (nome, tipo autor/reu/terceiro/outro, documento). Use o id da parte devolvido por ver_processo. Duas etapas: sem confirmar=true mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id da parte (de ver_processo)' }, nome: { type: 'string' },
      tipo_parte: { type: 'string', enum: ['autor', 'reu', 'terceiro', 'outro'] }, documento: { type: 'string' }, confirmar: CONFIRMAR,
    }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de parte inválido.')
      const novo: Record<string, unknown> = {}
      const n = texto(args.nome, 200); if (n) novo.pessoa_nome = n
      if (args.tipo_parte !== undefined) { const tp = ['autor', 'reu', 'terceiro', 'outro'].find(x => x === args.tipo_parte); if (!tp) throw new Error('tipo_parte inválido (autor, reu, terceiro ou outro).'); novo.tipo_parte = tp }
      const dc = texto(args.documento, 30); if (dc) novo.documento = dc
      if (Object.keys(novo).length === 0) throw new Error('Informe ao menos um campo para alterar.')
      const { data: atual, error } = await ctx.db.from('partes_processo').select(['id', 'processo_id', ...Object.keys(novo)].join(', ')).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!atual) throw new Error('Parte não encontrada.')
      const mudancas = Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, { antes: (atual as Record<string, unknown>)[k] ?? null, depois: v }]))
      if (args.confirmar !== true) return previa({ parte_id: id, mudancas })
      const { error: e2 } = await ctx.db.from('partes_processo').update(novo).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, parte_id: id, mudancas }
    },
  },
  {
    name: 'remover_parte_processo',
    description: 'Remove uma parte de um processo (só a ligação da parte com o processo, não a pessoa). Use o id da parte devolvido por ver_processo. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id da parte (de ver_processo)' }, confirmar: CONFIRMAR }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de parte inválido.')
      const { data: parte, error } = await ctx.db.from('partes_processo').select('id, processo_id, pessoa_nome, tipo_parte, documento').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!parte) throw new Error('Parte não encontrada.')
      const resumo = { remover_parte: { nome: parte.pessoa_nome, tipo_parte: parte.tipo_parte, documento: parte.documento ?? null }, processo_id: parte.processo_id }
      if (args.confirmar !== true) return previa(resumo)
      const { error: e2 } = await ctx.db.from('partes_processo').delete().eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, removida: true, ...resumo }
    },
  },
  {
    name: 'enviar_ao_google',
    description: 'Envia UM compromisso (prazo ou audiência) ao Google Agenda pedvprazos, no formato do escritório. É o caminho para compromissos ANTIGOS, que não vão sozinhos. Já criados depois da ativação vão automaticamente. Duas etapas: sem confirmar=true só mostra como ficaria o evento.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id do compromisso (da ferramenta agenda)' }, confirmar: CONFIRMAR }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de compromisso inválido.')
      if (!googleAgendaConfigurado()) throw new Error('O Google Agenda ainda não foi configurado no sistema.')
      const { data: item, error } = await ctx.db.from('agenda_items').select('id, titulo, tipo, status, data_inicio, hora_inicio, google_event_id').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!item) throw new Error('Compromisso não encontrado.')
      if (!['prazo', 'prazo_processual', 'audiencia', 'pericia'].includes(item.tipo)) throw new Error('Só prazos e audiências/perícias vão para o Google Agenda.')
      const resumo = { compromisso: `${item.tipo}: ${item.titulo} (${item.data_inicio}${item.hora_inicio ? ` ${String(item.hora_inicio).slice(0, 5)}` : ''})`, ja_no_google: !!item.google_event_id }
      if (args.confirmar !== true) return previa(resumo)
      const r = await enviarCompromissoAoGoogle(ctx.db, criarCalendario(), id)
      if (!r.ok) throw new Error(r.erro)
      return { gravado: true, ...resumo, google: r.acao, evento_id: r.eventoId }
    },
  },
  {
    name: 'cadastrar_cliente',
    description: 'Cadastra um cliente novo (nome obrigatório). Recusa se já existir cliente com o mesmo CPF/CNPJ. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      nome: { type: 'string' }, tipo_pessoa: { type: 'string', enum: ['fisica', 'juridica'] }, cpf_cnpj: { type: 'string' },
      email: { type: 'string' }, telefone: { type: 'string' }, celular: { type: 'string' },
      cep: { type: 'string' }, endereco: { type: 'string' }, numero: { type: 'string' }, complemento: { type: 'string' },
      bairro: { type: 'string' }, cidade: { type: 'string' }, uf: { type: 'string' }, observacoes: { type: 'string' }, confirmar: CONFIRMAR,
    }, required: ['nome'] },
    async executar(args, ctx) {
      const nome = texto(args.nome, 200)
      if (!nome) throw new Error('Informe o nome do cliente.')
      const doc = texto(args.cpf_cnpj, 30)
      const digitos = (doc ?? '').replace(/\D/g, '')
      if (doc && digitos.length !== 11 && digitos.length !== 14) throw new Error('CPF/CNPJ inválido: use 11 ou 14 dígitos.')
      if (digitos) {
        const { data: igual } = await ctx.db.from('clientes').select('id, nome').or(`cpf_cnpj.eq.${doc},cpf_cnpj.eq.${digitos}`).limit(1)
        if (igual?.length) throw new Error(`Já existe cliente com este CPF/CNPJ: ${igual[0].nome} (id ${igual[0].id}).`)
      }
      const { data: parecidos } = await ctx.db.from('clientes').select('id, nome').ilike('nome', nome).limit(3)
      const dados = {
        nome, tipo_pessoa: args.tipo_pessoa === 'juridica' || digitos.length === 14 ? 'juridica' : 'fisica', cpf_cnpj: doc,
        email: texto(args.email, 200), telefone: texto(args.telefone, 30), celular: texto(args.celular, 30),
        cep: texto(args.cep, 12), endereco: texto(args.endereco, 200), numero: texto(args.numero, 20), complemento: texto(args.complemento, 100),
        bairro: texto(args.bairro, 100), cidade: texto(args.cidade, 100), uf: texto(args.uf, 2)?.toUpperCase() ?? null,
        observacoes: [texto(args.observacoes, 2000), marca(ctx.nome)].filter(Boolean).join('\n\n'),
      }
      if (args.confirmar !== true) return { ...previa(dados), ...(parecidos?.length ? { atencao: 'Já há cliente com nome igual/parecido; confirme que não é duplicado.', parecidos } : {}) }
      const { data: criado, error } = await ctx.db.from('clientes').insert({ ...dados, tipo_contato: 'cliente', ativo: true }).select('id').single()
      if (error) throw new Error(error.message)
      return { gravado: true, id: criado.id, ...dados }
    },
  },
  {
    name: 'atualizar_cliente',
    description: 'Preenche ou corrige dados de um cliente já cadastrado (só os campos informados). Duas etapas: sem confirmar=true mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id do cliente' },
      nome: { type: 'string' }, tipo_pessoa: { type: 'string', enum: ['fisica', 'juridica'] }, cpf_cnpj: { type: 'string' },
      email: { type: 'string' }, telefone: { type: 'string' }, celular: { type: 'string' },
      cep: { type: 'string' }, endereco: { type: 'string' }, numero: { type: 'string' }, complemento: { type: 'string' },
      bairro: { type: 'string' }, cidade: { type: 'string' }, uf: { type: 'string' }, observacoes: { type: 'string' }, confirmar: CONFIRMAR,
    }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de cliente inválido.')
      const campos = ['nome', 'tipo_pessoa', 'cpf_cnpj', 'email', 'telefone', 'celular', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'observacoes']
      const novo: Record<string, unknown> = {}
      for (const c of campos) {
        if (args[c] === undefined) continue
        const v = texto(args[c], c === 'observacoes' ? 4000 : 200)
        if (v === null) continue
        novo[c] = c === 'uf' ? v.slice(0, 2).toUpperCase() : v
      }
      if (novo.tipo_pessoa && !['fisica', 'juridica'].includes(String(novo.tipo_pessoa))) throw new Error('tipo_pessoa: use fisica ou juridica.')
      const digitos = String(novo.cpf_cnpj ?? '').replace(/\D/g, '')
      if (novo.cpf_cnpj && digitos.length !== 11 && digitos.length !== 14) throw new Error('CPF/CNPJ inválido: use 11 ou 14 dígitos.')
      if (Object.keys(novo).length === 0) throw new Error('Informe ao menos um campo para atualizar.')
      const { data: atual, error } = await ctx.db.from('clientes').select(['id', ...Object.keys(novo)].join(', ')).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!atual) throw new Error('Cliente não encontrado.')
      if (digitos) {
        const { data: igual } = await ctx.db.from('clientes').select('id, nome').or(`cpf_cnpj.eq.${novo.cpf_cnpj},cpf_cnpj.eq.${digitos}`).neq('id', id).limit(1)
        if (igual?.length) throw new Error(`Já existe outro cliente com este CPF/CNPJ: ${igual[0].nome} (id ${igual[0].id}).`)
      }
      const mudancas = Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, { antes: (atual as Record<string, unknown>)[k] ?? null, depois: v }]))
      if (args.confirmar !== true) return previa({ cliente_id: id, mudancas })
      const { error: e2 } = await ctx.db.from('clientes').update(novo).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, cliente_id: id, mudancas }
    },
  },
  {
    name: 'cadastrar_processo',
    description: 'Cadastra um processo novo para um cliente já cadastrado. Recusa se o número já existir. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      titulo: { type: 'string' }, cliente_id: { type: 'string', description: 'Id do cliente' }, numero_processo: { type: 'string' },
      area_direito: { type: 'string', enum: [...AREAS], description: 'Padrão: civil' },
      fase: { type: 'string' }, tribunal: { type: 'string' }, vara: { type: 'string' }, comarca: { type: 'string' }, classe_processual: { type: 'string' },
      assunto: { type: 'string' }, valor_causa: { type: 'number' }, data_distribuicao: { type: 'string', description: 'AAAA-MM-DD' }, observacoes: { type: 'string' },
      quem_cuida: { type: 'string', description: 'Nome de quem vai cuidar do caso (opcional). O advogado responsável é sempre a Valéria.' },
      confirmar: CONFIRMAR,
    }, required: ['titulo', 'cliente_id'] },
    async executar(args, ctx) {
      const titulo = texto(args.titulo, 300)
      const clienteId = String(args.cliente_id ?? '')
      if (!titulo || !UUID.test(clienteId)) throw new Error('Informe o título e o cliente (id).')
      const { data: cliente } = await ctx.db.from('clientes').select('id, nome').eq('id', clienteId).maybeSingle()
      if (!cliente) throw new Error('Cliente não encontrado.')
      const numero = texto(args.numero_processo, 40)
      const dig = (numero ?? '').replace(/\D/g, '')
      if (dig) {
        const { data: igual } = await ctx.db.from('processos').select('id, titulo, numero_processo').or(`numero_processo.eq.${numero},numero_processo.eq.${dig}`).limit(1)
        if (igual?.length) throw new Error(`Já existe processo com este número: ${igual[0].titulo} (id ${igual[0].id}).`)
      }
      const area = AREAS.find(a => a === args.area_direito) ?? 'civil'
      const valor = args.valor_causa === undefined || args.valor_causa === null ? null : Number(args.valor_causa)
      if (valor !== null && !Number.isFinite(valor)) throw new Error('valor_causa inválido.')
      // Advogado responsável é sempre a Valéria; "quem cuida do caso" é opcional (um só usuário ativo)
      let quemCuidaId: string | null = null
      let quemCuidaNome: string | null = null
      const nomeCuida = texto(args.quem_cuida, 120)
      if (nomeCuida) {
        const { data: perfis } = await ctx.db.from('profiles').select('id, nome').eq('ativo', true).ilike('nome', `%${nomeCuida}%`).limit(5)
        if (!perfis?.length) throw new Error(`Não encontrei usuário ativo com o nome "${nomeCuida}".`)
        if (perfis.length > 1) throw new Error(`Mais de um usuário com esse nome: ${perfis.map((p: { nome: string }) => p.nome).join(', ')}. Informe o nome completo.`)
        quemCuidaId = perfis[0].id
        quemCuidaNome = perfis[0].nome
      }
      const dados = {
        titulo, cliente_id: clienteId, numero_processo: numero, area_direito: area, status: 'ativo', fase: texto(args.fase, 100),
        tribunal: texto(args.tribunal, 100), vara: texto(args.vara, 150), comarca: texto(args.comarca, 100), classe_processual: texto(args.classe_processual, 150),
        assunto: texto(args.assunto, 200), valor_causa: valor, data_distribuicao: dataOk(args.data_distribuicao),
        observacoes: [texto(args.observacoes, 4000), marca(ctx.nome)].filter(Boolean).join('\n\n'), advogado_responsavel_id: ADVOGADO_RESPONSAVEL_ID, advogado_caso_id: quemCuidaId,
      }
      if (args.confirmar !== true) return previa({ cliente: cliente.nome, advogado_responsavel: ADVOGADO_RESPONSAVEL_NOME, quem_cuida: quemCuidaNome, ...dados })
      const { data: criado, error } = await ctx.db.from('processos').insert(dados).select('id').single()
      if (error) throw new Error(error.message)
      return { gravado: true, id: criado.id, cliente: cliente.nome, advogado_responsavel: ADVOGADO_RESPONSAVEL_NOME, quem_cuida: quemCuidaNome, ...dados }
    },
  },
  {
    name: 'atualizar_processo',
    description: 'Atualiza dados de um processo (só os campos informados): título, número, área, status, fase, tribunal, vara, comarca, classe, assunto, valor da causa, distribuição, observações. Duas etapas: sem confirmar=true mostra o antes e o depois.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id do processo' }, titulo: { type: 'string' }, numero_processo: { type: 'string' },
      area_direito: { type: 'string', enum: [...AREAS] }, status: { type: 'string', enum: ['ativo', 'suspenso', 'arquivado', 'encerrado'] },
      fase: { type: 'string' }, tribunal: { type: 'string' }, vara: { type: 'string' }, comarca: { type: 'string' }, classe_processual: { type: 'string' },
      assunto: { type: 'string' }, valor_causa: { type: 'number' }, data_distribuicao: { type: 'string' }, observacoes: { type: 'string' }, confirmar: CONFIRMAR,
    }, required: ['id'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      if (!UUID.test(id)) throw new Error('Id de processo inválido.')
      const novo: Record<string, unknown> = {}
      for (const c of ['titulo', 'numero_processo', 'fase', 'tribunal', 'vara', 'comarca', 'classe_processual', 'assunto', 'observacoes']) {
        const v = texto(args[c], c === 'observacoes' ? 4000 : 300)
        if (v !== null) novo[c] = v
      }
      if (args.area_direito !== undefined) { const a = AREAS.find(x => x === args.area_direito); if (!a) throw new Error('area_direito inválida.'); novo.area_direito = a }
      if (args.status !== undefined) { if (!['ativo', 'suspenso', 'arquivado', 'encerrado'].includes(String(args.status))) throw new Error('status inválido.'); novo.status = args.status }
      if (args.valor_causa !== undefined) { const v = Number(args.valor_causa); if (!Number.isFinite(v)) throw new Error('valor_causa inválido.'); novo.valor_causa = v }
      if (args.data_distribuicao !== undefined) { const d = dataOk(args.data_distribuicao); if (!d) throw new Error('data_distribuicao: use AAAA-MM-DD.'); novo.data_distribuicao = d }
      if (Object.keys(novo).length === 0) throw new Error('Informe ao menos um campo para atualizar.')
      const { data: atual, error } = await ctx.db.from('processos').select(['id', ...Object.keys(novo)].join(', ')).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!atual) throw new Error('Processo não encontrado.')
      const mudancas = Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, { antes: (atual as Record<string, unknown>)[k] ?? null, depois: v }]))
      if (args.confirmar !== true) return previa({ processo_id: id, mudancas })
      const { error: e2 } = await ctx.db.from('processos').update(novo).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, processo_id: id, mudancas }
    },
  },
  {
    name: 'adicionar_parte_processo',
    description: 'Adiciona uma parte (autor, réu, terceiro, outro) a um processo. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      processo_id: { type: 'string' }, nome: { type: 'string' }, tipo_parte: { type: 'string', enum: ['autor', 'reu', 'terceiro', 'outro'] },
      documento: { type: 'string', description: 'CPF/CNPJ (opcional)' }, confirmar: CONFIRMAR,
    }, required: ['processo_id', 'nome', 'tipo_parte'] },
    async executar(args, ctx) {
      const processoId = String(args.processo_id ?? '')
      const nome = texto(args.nome, 200)
      const tipo = ['autor', 'reu', 'terceiro', 'outro'].find(t => t === args.tipo_parte)
      if (!UUID.test(processoId) || !nome || !tipo) throw new Error('Informe o processo (id), o nome e o tipo da parte (autor, reu, terceiro ou outro).')
      const { data: proc } = await ctx.db.from('processos').select('id, numero_processo, titulo').eq('id', processoId).maybeSingle()
      if (!proc) throw new Error('Processo não encontrado.')
      const { data: ja } = await ctx.db.from('partes_processo').select('id').eq('processo_id', processoId).ilike('pessoa_nome', nome).limit(1)
      if (ja?.length) throw new Error('Esta parte já está cadastrada neste processo.')
      const dados = { processo_id: processoId, pessoa_nome: nome, tipo_parte: tipo, documento: texto(args.documento, 30) }
      const resumo = { processo: `${proc.numero_processo ?? ''} ${proc.titulo ?? ''}`.trim(), nome, tipo_parte: tipo, documento: dados.documento }
      if (args.confirmar !== true) return previa(resumo)
      const { data: criada, error } = await ctx.db.from('partes_processo').insert(dados).select('id').single()
      if (error) throw new Error(error.message)
      return { gravado: true, id: criada.id, ...resumo }
    },
  },
  {
    name: 'tratar_publicacao',
    description: 'Marca uma publicação como tratada ou descartada. Duas etapas: sem confirmar=true só mostra o resumo.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Id da publicação (da ferramenta publicacoes)' }, status: { type: 'string', enum: ['tratada', 'descartada'] }, confirmar: CONFIRMAR,
    }, required: ['id', 'status'] },
    async executar(args, ctx) {
      const id = String(args.id ?? '')
      const status = ['tratada', 'descartada'].find(t => t === args.status)
      if (!UUID.test(id) || !status) throw new Error('Informe o id da publicação e o status (tratada ou descartada).')
      const { data: pub, error } = await ctx.db.from('publicacoes').select('id, numero_processo, tribunal, status').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!pub) throw new Error('Publicação não encontrada.')
      const resumo = { publicacao: `${pub.tribunal ?? ''} ${pub.numero_processo ?? ''}`.trim(), de: pub.status, para: status }
      if (args.confirmar !== true) return previa(resumo)
      const { error: e2 } = await ctx.db.from('publicacoes').update({ status }).eq('id', id)
      if (e2) throw new Error(e2.message)
      return { gravado: true, ...resumo }
    },
  },
]
