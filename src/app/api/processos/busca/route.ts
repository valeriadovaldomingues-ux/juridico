import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { escapeLike, normalizeSearchText } from '@/lib/cnpj'
import { buildProcessoLookupOption, type ProcessoSearchRecord } from '@/lib/processos/search'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

function clampLimit(value: string | null, fallback = 10) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 20)
}

async function buscarProcessosRelacionados(q: string, limit: number) {
  const supabase = await createClient()
  const normalized = normalizeSearchText(q)
  const safe = escapeLike(q)
  const digits = q.replace(/\D/g, '')

  const ids = new Set<string>()
  const candidatos: ProcessoSearchRecord[] = []

  const selectFields = `
    id,
    numero_processo,
    titulo,
    area_direito,
    status,
    cliente:clientes(nome),
    partes_processo(pessoa_nome, tipo_parte)
  `

  const addRecords = (rows: ProcessoSearchRecord[] | null | undefined) => {
    for (const row of rows ?? []) {
      if (ids.has(row.id)) continue
      ids.add(row.id)
      candidatos.push(row)
    }
  }

  const [porTexto, porCliente, porParte] = await Promise.all([
    supabase
      .from('processos')
      .select(selectFields)
      .in('status', ['ativo', 'suspenso'])
      .or([
        `numero_processo.ilike.%${safe}%`,
        `titulo.ilike.%${safe}%`,
        `area_direito.ilike.%${safe}%`,
        `status.ilike.%${safe}%`,
      ].join(','))
      .limit(limit * 2),
    supabase
      .from('clientes')
      .select('id')
      .eq('ativo', true)
      .or([
        `nome.ilike.%${safe}%`,
        digits ? `cpf_cnpj.ilike.%${digits}%` : null,
        normalized ? `nome_fantasia.ilike.%${safe}%` : null,
        normalized ? `socio_representante.ilike.%${safe}%` : null,
      ].filter(Boolean).join(','))
      .limit(limit * 2),
    supabase
      .from('partes_processo')
      .select('processo_id, pessoa_nome, tipo_parte')
      .ilike('pessoa_nome', `%${safe}%`)
      .limit(limit * 2),
  ])

  addRecords((porTexto.data ?? []) as ProcessoSearchRecord[])

  const clienteIds = (porCliente.data ?? []).map((cliente: { id: string }) => cliente.id)
  if (clienteIds.length > 0) {
    const { data } = await supabase
      .from('processos')
      .select(selectFields)
      .in('status', ['ativo', 'suspenso'])
      .in('cliente_id', clienteIds)
      .limit(limit * 2)
    addRecords(data as ProcessoSearchRecord[])
  }

  const processoIds = (porParte.data ?? []).map((parte: { processo_id: string | null }) => parte.processo_id).filter(Boolean) as string[]
  if (processoIds.length > 0) {
    const { data } = await supabase
      .from('processos')
      .select(selectFields)
      .in('status', ['ativo', 'suspenso'])
      .in('id', processoIds)
      .limit(limit * 2)
    addRecords(data as ProcessoSearchRecord[])
  }

  const ordenados = candidatos
    .map(record => ({ record, option: buildProcessoLookupOption(record) }))
    .sort((a, b) => {
      const aNumber = a.record.numero_processo ?? ''
      const bNumber = b.record.numero_processo ?? ''
      if (aNumber && bNumber && aNumber !== bNumber) return aNumber.localeCompare(bNumber)
      return a.record.titulo.localeCompare(b.record.titulo, 'pt-BR')
    })
    .slice(0, limit)

  return ordenados.map(item => item.option)
}

export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = clampLimit(req.nextUrl.searchParams.get('limit'), 10)

  if (q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const options = await buscarProcessosRelacionados(q, limit)
    return NextResponse.json(options)
  } catch (error) {
    console.error('[busca processos]', error)
    return NextResponse.json({ error: 'Erro ao buscar processos' }, { status: 500 })
  }
}
