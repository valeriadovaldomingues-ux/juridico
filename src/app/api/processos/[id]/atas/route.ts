import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { calculateSimpleSLA } from '@/lib/kanban-sla'
import { buildCentralArquivosStoragePath, removeFileFromStorage, uploadFileToStorage, CENTRAL_ARQUIVOS_MAX_UPLOAD_BYTES } from '@/lib/central-arquivos/storage'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const iso = (v: unknown) => (typeof v === 'string' && ISO.test(v) ? v : null)
const txt = (v: unknown) => String(v ?? '').trim() || null

interface ObrigacaoEntrada { titulo: string; descricao?: string | null; data?: string | null; dataTexto?: string | null; valor?: string | null }
interface TarefaEntrada { titulo: string; descricao?: string | null; prazo?: string | null; responsavel_id?: string | null }

// GET — atas registradas no processo (a mais recente primeiro).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('atas_audiencia')
    .select('id, andamento_id, data_audiencia, resumo, arquivo_nome, obrigacoes_cliente, created_at')
    .eq('processo_id', id)
    .order('data_audiencia', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST (multipart: "dados" = JSON, "arquivo" = original da ata, opcional)
// Registra a ata como andamento do processo e lança o que saiu dela na Agenda e no Kanban.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })

  const form = await req.formData().catch(() => null)
  let dados: Record<string, unknown> | null = null
  try { dados = JSON.parse(String(form?.get('dados') ?? '')) } catch { dados = null }
  if (!form || !dados) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })

  const dataAudiencia = iso(dados.data_audiencia)
  const texto = String(dados.texto ?? '').trim()
  const resumo = txt(dados.resumo)
  if (!dataAudiencia) return NextResponse.json({ error: 'Data da audiência inválida.' }, { status: 400 })
  if (!texto) return NextResponse.json({ error: 'A ata está vazia.' }, { status: 400 })

  const obrigacoes = ((Array.isArray(dados.obrigacoes_cliente) ? dados.obrigacoes_cliente : []) as ObrigacaoEntrada[])
    .map(o => ({ titulo: String(o.titulo ?? '').trim().slice(0, 160), descricao: txt(o.descricao), data: iso(o.data), dataTexto: txt(o.dataTexto), valor: txt(o.valor) }))
    .filter(o => o.titulo)
  const tarefas = ((Array.isArray(dados.tarefas_escritorio) ? dados.tarefas_escritorio : []) as TarefaEntrada[])
    .map(t => ({ titulo: String(t.titulo ?? '').trim().slice(0, 140), descricao: txt(t.descricao), prazo: iso(t.prazo), responsavel_id: t.responsavel_id && isUUID(t.responsavel_id) ? t.responsavel_id : null }))
    .filter(t => t.titulo)

  const arquivo = form.get('arquivo')
  const arquivoValido = arquivo instanceof File && arquivo.size > 0 ? arquivo : null
  if (arquivoValido && arquivoValido.size > CENTRAL_ARQUIVOS_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'O arquivo da ata excede 25MB.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: processo } = await supabase
    .from('processos')
    .select('id, cliente_id, titulo, numero_processo, advogado_responsavel_id, cliente:clientes!cliente_id(nome)')
    .eq('id', id).maybeSingle()
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
  const clienteNome = (Array.isArray(processo.cliente) ? processo.cliente[0]?.nome : (processo.cliente as { nome?: string } | null)?.nome) ?? null

  const { data: equipeRaw } = await supabase.rpc('perfis_equipe')
  const nomeDe = new Map(((equipeRaw ?? []) as { id: string; nome: string }[]).map(p => [p.id, p.nome]))
  const advogadoId: string | null = processo.advogado_responsavel_id ?? null

  // 1) Andamento do processo (tipo Audiência) com o resumo e as obrigações do cliente.
  const linhasObrigacoes = obrigacoes.map(o => `• ${o.titulo}${o.valor ? ` — ${o.valor}` : ''}${o.data ? ` — até ${dataBR(o.data)}` : o.dataTexto ? ` — ${o.dataTexto}` : ''}`)
  const descricao = [resumo, linhasObrigacoes.length ? `O que o cliente deve fazer:\n${linhasObrigacoes.join('\n')}` : null, arquivoValido ? 'A ata original está anexa a este registro.' : null]
    .filter(Boolean).join('\n\n') || null
  const { data: andamento, error: errAnd } = await supabase
    .from('processo_andamentos')
    .insert({
      processo_id: id,
      data_andamento: new Date(`${dataAudiencia}T12:00:00-03:00`).toISOString(),
      tipo: 'audiencia',
      titulo: `Ata de audiência — ${dataBR(dataAudiencia)}`,
      descricao,
      origem: 'manual',
      responsavel_id: advogadoId,
      criado_por: auth.userId,
    })
    .select('id')
    .single()
  if (errAnd || !andamento) return NextResponse.json({ error: errAnd?.message ?? 'Não foi possível registrar o andamento.' }, { status: 400 })

  const avisos: string[] = []

  // 2) Arquivo original no armazenamento privado.
  let arquivoPath: string | null = null
  if (arquivoValido) {
    try {
      arquivoPath = await uploadFileToStorage(buildCentralArquivosStoragePath({ originalName: arquivoValido.name, folderId: id, prefix: 'atas' }), arquivoValido)
    } catch (err) {
      avisos.push(`O arquivo original não foi guardado (${err instanceof Error ? err.message : 'erro'}); o texto da ata foi salvo.`)
    }
  }

  // 3) A ata em si (fonte do e-mail ao cliente na fase 2).
  const { data: ata, error: errAta } = await supabase
    .from('atas_audiencia')
    .insert({
      processo_id: id, andamento_id: andamento.id, data_audiencia: dataAudiencia, texto, resumo,
      arquivo_path: arquivoPath, arquivo_nome: arquivoPath ? arquivoValido!.name : null,
      obrigacoes_cliente: obrigacoes, criado_por: auth.userId,
    })
    .select('id')
    .single()
  if (errAta || !ata) {
    if (arquivoPath) await removeFileFromStorage(arquivoPath).catch(() => {})
    await supabase.from('processo_andamentos').delete().eq('id', andamento.id)
    return NextResponse.json({ error: errAta?.message ?? 'Não foi possível salvar a ata.' }, { status: 500 })
  }

  const baseAgenda = {
    status: 'pendente', source: 'manual', processo_id: id, cliente_id: processo.cliente_id ?? null,
    process_number: processo.numero_processo ?? null, client_name: clienteNome, ata_id: ata.id, andamento_id: null,
  }

  // 4) Agenda: obrigações do cliente que têm data (acompanhadas pelo advogado do processo).
  let naAgenda = 0
  const semData = obrigacoes.filter(o => !o.data).length
  const obrigacoesComData = obrigacoes.filter(o => o.data)
  if (obrigacoesComData.length > 0) {
    const nomeAdv = advogadoId ? nomeDe.get(advogadoId) ?? null : null
    const { data: itens, error } = await supabase.from('agenda_items').insert(obrigacoesComData.map(o => ({
      ...baseAgenda,
      titulo: `Cliente — ${o.titulo}`,
      descricao: [o.descricao, o.valor && `Valor: ${o.valor}`, 'Obrigação do cliente, conforme ata de audiência.'].filter(Boolean).join('\n'),
      tipo: 'prazo', prioridade: 'alta', data_inicio: o.data!, prazo_final: o.data!,
      responsavel: nomeAdv, responsible_user_id: advogadoId, responsible_name: nomeAdv,
    }))).select('id')
    if (error) avisos.push(`Obrigações do cliente não foram para a Agenda: ${error.message}`)
    else naAgenda += itens?.length ?? 0
  }

  // 5) Agenda + Kanban: tarefas do escritório.
  let noKanban = 0
  if (tarefas.length > 0) {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: itens, error } = await supabase.from('agenda_items').insert(tarefas.map(t => {
      const respId = t.responsavel_id ?? advogadoId
      const nome = respId ? nomeDe.get(respId) ?? null : null
      return {
        ...baseAgenda, titulo: t.titulo, descricao: [t.descricao, `Origem: ata de audiência de ${dataBR(dataAudiencia)}.`].filter(Boolean).join('\n'),
        tipo: 'tarefa', prioridade: 'media', data_inicio: t.prazo ?? hoje, prazo_final: t.prazo,
        responsavel: nome, responsible_user_id: respId, responsible_name: nome,
      }
    })).select('id')
    if (error || !itens) avisos.push(`Tarefas do escritório não foram para a Agenda: ${error?.message ?? 'erro'}`)
    else {
      naAgenda += itens.length
      const { data: maxRow } = await supabase.from('kanban_tasks').select('ordem').eq('status', 'a_fazer').order('ordem', { ascending: false }).limit(1).maybeSingle()
      let ordem = (maxRow?.ordem ?? 0) + 1
      const { data: cards, error: errCards } = await supabase.from('kanban_tasks').insert(tarefas.map((t, i) => {
        const sla = calculateSimpleSLA({ tipo: 'tarefa', origem: 'agenda', data: t.prazo, status: 'a_fazer', prioridade: 'media' })
        return {
          titulo: t.titulo, descricao: [t.descricao, `Ata de audiência de ${dataBR(dataAudiencia)} — ${processo.numero_processo ?? processo.titulo}`].filter(Boolean).join('\n\n'),
          tipo: 'tarefa', status: 'a_fazer', prioridade: 'media', origem: 'agenda', agenda_item_id: itens[i].id,
          responsavel_id: t.responsavel_id ?? advogadoId, data: t.prazo, processo_id: id, numero_processo: processo.numero_processo ?? null,
          criado_por: auth.userId, ordem: ordem++, sla_level: sla.sla_level, sla_due_at: sla.sla_due_at,
        }
      })).select('id')
      if (errCards) avisos.push(`Tarefas na Agenda, mas os cards do Kanban não foram criados: ${errCards.message}`)
      else noKanban = cards?.length ?? 0
    }
  }

  return NextResponse.json({ id: ata.id, andamento_id: andamento.id, na_agenda: naAgenda, no_kanban: noKanban, sem_data: semData, avisos }, { status: 201 })
}
