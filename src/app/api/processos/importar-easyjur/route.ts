import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'
import type { EasyJurProcesso, EasyJurImportLog, EasyJurImportResult } from '@/types/easyjur'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// ── Mapeamentos ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'ativo': 'ativo', 'em andamento': 'ativo', 'em_andamento': 'ativo',
  'substabelecido': 'ativo', 'em tramitação': 'ativo',
  'suspenso': 'suspenso', 'suspenso parado': 'suspenso', 'paralisado': 'suspenso',
  'aguardando': 'suspenso', 'ativo parado': 'suspenso',
  'arquivado': 'arquivado', 'arquivada': 'arquivado',
  'encerrado': 'encerrado', 'encerrada': 'encerrado', 'baixado': 'encerrado',
  'concluido': 'encerrado', 'concluída': 'encerrado', 'acordo': 'encerrado',
}

const AREA_MAP: Record<string, string> = {
  'trabalhista': 'trabalhista', 'trabalho': 'trabalhista',
  'civil': 'civil', 'cível': 'civil', 'civel': 'civil',
  'criminal': 'criminal', 'penal': 'criminal',
  'tributario': 'tributario', 'tributário': 'tributario', 'fiscal': 'tributario',
  'previdenciario': 'previdenciario', 'previdenciário': 'previdenciario', 'inss': 'previdenciario',
  'administrativo': 'administrativo',
  'familia': 'familia', 'família': 'familia',
  'empresarial': 'empresarial', 'societario': 'empresarial',
}

function mapStatus(raw: string | null): string {
  if (!raw) return 'ativo'
  return STATUS_MAP[raw.toLowerCase().trim()] ?? 'ativo'
}

