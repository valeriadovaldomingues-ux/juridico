import { createClient } from '@/lib/supabase/server'
import type { Automation, ActionPayload, EngineResult, RuleResult } from '@/types/automations'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface TaskInput {
  titulo:         string
  descricao?:     string
  responsavel_id: string | null
  prioridade:     string
  data?:          string | null
  link_entity?:   { tipo: string; id: string }
}

interface NotifInput {
  user_id: string
  title:   string
  message: string
  type:    'info' | 'warning' | 'critical' | 'success'
  link?:   string | null
}

interface Ctx {
  sb:         SupabaseClient
  now:        Date
  todayISO:   string
  profiles:   { id: string; nome: string; role: string }[]
  alreadyRan: (automationId: string, entityId: string, cooldownHours: number) => Promise<boolean>
  logRun:     (params: {
    automation_id: string; rule_type: string
    entity_type: string; entity_id: string
    action_type: string; status: 'ok' | 'skipped' | 'error'
    message?: string; created_task_id?: string | null
  }) => Promise<void>
  createTask:  (input: TaskInput) => Promise<string | null>
  notifyUsers: (userIds: string[], notif: Omit<NotifInput, 'user_id'>) => Promise<void>
  notifyRoles: (roles: string[], notif: Omit<NotifInput, 'user_id'>) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tomorrowISO(now: Date): string {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ─── Regra: lead_parado ───────────────────────────────────────────────────────

async function handleLeadParado(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const days    = (auto.trigger_conditions.days ?? 7) as number
  const cutoff  = new Date(ctx.now.getTime() - days * 86_400_000).toISOString()
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 168

  const { data: leads } = await ctx.sb
    .from('leads')
    .select('id, nome, responsavel_id')
    .not('status', 'in', '("fechado","perdido")')
    .lt('updated_at', cutoff)

  result.entities_found = leads?.length ?? 0
  for (const lead of leads ?? []) {
    if (await ctx.alreadyRan(auto.id, lead.id, cooldown)) { result.skipped++; continue }

    const taskId = auto.action_type !== 'notificar'
      ? await ctx.createTask({
          titulo:         `Follow-up com ${lead.nome}`,
          descricao:      `Lead parado há mais de ${days} dias sem movimentação.`,
          responsavel_id: lead.responsavel_id,
          prioridade:     String(payload.task_priority ?? 'alta'),
          data:           tomorrowISO(ctx.now),
        })
      : null

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'lead', entity_id: lead.id, action_type: auto.action_type, status: 'ok', message: `Follow-up para "${lead.nome}"`, created_task_id: taskId })

    if (payload.notify_responsavel && lead.responsavel_id) {
      await ctx.notifyUsers([lead.responsavel_id], { title: 'Lead parado', message: `"${lead.nome}" está sem movimentação há ${days} dias.`, type: 'warning', link: '/comercial' })
    }
    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: 'Lead parado', message: `Lead "${lead.nome}" está parado há ${days} dias.`, type: 'warning', link: '/comercial' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: proposta_sem_resposta ─────────────────────────────────────────────

async function handlePropostaSemResposta(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const days    = (auto.trigger_conditions.days ?? 5) as number
  const cutoff  = new Date(ctx.now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 120

  const { data: propostas } = await ctx.sb
    .from('propostas_comerciais')
    .select('id, lead_id, leads(id, nome, responsavel_id)')
    .eq('status', 'enviada')
    .lt('updated_at', cutoff)

  result.entities_found = propostas?.length ?? 0
  for (const p of propostas ?? []) {
    const lead = (p as any).leads as { id: string; nome: string; responsavel_id: string | null } | null
    if (!lead) continue
    if (await ctx.alreadyRan(auto.id, p.id, cooldown)) { result.skipped++; continue }

    const taskId = auto.action_type !== 'notificar'
      ? await ctx.createTask({ titulo: `Seguir proposta enviada a ${lead.nome}`, descricao: `Proposta enviada há ${days} dias sem resposta.`, responsavel_id: lead.responsavel_id, prioridade: String(payload.task_priority ?? 'alta'), data: tomorrowISO(ctx.now) })
      : null

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'proposta', entity_id: p.id, action_type: auto.action_type, status: 'ok', message: `Proposta de "${lead.nome}" sem resposta`, created_task_id: taskId })

    if (payload.notify_responsavel && lead.responsavel_id) {
      await ctx.notifyUsers([lead.responsavel_id], { title: 'Proposta sem resposta', message: `A proposta enviada a "${lead.nome}" está há ${days} dias sem retorno.`, type: 'warning', link: '/comercial' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: cliente_sem_contato ───────────────────────────────────────────────

async function handleClienteSemContato(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const days    = (auto.trigger_conditions.days ?? 30) as number
  const cutoff  = new Date(ctx.now.getTime() - days * 86_400_000).toISOString()
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 720

  const { data: clientes } = await ctx.sb
    .from('clientes')
    .select('id, nome, responsavel_id')
    .eq('ativo', true)
    .lt('updated_at', cutoff)

  result.entities_found = clientes?.length ?? 0
  for (const c of clientes ?? []) {
    if (await ctx.alreadyRan(auto.id, c.id, cooldown)) { result.skipped++; continue }

    const taskId = auto.action_type !== 'notificar'
      ? await ctx.createTask({ titulo: `Entrar em contato com ${c.nome}`, descricao: `Cliente sem interação há mais de ${days} dias.`, responsavel_id: c.responsavel_id ?? null, prioridade: String(payload.task_priority ?? 'media'), data: tomorrowISO(ctx.now) })
      : null

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'cliente', entity_id: c.id, action_type: auto.action_type, status: 'ok', message: `Cliente "${c.nome}" sem contato`, created_task_id: taskId })

    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: 'Cliente sem contato', message: `"${c.nome}" está sem interação há ${days} dias.`, type: 'info', link: '/clientes' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: aniversario_cliente ───────────────────────────────────────────────

async function handleAniversarioCliente(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 20

  const month = ctx.now.getMonth() + 1
  const day   = ctx.now.getDate()

  const { data: clientes } = await ctx.sb
    .from('clientes')
    .select('id, nome, responsavel_id')
    .eq('ativo', true)
    .not('data_nascimento', 'is', null)
    .eq('ignore_birthday', false)

  const aniversariantes = (clientes ?? []).filter(c => {
    const [, mm, dd] = ((c as any).data_nascimento ?? '').split('-')
    return parseInt(mm) === month && parseInt(dd) === day
  })

  result.entities_found = aniversariantes.length
  for (const c of aniversariantes) {
    if (await ctx.alreadyRan(auto.id, c.id, cooldown)) { result.skipped++; continue }

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'cliente', entity_id: c.id, action_type: auto.action_type, status: 'ok', message: `Aniversário de "${c.nome}"` })

    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: `🎂 Aniversário — ${c.nome}`, message: `Hoje é aniversário do cliente ${c.nome}. Que tal enviar uma mensagem?`, type: 'success', link: '/clientes' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: aniversario_equipe ────────────────────────────────────────────────

async function handleAniversarioEquipe(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 20

  const month = ctx.now.getMonth() + 1
  const day   = ctx.now.getDate()

  const aniversariantes = ctx.profiles.filter(p => {
    const dn = (p as any).data_nascimento as string | null
    if (!dn) return false
    const [, mm, dd] = dn.split('-')
    return parseInt(mm) === month && parseInt(dd) === day
  })

  result.entities_found = aniversariantes.length
  for (const p of aniversariantes) {
    if (await ctx.alreadyRan(auto.id, p.id, cooldown)) { result.skipped++; continue }

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'profile', entity_id: p.id, action_type: auto.action_type, status: 'ok', message: `Aniversário de ${p.nome}` })

    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: `🎂 Aniversário da equipe — ${p.nome}`, message: `Hoje é aniversário de ${p.nome}! Não esqueça de parabenizar.`, type: 'success', link: null })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: tarefa_vencida ────────────────────────────────────────────────────

async function handleTarefaVencida(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 24

  const { data: tasks } = await ctx.sb
    .from('kanban_tasks')
    .select('id, titulo, responsavel_id, data')
    .neq('status', 'concluido')
    .not('data', 'is', null)
    .lt('data', ctx.todayISO)

  result.entities_found = tasks?.length ?? 0
  for (const t of tasks ?? []) {
    if (await ctx.alreadyRan(auto.id, t.id, cooldown)) { result.skipped++; continue }

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'kanban_task', entity_id: t.id, action_type: auto.action_type, status: 'ok', message: `Tarefa vencida: "${t.titulo}"` })

    if (payload.notify_responsavel && t.responsavel_id) {
      await ctx.notifyUsers([t.responsavel_id], { title: 'Tarefa vencida', message: `A tarefa "${t.titulo}" está vencida desde ${t.data}.`, type: 'critical', link: '/kanban' })
    }
    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: 'Tarefa vencida', message: `"${t.titulo}" está vencida e sem conclusão.`, type: 'critical', link: '/kanban' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: tarefa_vencendo_hoje ─────────────────────────────────────────────

async function handleTarefaVencendoHoje(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 22

  const { data: tasks } = await ctx.sb
    .from('kanban_tasks')
    .select('id, titulo, responsavel_id')
    .neq('status', 'concluido')
    .eq('data', ctx.todayISO)

  result.entities_found = tasks?.length ?? 0
  for (const t of tasks ?? []) {
    if (await ctx.alreadyRan(auto.id, t.id, cooldown)) { result.skipped++; continue }

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'kanban_task', entity_id: t.id, action_type: auto.action_type, status: 'ok', message: `Tarefa vencendo hoje: "${t.titulo}"` })

    if (payload.notify_responsavel && t.responsavel_id) {
      await ctx.notifyUsers([t.responsavel_id], { title: 'Prazo hoje', message: `A tarefa "${t.titulo}" vence hoje. Não deixe passar!`, type: 'warning', link: '/kanban' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Regra: usuario_sem_movimentacao ─────────────────────────────────────────

async function handleUsuarioSemMovimentacao(ctx: Ctx, auto: Automation): Promise<RuleResult> {
  const result: RuleResult = { automation_id: auto.id, automation_name: auto.name, trigger_type: auto.trigger_type, entities_found: 0, actions_taken: 0, skipped: 0 }
  const days    = (auto.trigger_conditions.days ?? 3) as number
  const cutoff  = new Date(ctx.now.getTime() - days * 86_400_000).toISOString()
  const payload = auto.action_payload as ActionPayload
  const cooldown = payload.cooldown_hours ?? 72

  // Colaboradores ativos que têm tarefas mas nenhuma foi atualizada depois do cutoff
  const activeCols = ctx.profiles.filter(p => !['estagiario'].includes(p.role))

  const parados: typeof activeCols = []
  for (const p of activeCols) {
    const { data: recent } = await ctx.sb
      .from('kanban_tasks')
      .select('id')
      .eq('responsavel_id', p.id)
      .gte('updated_at', cutoff)
      .limit(1)
      .maybeSingle()

    const { data: hasAny } = await ctx.sb
      .from('kanban_tasks')
      .select('id')
      .eq('responsavel_id', p.id)
      .limit(1)
      .maybeSingle()

    if (hasAny && !recent) parados.push(p)
  }

  result.entities_found = parados.length
  for (const p of parados) {
    if (await ctx.alreadyRan(auto.id, p.id, cooldown)) { result.skipped++; continue }

    await ctx.logRun({ automation_id: auto.id, rule_type: auto.trigger_type, entity_type: 'profile', entity_id: p.id, action_type: auto.action_type, status: 'ok', message: `${p.nome} sem movimentação há ${days} dias` })

    if (payload.notify_roles?.length) {
      await ctx.notifyRoles(payload.notify_roles as string[], { title: 'Colaborador sem movimentação', message: `${p.nome} não atualizou tarefas nos últimos ${days} dias.`, type: 'warning', link: '/kanban' })
    }
    result.actions_taken++
  }
  return result
}

// ─── Registro de handlers ─────────────────────────────────────────────────────

const HANDLERS: Partial<Record<string, (ctx: Ctx, auto: Automation) => Promise<RuleResult>>> = {
  lead_parado:              handleLeadParado,
  proposta_sem_resposta:    handlePropostaSemResposta,
  cliente_sem_contato:      handleClienteSemContato,
  aniversario_cliente:      handleAniversarioCliente,
  aniversario_equipe:       handleAniversarioEquipe,
  tarefa_vencida:           handleTarefaVencida,
  tarefa_vencendo_hoje:     handleTarefaVencendoHoje,
  usuario_sem_movimentacao: handleUsuarioSemMovimentacao,
  // usuario_sem_timesheet: pendente módulo Timesheet
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export async function runAutomationEngine(): Promise<EngineResult> {
  const sb  = await createClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const startedAt = now.toISOString()
  const result: EngineResult = {
    started_at: startedAt, finished_at: '', automations_ran: 0,
    total_created: 0, total_skipped: 0, total_errors: 0, details: [],
  }

  // Buscar automações ativas
  const { data: automations, error: autoErr } = await sb
    .from('automations')
    .select('*')
    .eq('is_active', true)

  if (autoErr || !automations) {
    result.finished_at = new Date().toISOString()
    return result
  }

  // Buscar todos os profiles para regras de equipe
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, nome, role, data_nascimento')
    .eq('ativo', true)

  // ── Helpers injetados no contexto ──────────────────────────────────────────

  async function alreadyRan(automationId: string, entityId: string, cooldownHours: number): Promise<boolean> {
    const since = new Date(now.getTime() - cooldownHours * 3_600_000).toISOString()
    const { data } = await sb
      .from('automation_runs')
      .select('id')
      .eq('automation_id', automationId)
      .eq('entity_id', entityId)
      .eq('status', 'ok')
      .gte('executed_at', since)
      .limit(1)
      .maybeSingle()
    return !!data
  }

  async function logRun(params: Parameters<Ctx['logRun']>[0]) {
    await sb.from('automation_runs').insert({
      automation_id:   params.automation_id,
      rule_type:       params.rule_type,
      entity_type:     params.entity_type,
      entity_id:       params.entity_id,
      action_type:     params.action_type,
      status:          params.status,
      message:         params.message ?? null,
      created_task_id: params.created_task_id ?? null,
    })
  }

  async function createTask(input: TaskInput): Promise<string | null> {
    const { data: maxRow } = await sb
      .from('kanban_tasks')
      .select('ordem')
      .eq('status', 'a_fazer')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = maxRow ? maxRow.ordem + 1 : 0

    const { data } = await sb
      .from('kanban_tasks')
      .insert({
        titulo:         input.titulo,
        descricao:      input.descricao ?? null,
        responsavel_id: input.responsavel_id,
        prioridade:     input.prioridade,
        data:           input.data ?? null,
        status:         'a_fazer',
        origem:         'automacao',
        ordem,
        updated_at:     now.toISOString(),
      })
      .select('id')
      .single()
    return data?.id ?? null
  }

  async function notifyUsers(userIds: string[], notif: Omit<NotifInput, 'user_id'>) {
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return
    await sb.from('notifications').insert(
      unique.map(uid => ({ user_id: uid, title: notif.title, message: notif.message, type: notif.type, link: notif.link ?? null }))
    )
  }

  async function notifyRoles(roles: string[], notif: Omit<NotifInput, 'user_id'>) {
    const targets = (profiles ?? []).filter(p => roles.includes(p.role)).map(p => p.id)
    await notifyUsers(targets, notif)
  }

  const ctx: Ctx = { sb, now, todayISO, profiles: profiles ?? [], alreadyRan, logRun, createTask, notifyUsers, notifyRoles }

  // ── Executar cada automação ─────────────────────────────────────────────────

  for (const auto of automations) {
    const handler = HANDLERS[auto.trigger_type]
    if (!handler) continue

    try {
      const ruleResult = await handler(ctx, auto as Automation)
      result.details.push(ruleResult)
      result.automations_ran++
      result.total_created += ruleResult.actions_taken
      result.total_skipped += ruleResult.skipped
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.details.push({
        automation_id:   auto.id,
        automation_name: auto.name,
        trigger_type:    auto.trigger_type,
        entities_found:  0,
        actions_taken:   0,
        skipped:         0,
        error:           msg,
      })
      result.total_errors++
    }
  }

  result.finished_at = new Date().toISOString()
  return result
}
