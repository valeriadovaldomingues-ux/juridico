import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'
import type {
  EasyJurProcesso,
  EasyJurImportLog,
  EasyJurImportResult,
} from '@/types/easyjur'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// ── Mapeamento de status EasyJur → sistema ────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'ativo':          'ativo',
  'em andamento':   'ativo',
  'em_andamento':   'ativo',
  'ativo parado':   'suspenso',
  'suspenso':       'suspenso',
  'paralisado':     'suspenso',
  'aguardando':     'suspenso',
  'arquivado':      'arquivado',
  'arquivada':      'arquivado',
  'encerrado':      'encerrado',
  'encerrada':      'encerrado',
  'concluido':      'encerrado',
  'concluída':      'encerrado',
  'baixado':        'encerrado',
}

const AREA_MAP: Record<string, string> = {
  'civil':          'civil',
  'civel':          'civil',
  'cível':          'civil',
  'trabalhista':    'trabalhista',
  'trabalho':       'trabalhista',
  'criminal':       'criminal',
  'penal':          'criminal',
  'tributario':     'tributario',
  'tributário':     'tributario',
  'fiscal':         'tributario',
  'previdenciario': 'previdenciario',
  'previdenciário': 'previdenciario',
  'inss':           'previdenciario',
  'administrativo': 'administrativo',
  'familia':        'familia',
  'família':        'familia',
  'empresarial':    'empresarial',
  'societario':     'empresarial',
  'societário':     'empresarial',
}

function mapStatus(raw: string | null): string {
  if (!raw) return 'ativo'
  const k = raw.toLowerCase().trim()
  return STATUS_MAP[k] ?? 'ativo'
}

