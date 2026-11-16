// ─────────────────────────────────────────────────────────────────────────────
// CRM Cris e Val — helpers compartilhados pelas API routes (/api/crm-socios/*).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { createClient } from '@/lib/supabase/server'
import {
  CRM_SOCIOS_PAPEIS,
  CRM_SOCIOS_RESPONSAVEL_PAPEIS,
} from './constants'
import {
  CODIGO_MODULO_NAO_ATIVADO,
  MENSAGEM_MODULO_NAO_ATIVADO,
  ehTabelaAusente,
  type ErroBanco,
} from './modulo'

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/**
 * Guard único de TODAS as rotas do módulo: sessão válida + conta ativa + papel em CRM_SOCIOS_PAPEIS.
 * Devolve `{ role, userId }` ou um NextResponse (401/403) para retornar na hora.
 */
export async function exigirSocios() {
  return apiGuard([...CRM_SOCIOS_PAPEIS])
}

/** Traduz erro do banco em resposta HTTP. Tabelas ausentes viram 503 com código estável. */
export function respostaErroBanco(erro: ErroBanco, mensagemPadrao: string): NextResponse {
  if (ehTabelaAusente(erro)) {
    return NextResponse.json(
      { error: MENSAGEM_MODULO_NAO_ATIVADO, codigo: CODIGO_MODULO_NAO_ATIVADO },
      { status: 503 },
    )
  }
  // 23503 = violação de chave estrangeira (cliente/responsável/oportunidade inexistente)
  if (erro.code === '23503') {
    return NextResponse.json({ error: 'Um dos vínculos informados não existe mais.' }, { status: 400 })
  }
  // 23514 = violação de CHECK
  if (erro.code === '23514') {
    return NextResponse.json({ error: 'Algum valor informado não é permitido.' }, { status: 400 })
  }
  return NextResponse.json({ error: mensagemPadrao }, { status: 500 })
}

/** Responsável só pode ser perfil ativo com papel de sócio (Valéria ou Cristiano). */
export async function responsavelEhSocio(supabase: SupabaseServer, id: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('ativo', true)
    .in('role', [...CRM_SOCIOS_RESPONSAVEL_PAPEIS])
    .maybeSingle()
  return !!data
}

/** Select padrão da oportunidade com responsável e cliente vinculado. */
export const SELECT_OPORTUNIDADE =
  '*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), cliente:clientes!cliente_id(id, nome)'

export async function lerJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null)
}
