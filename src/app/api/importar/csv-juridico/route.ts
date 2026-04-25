import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

interface CsvRow {
  card_id:                  string
  titulo_original:          string
  numero_processo:          string
  cliente_parte_principal:  string
  parte_contraria:          string
  ultimo_andamento:         string
  descricao_limpa:          string
  responsavel_principal:    string
  lista_origem:             string
  status_normalizado:       string
  area_normalizada:         string
  tribunal_inferido:        string
  urgencia:                 string
  data_referencia:          string
  data_vencimento:          string
  arquivado:                string
}

// ─── Resultado da importação ──────────────────────────────────────────────────

interface LogEntry {
  linha:         number
  card_id:       string
  tipo:          'ok' | 'aviso' | 'erro'
  mensagem:      string
  processo_id?:  string
  task_id?:      string
}

interface Relatorio {
  batch_id:         string
  total:            number
  processos_criados:    number
  processos_atualizados: number
  processos_existentes: number
  tarefas_criadas:  number
  tarefas_atualizadas: number
  sem_responsavel:  number
  sem_numero:       number
  rejeitados:       number
  tabelas_afetadas: string[]
  log:              LogEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove acentos e normaliza para lowercase (para comparação de nomes) */
function normName(s: string): string {
  return (s ?? '').trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Retorna o primeiro token de um nome ("Valéria Pessoa" → "valeria") */
function firstToken(s: string): string {
  return normName(s).split(/\s+/)[0] ?? ''
}

/**
 * Mapeia status_normalizado + arquivado → status do processo
 * Regra: arquivado=True OR status=Concluído → encerrado
 */
function mapProcessoStatus(statusNorm: string, arquivado: string): 'ativo' | 'encerrado' | 'suspenso' | 'arquivado' {
  if (arquivado.toLowerCase() === 'true') return 'encerrado'
  if (statusNorm.toLowerCase().includes('conclu')) return 'encerrado'
  return 'ativo'
}

/**
 * Mapeia area_normalizada → area_direito do sistema
 */
function mapArea(area: string): string {
  const a = normName(area)
  if (a.includes('trabalhist')) return 'trabalhista'
  if (a.includes('civel') || a.includes('civil') || a.includes('imobil') || a.includes('financeiro')) return 'civil'
  if (a.includes('criminal')) return 'criminal'
  if (a.includes('tribut')) return 'tributario'
  if (a.includes('previd')) return 'previdenciario'
  if (a.includes('admin')) return 'administrativo'
  if (a.includes('famil')) return 'familia'
  if (a.includes('empresar')) return 'empresarial'
  return 'outro'
}

/** Mapeia status + arquivado → status da tarefa no kanban */
function mapKanbanStatus(statusNorm: string, arquivado: string): 'a_fazer' | 'concluido' {
  if (arquivado.toLowerCase() === 'true') return 'concluido'
  if (statusNorm.toLowerCase().includes('conclu')) return 'concluido'
  return 'a_fazer'
}

/** Mapeia urgência → prioridade */
function mapPrioridade(urgencia: string): 'baixa' | 'media' | 'alta' | 'urgente' {
  const u = urgencia.toUpperCase()
  if (u === 'URGENTE') return 'urgente'
  if (u === 'ALTA') return 'alta'
  return 'media'
}

/**
 * Decide se deve criar tarefa kanban para este item.
 * Regra: só cria para itens ativos (não encerrados/concluídos/arquivados)
 * OU se já existia um card Trello (atualiza em vez de ignorar).
 */
function deveCriarKanban(statusNorm: string, arquivado: string): boolean {
  if (arquivado.toLowerCase() === 'true') return false
  if (statusNorm.toLowerCase().includes('conclu')) return false
  return true
}

/** Extrai data ISO de campo de data/timestamp do CSV */
function parseDataCSV(s: string): string | null {
  if (!s || !s.trim()) return null
  // "2026-04-22 13:13:36" → "2026-04-22"
  const d = s.trim().split(' ')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return null
}

/** Limita texto para não estourar campos */
function cap(s: string, max = 500): string {
  return (s ?? '').trim().slice(0, max)
}

// ─── POST /api/importar/csv-juridico ─────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const allowed: import('@/types').UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']
  const auth = await apiGuard(allowed)
  if (auth instanceof NextResponse) return auth

  // ── Parse body ────────────────────────────────────────────────────────────
  let rows: CsvRow[]
  let dryRun = false
  try {
    const body = await req.json()
    if (!Array.isArray(body?.rows)) {
      return NextResponse.json({ error: 'Body deve conter { rows: [...] }' }, { status: 400 })
    }
    rows    = body.rows
    dryRun  = body.dry_run === true
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha recebida.' }, { status: 400 })
  }

  const supabase = await createClient()
  const batchId  = crypto.randomUUID()
  const batchTag = `[CSV-import:${batchId.slice(0, 8)}]`

  // ── Pré-carga 1: Profiles (para mapear responsável) ───────────────────────
  const { data: profiles, error: errProfiles } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('ativo', true)

  if (errProfiles) {
    return NextResponse.json({ error: `Erro ao carregar profiles: ${errProfiles.message}` }, { status: 500 })
  }

  // Mapa: token normalizado → profile_id
  // Ex: "valeria" → uuid, "breno" → uuid
  const profileByToken = new Map<string, string>()
  const profileByFull  = new Map<string, string>()
  for (const p of (profiles ?? [])) {
    profileByFull.set(normName(p.nome), p.id)
    profileByToken.set(firstToken(p.nome), p.id)
  }

  function resolveResponsavel(raw: string): string | null {
    if (!raw || !raw.trim()) return null
    const norm = normName(raw)
    // 1. Match exato do nome completo
    if (profileByFull.has(norm)) return profileByFull.get(norm)!
    // 2. Match do primeiro token (ex: "Breno" → "Breno Andrade")
    const tok = firstToken(raw)
    if (tok && profileByToken.has(tok)) return profileByToken.get(tok)!
    // 3. Match parcial: algum profile cujo nome começa com o token do CSV
    for (const [fullNorm, id] of profileByFull) {
      if (fullNorm.startsWith(norm) || norm.startsWith(fullNorm.split(' ')[0])) return id
    }
    // 4. Sem match — retorna null (NUNCA usa o usuário logado como fallback)
    return null
  }

  // ── Pré-carga 2: Processos existentes por numero_processo ─────────────────
  const numerosCSV = rows
    .map(r => (r.numero_processo ?? '').trim())
    .filter(Boolean)
  const numerosUnicos = [...new Set(numerosCSV)]

  const processoExistenteMap = new Map<string, { id: string; advogado_responsavel_id: string | null; observacoes: string | null }>()
  if (numerosUnicos.length > 0) {
    const { data: procDB } = await supabase
      .from('processos')
      .select('id, numero_processo, advogado_responsavel_id, observacoes')
      .in('numero_processo', numerosUnicos)
    for (const p of procDB ?? []) {
      processoExistenteMap.set((p.numero_processo ?? '').trim(), {
        id:                      p.id,
        advogado_responsavel_id: p.advogado_responsavel_id,
        observacoes:             p.observacoes,
      })
    }
  }

  // ── Pré-carga 3: Kanban tasks Trello existentes por card_id (origem_id) ────
  const cardIdsCSV = rows.map(r => (r.card_id ?? '').trim()).filter(Boolean)
  const kanbanExistenteMap = new Map<string, { id: string; responsavel_id: string | null }>()
  if (cardIdsCSV.length > 0) {
    const { data: tasksDB } = await supabase
      .from('kanban_tasks')
      .select('id, origem_id, responsavel_id')
      .eq('origem', 'trello')
      .in('origem_id', cardIdsCSV)
    for (const t of tasksDB ?? []) {
      if (t.origem_id) kanbanExistenteMap.set(t.origem_id, { id: t.id, responsavel_id: t.responsavel_id })
    }
  }

  // ── Relatório ──────────────────────────────────────────────────────────────
  const rel: Relatorio = {
    batch_id:              batchId,
    total:                 rows.length,
    processos_criados:     0,
    processos_atualizados: 0,
    processos_existentes:  0,
    tarefas_criadas:       0,
    tarefas_atualizadas:   0,
    sem_responsavel:       0,
    sem_numero:            0,
    rejeitados:            0,
    tabelas_afetadas:      [],
    log:                   [],
  }
  const tabelasAfetadas = new Set<string>()

  function log(linha: number, card_id: string, tipo: LogEntry['tipo'], mensagem: string, extra?: Partial<LogEntry>) {
    rel.log.push({ linha, card_id, tipo, mensagem, ...extra })
  }

  // ── Processamento por linha ────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const linha  = i + 2  // linha 1 = header
    const cardId = (row.card_id ?? '').trim()

    // ── 1. Mapear responsável ───────────────────────────────────────────────
    const responsavelId = resolveResponsavel(row.responsavel_principal)
    if (!responsavelId) {
      rel.sem_responsavel++
      if (row.responsavel_principal?.trim()) {
        // Havia nome mas não encontrou match → avisa
        log(linha, cardId, 'aviso', `Responsável "${row.responsavel_principal}" não encontrado nos perfis do sistema — item ficará sem responsável`)
      }
    }

    // ── 2. Normalizar campos ────────────────────────────────────────────────
    const processoStatus = mapProcessoStatus(row.status_normalizado, row.arquivado)
    const areaDireito    = mapArea(row.area_normalizada)
    const numProcesso    = (row.numero_processo ?? '').trim()
    const titulo         = cap(row.titulo_original || numProcesso || `Importação linha ${linha}`, 500)
    const observacoes    = row.ultimo_andamento?.trim()
      ? `[Último Andamento] ${cap(row.ultimo_andamento, 800)}`
      : null
    const tribunal       = cap(row.tribunal_inferido, 100) || null
    const dataVenc       = parseDataCSV(row.data_vencimento)
    const dataRef        = parseDataCSV(row.data_referencia)
    const prazo          = dataVenc ?? dataRef

    if (!numProcesso) rel.sem_numero++

    // ── 3. Encontrar ou criar cliente ───────────────────────────────────────
    let clienteId: string | null = null
    const nomeCliente = cap(row.cliente_parte_principal, 200)

    if (nomeCliente && !dryRun) {
      // Busca por nome (case-insensitive)
      const { data: cli } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome', nomeCliente)
        .limit(1)
        .maybeSingle()

      if (cli?.id) {
        clienteId = cli.id
      } else {
        // Cria novo cliente
        const { data: novoCli, error: errCli } = await supabase
          .from('clientes')
          .insert({ nome: nomeCliente, ativo: true, tipo_pessoa: 'fisica' })
          .select('id')
          .single()
        if (novoCli?.id) {
          clienteId = novoCli.id
          tabelasAfetadas.add('clientes')
        } else {
          log(linha, cardId, 'aviso', `Não foi possível criar cliente "${nomeCliente}": ${errCli?.message}`)
        }
      }
    }

    // ── 4. Upsert processo ──────────────────────────────────────────────────
    let processoId: string | null = null
    const existente = numProcesso ? processoExistenteMap.get(numProcesso) : null

    if (existente) {
      processoId = existente.id
      rel.processos_existentes++

      if (!dryRun) {
        // Atualiza apenas campos que estavam vazios
        const updates: Record<string, unknown> = {}
        if (!existente.advogado_responsavel_id && responsavelId) {
          updates.advogado_responsavel_id = responsavelId
        }
        if (!existente.observacoes && observacoes) {
          updates.observacoes = observacoes
        }
        if (Object.keys(updates).length > 0) {
          const { error: errUp } = await supabase
            .from('processos')
            .update(updates)
            .eq('id', existente.id)
          if (!errUp) {
            rel.processos_atualizados++
            tabelasAfetadas.add('processos')
            log(linha, cardId, 'aviso', `Processo "${numProcesso}" já existia — campos vazios atualizados`)
          }
        } else {
          log(linha, cardId, 'aviso', `Processo "${numProcesso}" já existia — nenhuma atualização necessária (dados já preenchidos)`)
        }
      }
    } else {
      // Cria novo processo
      if (!dryRun) {
        const { data: novoProc, error: errProc } = await supabase
          .from('processos')
          .insert({
            numero_processo:         numProcesso || null,
            titulo,
            area_direito:            areaDireito,
            status:                  processoStatus,
            cliente_id:              clienteId,
            advogado_responsavel_id: responsavelId,
            tribunal,
            observacoes,
          })
          .select('id')
          .single()

        if (errProc || !novoProc?.id) {
          rel.rejeitados++
          log(linha, cardId, 'erro', `Erro ao criar processo "${titulo}": ${errProc?.message ?? 'resposta vazia'}`)
          continue
        }

        processoId = novoProc.id
        rel.processos_criados++
        tabelasAfetadas.add('processos')

        // Registra no mapa para o restante do batch (evita duplicar no mesmo batch)
        if (numProcesso) {
          processoExistenteMap.set(numProcesso, {
            id: novoProc.id,
            advogado_responsavel_id: responsavelId,
            observacoes,
          })
        }

        log(linha, cardId, 'ok',
          `Processo criado: "${titulo}"${numProcesso ? ` (${numProcesso})` : ' (sem número)'}${responsavelId ? '' : ' | sem responsável'}`,
          { processo_id: novoProc.id }
        )
      }
    }

    // ── 5. Parte contrária → partes_processo ───────────────────────────────
    const nomeParteContraria = cap(row.parte_contraria, 300)
    if (nomeParteContraria && processoId && !dryRun) {
      // Garante que a pessoa existe na tabela pessoas
      let pessoaId: string | null = null

      const { data: pessoaExist } = await supabase
        .from('pessoas')
        .select('id')
        .ilike('nome', nomeParteContraria)
        .limit(1)
        .maybeSingle()

      if (pessoaExist?.id) {
        pessoaId = pessoaExist.id
      } else {
        const { data: novaPessoa } = await supabase
          .from('pessoas')
          .insert({ nome: nomeParteContraria })
          .select('id')
          .single()
        if (novaPessoa?.id) {
          pessoaId = novaPessoa.id
          tabelasAfetadas.add('pessoas')
        }
      }

      if (pessoaId) {
        // Verifica se o par já existe (idempotente)
        const { data: parExist } = await supabase
          .from('partes_processo')
          .select('id')
          .eq('processo_id', processoId)
          .eq('pessoa_id', pessoaId)
          .maybeSingle()

        if (!parExist) {
          await supabase.from('partes_processo').insert({
            processo_id: processoId,
            pessoa_nome: nomeParteContraria,
            pessoa_id:   pessoaId,
            tipo_parte:  'reu',
          })
          tabelasAfetadas.add('partes_processo')
        }
      }
    }

    // ── 6. Kanban task ─────────────────────────────────────────────────────
    if (!cardId) continue  // sem card_id não há como deduplicar

    const kanbanStatus   = mapKanbanStatus(row.status_normalizado, row.arquivado)
    const criarKanban    = deveCriarKanban(row.status_normalizado, row.arquivado)
    const existenteTask  = kanbanExistenteMap.get(cardId)
    const prioridade     = mapPrioridade(row.urgencia)
    const taskTitulo     = cap(titulo, 300)
    const taskDescricao  = [
      batchTag,
      row.descricao_limpa?.trim() || null,
      row.ultimo_andamento?.trim() ? `[Andamento] ${row.ultimo_andamento.trim()}` : null,
    ].filter(Boolean).join('\n') || null

    if (!dryRun) {
      if (existenteTask) {
        // Atualiza tarefa existente — só atualiza responsavel se estava null
        const updates: Record<string, unknown> = {
          titulo:     taskTitulo,
          processo_id: processoId,
          updated_at: new Date().toISOString(),
        }
        if (!existenteTask.responsavel_id && responsavelId) {
          updates.responsavel_id = responsavelId
        }
        if (taskDescricao) updates.descricao = taskDescricao
        if (prazo) updates.data = prazo

        const { data: upTask, error: errUpTask } = await supabase
          .from('kanban_tasks')
          .update(updates)
          .eq('id', existenteTask.id)
          .select('id')
          .single()

        if (!errUpTask && upTask?.id) {
          rel.tarefas_atualizadas++
          tabelasAfetadas.add('kanban_tasks')
          log(linha, cardId, 'ok', `Tarefa Trello atualizada (card_id: ${cardId})`, { task_id: upTask.id })
        }
      } else if (criarKanban) {
        // Cria nova tarefa
        const { data: novaTask, error: errTask } = await supabase
          .from('kanban_tasks')
          .insert({
            titulo:          taskTitulo,
            descricao:       taskDescricao,
            status:          kanbanStatus,
            prioridade,
            responsavel_id:  responsavelId,
            processo_id:     processoId,
            numero_processo: numProcesso || null,
            partes_resumidas: nomeParteContraria || null,
            area_juridica:   row.area_normalizada?.trim() || null,
            origem:          'trello',
            origem_id:       cardId,
            data:            prazo,
            ordem:           0,
            updated_at:      new Date().toISOString(),
          })
          .select('id')
          .single()

        if (errTask || !novaTask?.id) {
          log(linha, cardId, 'erro', `Erro ao criar tarefa kanban: ${errTask?.message ?? 'resposta vazia'}`)
        } else {
          rel.tarefas_criadas++
          tabelasAfetadas.add('kanban_tasks')
          kanbanExistenteMap.set(cardId, { id: novaTask.id, responsavel_id: responsavelId })
          log(linha, cardId, 'ok',
            `Tarefa kanban criada${responsavelId ? '' : ' (sem responsável)'}`,
            { task_id: novaTask.id }
          )
        }
      } else {
        // Item encerrado — não cria kanban, só registra no log
        log(linha, cardId, 'aviso', `Item encerrado/arquivado — processo importado, tarefa kanban não criada`)
      }
    }
  }

  rel.tabelas_afetadas = [...tabelasAfetadas].sort()

  return NextResponse.json(rel)
}
