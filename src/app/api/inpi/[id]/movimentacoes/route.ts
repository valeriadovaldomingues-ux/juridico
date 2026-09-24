import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { notificarMovimentacaoInpiNoTrello } from '@/lib/inpi/trello-notify'
import type { UserRole } from '@/types'

const EDIT_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// POST /api/inpi/[id]/movimentacoes — lançamento manual de movimentação
// (a sincronização automática da RPI insere direto no banco via cron, não por aqui).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(EDIT_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const { rpi_data, descricao, codigo_despacho } = body

  if (!rpi_data) return NextResponse.json({ error: 'Data da publicação é obrigatória.' }, { status: 400 })
  if (!descricao?.trim()) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })

  const supabase = await createClient()

  const { data: processo, error: errProcesso } = await supabase
    .from('inpi_processos')
    .select('id, numero_processo, titulo, cliente:clientes!cliente_id(nome)')
    .eq('id', id)
    .single()
  if (errProcesso || !processo) return NextResponse.json({ error: 'Processo INPI não encontrado.' }, { status: 404 })

  const { data, error } = await supabase
    .from('inpi_movimentacoes')
    .insert({
      inpi_processo_id: id,
      rpi_data,
      codigo_despacho: codigo_despacho?.trim() || null,
      descricao: descricao.trim(),
      origem: 'manual',
      created_by: auth.userId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se o despacho lançado manualmente for a concessão, atualiza a data de
  // concessão do processo (mesma regra que a sincronização automática aplica
  // para IPAS158). Detecta por texto porque lançamento manual não tem código.
  const pareceConcessao =
    codigo_despacho?.trim().toUpperCase() === 'IPAS158' ||
    /concess[ãa]o de registro/i.test(descricao)
  if (pareceConcessao) {
    await supabase.from('inpi_processos').update({ status: 'concedido', data_concessao: rpi_data }).eq('id', id)
  }

  // Best-effort (a função em si nunca lança) — aguarda pra não perder a
  // chamada quando a função serverless congela logo após a resposta.
  await notificarMovimentacaoInpiNoTrello(supabase, {
    processo: { numero_processo: processo.numero_processo, titulo: processo.titulo, cliente: processo.cliente },
    movimentacao: { descricao: data.descricao, rpi_data: data.rpi_data, codigo_despacho: data.codigo_despacho, origem: 'manual' },
  })

  return NextResponse.json(data, { status: 201 })
}
