// ─── API: /api/monitoramento/clientes ────────────────────────────────────────
//
// GET  → documentos monitorados + contagem de alertas novos
// POST → cadastra UM ou VÁRIOS documentos (objeto, lista, ou { documentos: [...] })
//
// As tabelas têm RLS sem policies: acesso só por service role, depois do apiGuard.
// Nesta fase NÃO há consulta externa de CNPJ: o nome do cliente é obrigatório.

import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { validarEntradaDocumento, type EntradaDocumento } from '@/lib/monitoramento-clientes/cadastro'
import {
  mapaClientesPorDocumento, PAPEIS_ESCRITA, PAPEIS_LEITURA, respostaErroBanco,
} from '@/lib/monitoramento-clientes/api'

const MAX_DOCUMENTOS_POR_PEDIDO = 500

export async function GET() {
  const auth = await apiGuard(PAPEIS_LEITURA)
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()
  const { data: docs, error } = await supabase
    .from('monitoramento_documentos')
    .select('*, cliente:clientes(id, nome)')
    .order('nome_principal', { ascending: true })
  if (error) return respostaErroBanco(error, 'Falha ao listar documentos monitorados')

  const { data: novos, error: erroAlertas } = await supabase
    .from('monitoramento_alertas')
    .select('monitoramento_id')
    .eq('status', 'novo')
  if (erroAlertas) return respostaErroBanco(erroAlertas, 'Falha ao contar alertas')

  const contagem = new Map<string, number>()
  for (const a of (novos ?? []) as Array<{ monitoramento_id: string }>) {
    contagem.set(a.monitoramento_id, (contagem.get(a.monitoramento_id) ?? 0) + 1)
  }

  const documentos = ((docs ?? []) as Array<Record<string, unknown> & { id: string; cliente?: unknown }>).map(d => {
    const cliente = (Array.isArray(d.cliente) ? d.cliente[0] : d.cliente) as { id: string; nome: string } | null | undefined
    return { ...d, cliente: cliente ?? null, alertas_novos: contagem.get(d.id) ?? 0 }
  })
  return NextResponse.json({ documentos })
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(PAPEIS_ESCRITA)
  if (auth instanceof NextResponse) return auth

  let corpo: unknown
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const entradas: unknown[] = Array.isArray(corpo)
    ? corpo
    : Array.isArray((corpo as { documentos?: unknown })?.documentos)
      ? (corpo as { documentos: unknown[] }).documentos
      : corpo && typeof corpo === 'object' ? [corpo] : []
  if (entradas.length === 0) return NextResponse.json({ error: 'Nenhum documento informado.' }, { status: 400 })
  if (entradas.length > MAX_DOCUMENTOS_POR_PEDIDO) {
    return NextResponse.json({ error: `Máximo de ${MAX_DOCUMENTOS_POR_PEDIDO} documentos por pedido.` }, { status: 400 })
  }

  const supabase = createServiceClient()
  let clientesPorDoc: Map<string, string | null>
  try { clientesPorDoc = await mapaClientesPorDocumento(supabase) } catch (e) {
    return respostaErroBanco({ message: e instanceof Error ? e.message : String(e) }, 'Falha ao consultar clientes')
  }

  const criados: unknown[] = []
  const erros: Array<{ indice: number; documento: string | null; erro: string }> = []
  const vistosNoPedido = new Set<string>()

  for (const [indice, bruta] of entradas.entries()) {
    const entrada = (bruta && typeof bruta === 'object' ? bruta : {}) as EntradaDocumento
    const validacao = validarEntradaDocumento(entrada)
    if (!validacao.ok) {
      erros.push({ indice, documento: typeof entrada.documento === 'string' ? entrada.documento : null, erro: validacao.erro })
      continue
    }
    const v = validacao.valor
    if (vistosNoPedido.has(v.documento)) {
      erros.push({ indice, documento: v.documento, erro: 'Documento repetido neste pedido.' })
      continue
    }
    vistosNoPedido.add(v.documento)

    const { data, error } = await supabase
      .from('monitoramento_documentos')
      .insert({ ...v, cliente_id: clientesPorDoc.get(v.documento) ?? null, created_by: auth.userId })
      .select('*')
      .single()
    if (error) {
      // 23505 = índice único (documento já monitorado e ativo)
      if (error.code === '23505') { erros.push({ indice, documento: v.documento, erro: 'Este documento já está sendo monitorado.' }); continue }
      return respostaErroBanco(error, 'Falha ao cadastrar documento')
    }
    criados.push(data)
  }

  return NextResponse.json({ criados: criados.length, documentos: criados, erros }, { status: criados.length > 0 ? 201 : 400 })
}
