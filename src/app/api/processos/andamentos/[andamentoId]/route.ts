import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeAndamentoOrigem, normalizeAndamentoTipo, podeEditarAndamento } from '@/lib/processos/andamentos'

function parseDataAndamento(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const CAMPOS = 'data_andamento, tipo, titulo, descricao, origem, responsavel_id'

// Edição: sócio e advogado (qualquer andamento) e estagiário (só observações). Cada edição grava o antes e o depois
// em processo_andamentos_historico. Usa o cliente de serviço porque a regra de banco só deixa o sócio alterar:
// a autorização é feita aqui.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ andamentoId: string }> },
) {
  const auth = await apiGuard(['socio', 'advogado', 'gerente', 'estagiario'])
  if (auth instanceof NextResponse) return auth

  const { andamentoId } = await params
  if (!andamentoId) {
    return NextResponse.json({ error: 'ID do andamento ausente' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const titulo = String((body as { titulo?: string }).titulo ?? '').trim()
  if (!titulo) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const dataAndamento = parseDataAndamento((body as { data_andamento?: string }).data_andamento ?? null)
  if (!dataAndamento) {
    return NextResponse.json({ error: 'Data do andamento inválida' }, { status: 400 })
  }

  const novo = {
    data_andamento: dataAndamento.toISOString(),
    tipo: normalizeAndamentoTipo((body as { tipo?: string }).tipo ?? null),
    titulo,
    descricao: String((body as { descricao?: string }).descricao ?? '').trim() || null,
    origem: normalizeAndamentoOrigem((body as { origem?: string }).origem ?? null),
    responsavel_id: String((body as { responsavel_id?: string }).responsavel_id ?? '').trim() || null,
  }

  const db = createServiceClient()
  const { data: atual, error: errAtual } = await db
    .from('processo_andamentos').select(`id, processo_id, ${CAMPOS}`).eq('id', andamentoId).maybeSingle()
  if (errAtual) return NextResponse.json({ error: errAtual.message }, { status: 500 })
  if (!atual) return NextResponse.json({ error: 'Andamento não encontrado' }, { status: 404 })

  if (!podeEditarAndamento(auth.role, atual, novo.tipo)) {
    return NextResponse.json({ error: 'Você não pode editar este andamento.' }, { status: 403 })
  }

  // O histórico vem ANTES da alteração: se não der para registrar, o andamento não é alterado.
  const { id: historicoId, error: errHist } = await db
    .from('processo_andamentos_historico')
    .insert({
      andamento_id: andamentoId,
      processo_id: atual.processo_id,
      acao: 'edicao',
      antes: Object.fromEntries(CAMPOS.split(', ').map(c => [c, (atual as Record<string, unknown>)[c] ?? null])),
      depois: novo,
      feito_por: auth.userId,
    })
    .select('id').single()
    .then(r => ({ id: r.data?.id as string | undefined, error: r.error }))
  if (errHist || !historicoId) {
    return NextResponse.json({ error: 'Não foi possível registrar o histórico da alteração. Nada foi alterado.' }, { status: 500 })
  }

  const { data, error } = await db
    .from('processo_andamentos')
    .update({ ...novo, updated_at: new Date().toISOString() })
    .eq('id', andamentoId)
    .select(`
      *,
      responsavel:profiles!responsavel_id(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    await db.from('processo_andamentos_historico').delete().eq('id', historicoId)
    return NextResponse.json({ error: error?.message ?? 'Erro ao atualizar andamento' }, { status: 400 })
  }

  return NextResponse.json(data)
}

// Exclusão: só o sócio. O que foi excluído fica no histórico (acao = 'exclusao') e as horas e tarefas ligadas ao
// andamento continuam (a ligação é desfeita, não apagada).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ andamentoId: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { andamentoId } = await params
  if (!andamentoId) {
    return NextResponse.json({ error: 'ID do andamento ausente' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: atual } = await db
    .from('processo_andamentos').select(`id, processo_id, ${CAMPOS}`).eq('id', andamentoId).maybeSingle()
  if (!atual) return NextResponse.json({ error: 'Andamento não encontrado' }, { status: 404 })

  const { error: errHist } = await db.from('processo_andamentos_historico').insert({
    andamento_id: andamentoId, processo_id: atual.processo_id, acao: 'exclusao', antes: atual, depois: null, feito_por: auth.userId,
  })
  if (errHist) return NextResponse.json({ error: 'Não foi possível registrar o histórico da exclusão. Nada foi excluído.' }, { status: 500 })

  const { error } = await db.from('processo_andamentos').delete().eq('id', andamentoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
