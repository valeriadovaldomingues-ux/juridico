import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { normalizeCpfCnpj, detectDocSearchType } from '@/lib/cnpj'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio']

export interface ClienteBuscaResult {
  id:               string
  nome:             string
  nome_fantasia:    string | null
  cpf_cnpj:         string | null
  cnpj_raiz:        string | null
  tipo_pessoa:      string
  tipo_contato:     string
  socio_representante: string | null
}

/**
 * GET /api/clientes/busca?q=<query>&limit=15&tipo_contato=cliente
 *
 * Busca inteligente de clientes por:
 *  - nome / razão social
 *  - nome fantasia
 *  - sócio / representante
 *  - CNPJ completo (com ou sem máscara)
 *  - raiz do CNPJ (8 primeiros dígitos)
 *  - CPF (pessoa física)
 *  - fragmento numérico (contains)
 */
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const q            = searchParams.get('q')?.trim() ?? ''
  const limit        = Math.min(parseInt(searchParams.get('limit') ?? '15'), 50)
  const tipo_contato = searchParams.get('tipo_contato') ?? ''

  if (q.length < 2) return NextResponse.json([])

  const supabase  = await createClient()
  const digits    = normalizeCpfCnpj(q)
  const docType   = detectDocSearchType(q)

  let query = supabase
    .from('clientes')
    .select('id, nome, nome_fantasia, cpf_cnpj, cnpj_raiz, tipo_pessoa, tipo_contato, socio_representante')
    .eq('ativo', true)
    .limit(limit)
    .order('nome')

  if (tipo_contato) {
    query = query.eq('tipo_contato', tipo_contato)
  }

  switch (docType) {
    case 'cnpj_full':
      // Busca pelo CNPJ completo (14 dígitos). Aceita com ou sem máscara.
      query = query.or(
        `cnpj_raiz.eq.${digits.slice(0, 8)},` +
        `cpf_cnpj.ilike.%${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}%,` +
        `cpf_cnpj.ilike.%${digits}%`
      )
      break

    case 'cpf_full':
      // CPF (11 dígitos) — pesquisa contains, com ou sem formatação
      query = query.or(
        `cpf_cnpj.ilike.%${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}%,` +
        `cpf_cnpj.ilike.%${digits}%`
      )
      break

    case 'cnpj_root':
      // Raiz do CNPJ (8 dígitos) → busca exata em cnpj_raiz ou contains em cpf_cnpj
      query = query.or(`cnpj_raiz.eq.${digits},cpf_cnpj.ilike.%${digits}%`)
      break

    case 'partial_doc':
      // Fragmento numérico (2-13 dígitos): contains em cnpj_raiz e cpf_cnpj
      query = query.or(`cnpj_raiz.ilike.%${digits}%,cpf_cnpj.ilike.%${digits}%`)
      break

    default: {
      // Busca textual sem acento/ç, palavras em qualquer ordem; o que começa com o texto vem primeiro.
      const { data: ids, error: errIds } = await supabase.rpc('clientes_ids_busca', { q, lim: limit, tipo: tipo_contato || null })
      if (errIds) {
        console.error('[busca clientes]', errIds)
        return NextResponse.json({ error: errIds.message }, { status: 500 })
      }
      const ordem = (ids ?? []) as string[]
      if (ordem.length === 0) return NextResponse.json([])
      const { data: linhas, error: errLinhas } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cpf_cnpj, cnpj_raiz, tipo_pessoa, tipo_contato, socio_representante')
        .in('id', ordem)
      if (errLinhas) {
        console.error('[busca clientes]', errLinhas)
        return NextResponse.json({ error: errLinhas.message }, { status: 500 })
      }
      const porId = new Map((linhas ?? []).map(l => [l.id, l as ClienteBuscaResult]))
      return NextResponse.json(ordem.map(id => porId.get(id)).filter(Boolean))
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[busca clientes]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json((data ?? []) as ClienteBuscaResult[])
}