function mapArea(raw: string | null): string {
  if (!raw) return 'outro'
  const k = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  return AREA_MAP[k] ?? 'outro'
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

function parseDataBr(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// ── POST /api/processos/importar-easyjur ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.processos)) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const processos: EasyJurProcesso[] = body.processos
  const arquivoNome: string = body.arquivo_nome ?? 'desconhecido'
  const criarKanban: boolean = body.criar_kanban ?? false
  const import_batch_id = crypto.randomUUID()
  const supabase = await createClient()

  // ── Pré-carrega lookup de perfis ──────────────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles').select('id, nome').eq('ativo', true)

  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileMap[norm(p.nome)] = p.id
    // Token final do nome (para match parcial: "Dr. Carlos Menezes" → "menezes")
    const token = norm(p.nome).split(/\s+/).pop()!
    if (!profileMap[token]) profileMap[token] = p.id
  }

  function resolverResponsavel(nomeRaw: string | null): string | null {
    if (!nomeRaw) return null
    const n = norm(nomeRaw)
    // Busca exata
    if (profileMap[n]) return profileMap[n]
    // Busca por token contido
    const entry = Object.entries(profileMap).find(([k]) => n.includes(k) || k.includes(n))
    return entry?.[1] ?? null
  }

  // ── Pré-carrega processos existentes ──────────────────────────────────────
  const { data: existentes } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, observacoes, cliente_id, advogado_responsavel_id, status')

  const existByNum: Record<string, { id: string; observacoes: string | null; cliente_id: string | null; advogado_responsavel_id: string | null }> = {}
  for (const p of existentes ?? []) {
    if (p.numero_processo) existByNum[p.numero_processo.trim()] = p
  }

  // ── Contadores ────────────────────────────────────────────────────────────
  let criados = 0, atualizados = 0, ignorados = 0, erros = 0
  let prazosInseridos = 0, partesInseridas = 0, kanbanCriadas = 0
  const log: EasyJurImportLog[] = []

  for (const proc of processos) {
    const num = proc.numero_processo?.trim() ?? null
    if (!num) { erros++; log.push({ numero_processo: null, acao: 'erro', mensagem: 'Sem número de processo.' }); continue }

    try {
      // ── Resolver cliente ──────────────────────────────────────────────────
      let clienteId: string | null = null
      if (proc.cliente) {
        const { data: cli } = await supabase
          .from('clientes').select('id')
          .ilike('nome', `%${proc.cliente.trim()}%`)
          .eq('ativo', true).limit(1).maybeSingle()

        if (cli) {
          clienteId = cli.id
        } else {
          const tipoPessoa = proc.cpf_cnpj_cliente?.replace(/\D/g, '').length === 14 ? 'juridica' : 'fisica'
          const { data: novo } = await supabase.from('clientes').insert({
            nome: proc.cliente.trim(),
            cpf_cnpj: proc.cpf_cnpj_cliente ?? null,
            tipo_pessoa: tipoPessoa,
            tipo_contato: 'cliente',
            ativo: true,
          }).select('id').single()
          clienteId = novo?.id ?? null
        }
      }

      // ── Resolver responsável ──────────────────────────────────────────────
      const responsavelId = resolverResponsavel(proc.responsavel)
      if (proc.responsavel && !responsavelId) {
        log.push({ numero_processo: num, acao: 'ignorado', mensagem: `Responsável "${proc.responsavel}" não encontrado — tarefa importada sem atribuição.` })
      }

      // ── Texto de observações com andamentos ───────────────────────────────
      const andTxt = proc.andamentos.length > 0
        ? '\n\n[Andamentos EasyJur]\n' +
          proc.andamentos.slice(0, 15).map(a =>
            [a.data, a.tipo, a.descricao].filter(Boolean).join(' | ')
          ).join('\n')
        : ''
      const ultiTxt = proc.ultimo_andamento ? `Último andamento: ${proc.ultimo_andamento}\n` : ''
      const obsExtra = [ultiTxt, andTxt].filter(Boolean).join('')

      // ── Campos extras para observações (tipo ação, fase, etc.) ───────────
      const extra = (proc as EasyJurProcesso & { _extra?: Record<string, string | null> })._extra
      const extraTxt = extra ? [
        extra.tipo_acao        ? `Tipo de ação: ${extra.tipo_acao}`        : '',
        extra.fase_processual  ? `Fase: ${extra.fase_processual}`          : '',
        extra.instancia        ? `Instância: ${extra.instancia}`           : '',
        extra.valor_causa      ? `Valor da causa: ${extra.valor_causa}`    : '',
        extra.data_distribuicao ? `Distribuído em: ${extra.data_distribuicao}` : '',
        extra.observacoes      ? `Obs: ${extra.observacoes}`               : '',
      ].filter(Boolean).join('\n') : ''

      const existing = existByNum[num]
      let processoId: string

      if (existing) {
        // ── ATUALIZA ──────────────────────────────────────────────────────
        processoId = existing.id
        const upd: Record<string, unknown> = {}
        const atualizados_campos: string[] = []

        if (clienteId && !existing.cliente_id)                  { upd.cliente_id = clienteId; atualizados_campos.push('cliente') }
        if (responsavelId && !existing.advogado_responsavel_id) { upd.advogado_responsavel_id = responsavelId; atualizados_campos.push('responsavel') }
        if (proc.tribunal)  { upd.tribunal = proc.tribunal; atualizados_campos.push('tribunal') }
        if (proc.vara)      { upd.vara = proc.vara; atualizados_campos.push('vara') }
        if (obsExtra || extraTxt) {
          upd.observacoes = [existing.observacoes, obsExtra, extraTxt].filter(Boolean).join('\n').trim()
          atualizados_campos.push('observacoes')
        }

        if (atualizados_campos.length > 0) {
          await supabase.from('processos').update(upd).eq('id', existing.id)
          atualizados++
          log.push({ numero_processo: num, acao: 'atualizado', mensagem: 'Atualizado.', campos_atualizados: atualizados_campos })
        } else {
          ignorados++
          log.push({ numero_processo: num, acao: 'ignorado', mensagem: 'Sem campos novos para atualizar.' })
        }
      } else {
        // ── CRIA ──────────────────────────────────────────────────────────
        const titulo = proc.titulo ?? (proc.cliente ? `${num} — ${proc.cliente}` : num)
        const obsCompleta = [ultiTxt, extraTxt, andTxt].filter(Boolean).join('\n').trim()

        const { data: novo, error: errNovo } = await supabase
          .from('processos').insert({
            numero_processo:         num,
            titulo,
            area_direito:            mapArea(proc.area_direito),
            status:                  mapStatus(proc.status),
            tribunal:                proc.tribunal ?? null,
            vara:                    proc.vara ?? null,
            cliente_id:              clienteId,
            advogado_responsavel_id: responsavelId,
            observacoes:             obsCompleta || null,
          }).select('id').single()

        if (errNovo || !novo) {
          erros++
          log.push({ numero_processo: num, acao: 'erro', mensagem: errNovo?.message ?? 'Erro ao criar.' })
          continue
        }

        processoId = novo.id
        criados++
        log.push({ numero_processo: num, acao: 'criado', mensagem: 'Processo criado.' })
      }

      // ── Partes (parte contrária + vinculadas) ────────────────────────────
      const partesNovas: object[] = []
      if (proc.parte_contraria) {
        partesNovas.push({ processo_id: processoId, pessoa_nome: proc.parte_contraria.trim(), tipo_parte: 'reu' })
      }
      for (const p of proc.partes_vinculadas) {
        if (p.trim()) partesNovas.push({ processo_id: processoId, pessoa_nome: p.trim(), tipo_parte: 'terceiro' })
      }

      if (partesNovas.length > 0) {
        const { data: existPartes } = await supabase
          .from('partes_processo').select('pessoa_nome').eq('processo_id', processoId)
        const nomes = new Set((existPartes ?? []).map(p => norm(p.pessoa_nome)))
        const inserir = partesNovas.filter((p: object) => !nomes.has(norm((p as { pessoa_nome: string }).pessoa_nome)))
        if (inserir.length > 0) {
          await supabase.from('partes_processo').insert(inserir)
          partesInseridas += inserir.length
        }
      }

      // ── Agenda items (prazos + audiências + tarefas) ─────────────────────
      const agendas: object[] = []
      for (const item of [...proc.prazos, ...proc.audiencias, ...proc.tarefas]) {
        agendas.push({
          titulo:      item.titulo || 'Prazo/Audiência',
          tipo:        item.tipo === 'audiencia' ? 'audiencia' : item.tipo === 'tarefa' ? 'tarefa' : 'prazo',
          status:      item.status === 'concluido' ? 'concluido' : 'pendente',
          prioridade:  'media',
          data_inicio: parseDataBr(item.data) ?? new Date().toISOString().slice(0, 10),
          prazo_final: parseDataBr(item.data),
          processo_id: processoId,
          cliente_id:  clienteId ?? null,
        })
      }
      if (agendas.length > 0) {
        const { data: ins } = await supabase.from('agenda_items').insert(agendas).select('id')
        prazosInseridos += ins?.length ?? 0
      }

      // ── Kanban task (opcional) ────────────────────────────────────────────
      if (criarKanban && responsavelId) {
        const { data: kanbanExist } = await supabase
          .from('kanban_tasks').select('id')
          .eq('processo_id', processoId).limit(1).maybeSingle()

        if (!kanbanExist) {
          await supabase.from('kanban_tasks').insert({
            titulo:       proc.titulo ?? `Processo ${num}`,
            status:       'a_fazer',
            prioridade:   'media',
            origem:       'processo',
            processo_id:  processoId,
            responsavel_id: responsavelId,
            numero_processo: num,
            descricao:    proc.ultimo_andamento ?? null,
          })
          kanbanCriadas++
        }
      }

    } catch (err) {
      erros++
      log.push({ numero_processo: num, acao: 'erro', mensagem: err instanceof Error ? err.message : 'Erro inesperado.' })
    }
  }

  // ── Registra log de importação ────────────────────────────────────────────
  await supabase.from('kanban_import_logs').insert({
    import_batch_id,
    usuario_id:   auth.userId,
    arquivo_nome: arquivoNome,
    total_linhas: processos.length,
    importados:   criados,
    atualizados,
    ignorados,
    erros,
    detalhes:     log.length ? log : null,
  })

  const result: EasyJurImportResult & { kanban_criadas: number } = {
    import_batch_id,
    arquivo_nome:     arquivoNome,
    criados,
    atualizados,
    ignorados,
    erros,
    prazos_inseridos: prazosInseridos,
    partes_inseridas: partesInseridas,
    kanban_criadas:   kanbanCriadas,
    log,
  }

  return NextResponse.json(result)
}