function mapArea(raw: string | null): string {
  if (!raw) return 'outro'
  const k = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  return AREA_MAP[k] ?? 'outro'
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

/** Converte data DD/MM/AAAA para YYYY-MM-DD (retorna null se inválida) */
function parseDataBr(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo}-${d}`
}

// ── POST /api/importar/easyjur ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.processos)) {
    return NextResponse.json({ error: 'Corpo inválido: esperado { processos, arquivo_nome }' }, { status: 400 })
  }

  const processos:   EasyJurProcesso[] = body.processos
  const arquivoNome: string            = body.arquivo_nome ?? 'desconhecido'
  const import_batch_id                = crypto.randomUUID()
  const supabase                       = await createClient()

  // ── Pré-carrega mapa de perfis (nome → id) ─────────────────────────────────
  const { data: profiles } = await supabase.from('profiles').select('id, nome').eq('ativo', true)
  const profilesByNorm: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profilesByNorm[normalizeName(p.nome)] = p.id
    // Token inicial do nome (ex: "Dr. Carlos" → "carlos")
    const token = normalizeName(p.nome).split(/\s+/).slice(-1)[0]
    if (!profilesByNorm[token]) profilesByNorm[token] = p.id
  }

  // ── Pré-carrega processos existentes (numero → id, titulo) ────────────────
  const { data: existentes } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, observacoes, cliente_id, advogado_responsavel_id, status, area_direito')
  const processosByNum: Record<string, { id: string; titulo: string; observacoes: string | null; cliente_id: string | null; advogado_responsavel_id: string | null }> = {}
  for (const p of existentes ?? []) {
    if (p.numero_processo) processosByNum[p.numero_processo.trim()] = p
  }

  // ── Contadores ────────────────────────────────────────────────────────────
  let criados          = 0
  let atualizados      = 0
  let ignorados        = 0
  let erros            = 0
  let prazosInseridos  = 0
  let partesInseridas  = 0
  const log: EasyJurImportLog[] = []

  // ── Processa cada processo ─────────────────────────────────────────────────
  for (const proc of processos) {
    const num = proc.numero_processo?.trim() ?? null
    if (!num) {
      erros++
      log.push({ numero_processo: null, acao: 'erro', mensagem: 'Número do processo ausente — ignorado.' })
      continue
    }

    try {
      // ── 1. Resolver/criar cliente ─────────────────────────────────────────
      let clienteId: string | null = null
      if (proc.cliente) {
        const { data: clienteSearch } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', `%${proc.cliente.trim()}%`)
          .eq('ativo', true)
          .limit(1)
          .maybeSingle()

        if (clienteSearch) {
          clienteId = clienteSearch.id
        } else {
          // Cria cliente novo
          const tipo_pessoa = proc.cpf_cnpj_cliente
            ? (proc.cpf_cnpj_cliente.replace(/\D/g, '').length > 11 ? 'juridica' : 'fisica')
            : 'fisica'

          const { data: novoCliente } = await supabase
            .from('clientes')
            .insert({
              nome: proc.cliente.trim(),
              cpf_cnpj: proc.cpf_cnpj_cliente ?? null,
              tipo_pessoa,
              tipo_contato: 'cliente',
              ativo: true,
            })
            .select('id')
            .single()

          clienteId = novoCliente?.id ?? null
        }
      }

      // ── 2. Resolver responsável ───────────────────────────────────────────
      let responsavelId: string | null = null
      if (proc.responsavel) {
        const norm = normalizeName(proc.responsavel)
        responsavelId =
          profilesByNorm[norm] ??
          // Busca por token
          Object.entries(profilesByNorm).find(([k]) => norm.includes(k) || k.includes(norm))?.[1] ??
          null
      }

      // ── 3. Monta dados do processo ────────────────────────────────────────
      const titulo = proc.titulo
        ?? (proc.cliente ? `${num} — ${proc.cliente}` : num)

      // Observações: agrega andamentos ao texto existente
      const andamentosTexto = proc.andamentos.length > 0
        ? '\n\n--- Andamentos (EasyJur) ---\n' +
          proc.andamentos
            .slice(-10)                              // últimos 10
            .map(a => [a.data, a.tipo, a.descricao].filter(Boolean).join(' | '))
            .join('\n')
        : ''

      const ultimoAndTexto = proc.ultimo_andamento
        ? `\nÚltimo andamento: ${proc.ultimo_andamento}`
        : ''

      const obsExtra = [ultimoAndTexto, andamentosTexto].filter(Boolean).join('')

      const existing = processosByNum[num]
      let processoId: string

      if (existing) {
        // ── ATUALIZA (nunca sobrescreve campo bom com vazio) ────────────────
        processoId = existing.id
        const camposAtualizados: string[] = []
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (clienteId && !existing.cliente_id) { patch.cliente_id = clienteId; camposAtualizados.push('cliente_id') }
        if (responsavelId && !existing.advogado_responsavel_id) { patch.advogado_responsavel_id = responsavelId; camposAtualizados.push('responsavel') }
        if (proc.tribunal)    { patch.tribunal = proc.tribunal;         camposAtualizados.push('tribunal') }
        if (proc.vara)        { patch.vara = proc.vara;                 camposAtualizados.push('vara') }
        if (obsExtra) {
          patch.observacoes = (existing.observacoes ?? '') + obsExtra
          camposAtualizados.push('observacoes')
        }

        if (camposAtualizados.length > 0) {
          await supabase.from('processos').update(patch).eq('id', existing.id)
          atualizados++
          log.push({
            numero_processo: num, acao: 'atualizado',
            mensagem: 'Processo existente atualizado.',
            campos_atualizados: camposAtualizados,
          })
        } else {
          ignorados++
          log.push({ numero_processo: num, acao: 'ignorado', mensagem: 'Nenhum campo novo para atualizar.' })
        }

      } else {
        // ── CRIA ───────────────────────────────────────────────────────────
        const { data: novo, error: errNovo } = await supabase
          .from('processos')
          .insert({
            numero_processo:         num,
            titulo,
            area_direito:            mapArea(proc.area_direito),
            status:                  mapStatus(proc.status),
            tribunal:                proc.tribunal ?? null,
            vara:                    proc.vara ?? null,
            cliente_id:              clienteId,
            advogado_responsavel_id: responsavelId,
            observacoes:             obsExtra.trim() || null,
          })
          .select('id')
          .single()

        if (errNovo || !novo) {
          erros++
          log.push({ numero_processo: num, acao: 'erro', mensagem: errNovo?.message ?? 'Erro ao criar processo.' })
          continue
        }

        processoId = novo.id
        criados++
        log.push({ numero_processo: num, acao: 'criado', mensagem: 'Processo criado com sucesso.' })
      }

      // ── 4. Partes ─────────────────────────────────────────────────────────
      const partesParaInserir: Array<{ processo_id: string; pessoa_nome: string; tipo_parte: string }> = []

      if (proc.parte_contraria) {
        partesParaInserir.push({ processo_id: processoId, pessoa_nome: proc.parte_contraria.trim(), tipo_parte: 'reu' })
      }
      for (const p of proc.partes_vinculadas) {
        if (p.trim()) partesParaInserir.push({ processo_id: processoId, pessoa_nome: p.trim(), tipo_parte: 'terceiro' })
      }

      if (partesParaInserir.length > 0) {
        // Verifica quais já existem (dedup por pessoa_nome + processo_id)
        const { data: partesExistentes } = await supabase
          .from('partes_processo')
          .select('pessoa_nome')
          .eq('processo_id', processoId)

        const nomesExistentes = new Set((partesExistentes ?? []).map(p => normalizeName(p.pessoa_nome)))
        const novas = partesParaInserir.filter(p => !nomesExistentes.has(normalizeName(p.pessoa_nome)))

        if (novas.length > 0) {
          await supabase.from('partes_processo').insert(novas)
          partesInseridas += novas.length
        }
      }

      // ── 5. Prazos e audiências → agenda_items ─────────────────────────────
      const agendaParaInserir: object[] = []

      for (const pr of [...proc.prazos, ...proc.audiencias, ...proc.tarefas]) {
        const data = parseDataBr(pr.data)
        agendaParaInserir.push({
          titulo:      pr.titulo || 'Prazo importado',
          tipo:        pr.tipo === 'audiencia' ? 'audiencia' : pr.tipo === 'tarefa' ? 'tarefa' : 'prazo',
          status:      pr.status === 'concluido' || pr.status === 'realizado' ? 'concluido' : 'pendente',
          prioridade:  pr.prioridade === 'alta' || pr.prioridade === 'urgente' ? 'alta' : 'media',
          data_inicio: data ?? new Date().toISOString().slice(0, 10),
          prazo_final: data,
          processo_id: processoId,
          cliente_id:  clienteId ?? null,
        })
      }

      if (agendaParaInserir.length > 0) {
        const { data: inserted } = await supabase
          .from('agenda_items')
          .insert(agendaParaInserir)
          .select('id')
        prazosInseridos += inserted?.length ?? 0
      }

    } catch (err) {
      erros++
      log.push({
        numero_processo: num,
        acao: 'erro',
        mensagem: err instanceof Error ? err.message : 'Erro inesperado.',
      })
    }
  }

  // ── Log da importação ─────────────────────────────────────────────────────
  await supabase.from('kanban_import_logs').insert({
    import_batch_id,
    usuario_id:   auth.userId,
    arquivo_nome: arquivoNome,
    total_linhas: processos.length,
    importados:   criados,
    atualizados,
    ignorados,
    erros,
    detalhes:     log.length > 0 ? log : null,
  })

  const result: EasyJurImportResult = {
    import_batch_id,
    arquivo_nome:   arquivoNome,
    criados,
    atualizados,
    ignorados,
    erros,
    prazos_inseridos: prazosInseridos,
    partes_inseridas: partesInseridas,
    log,
  }

  return NextResponse.json(result)
}
