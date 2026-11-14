// ─── API: PATCH /api/monitoramento/clientes/[id] ─────────────────────────────
//
// Ativar/desativar e editar nome, variações de nome, contrato, vigência e observações.
// O documento (CPF/CNPJ) não muda: para outro documento, cadastre um novo.

import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { dataValida, listaDeNomes } from '@/lib/monitoramento-clientes/cadastro'
import { nomesUnicos, normalizarNome } from '@/lib/monitoramento-clientes/nomes'
import { PAPEIS_ESCRITA, respostaErroBanco } from '@/lib/monitoramento-clientes/api'

function textoOuNull(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim() : ''
  return t || null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PAPEIS_ESCRITA)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })

  let corpo: Record<string, unknown>
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }
  if (!corpo || typeof corpo !== 'object') return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })

  const patch: Record<string, unknown> = {}

  if ('ativo' in corpo) {
    if (typeof corpo.ativo !== 'boolean') return NextResponse.json({ error: 'ativo deve ser verdadeiro ou falso.' }, { status: 400 })
    patch.ativo = corpo.ativo
  }
  if ('nome_principal' in corpo) {
    const nome = typeof corpo.nome_principal === 'string' ? corpo.nome_principal.replace(/\s+/g, ' ').trim() : ''
    if (normalizarNome(nome).length < 3) return NextResponse.json({ error: 'Informe o nome do cliente.' }, { status: 400 })
    patch.nome_principal = nome
  }
  if ('nomes_busca' in corpo) {
    const principal = typeof patch.nome_principal === 'string' ? normalizarNome(patch.nome_principal) : null
    patch.nomes_busca = nomesUnicos(listaDeNomes(corpo.nomes_busca)).filter(n => normalizarNome(n) !== principal)
  }
  for (const campo of ['contrato_ref', 'observacoes'] as const) {
    if (campo in corpo) patch[campo] = textoOuNull(corpo[campo])
  }
  for (const campo of ['vigencia_inicio', 'vigencia_fim'] as const) {
    if (campo in corpo) {
      const valor = textoOuNull(corpo[campo])
      if (valor && !dataValida(valor)) return NextResponse.json({ error: 'Data inválida (use AAAA-MM-DD).' }, { status: 400 })
      patch[campo] = valor
    }
  }
  if ('cliente_id' in corpo) {
    if (corpo.cliente_id !== null && !isUUID(corpo.cliente_id)) return NextResponse.json({ error: 'cliente_id inválido.' }, { status: 400 })
    patch.cliente_id = corpo.cliente_id
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('monitoramento_documentos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Já existe um monitoramento ativo para este documento.' }, { status: 409 })
    return respostaErroBanco(error, 'Falha ao atualizar documento monitorado')
  }
  if (!data) return NextResponse.json({ error: 'Documento monitorado não encontrado.' }, { status: 404 })
  return NextResponse.json({ documento: data })
}
