import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
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

  // Título, número, cliente (nome/fantasia/sócio/CPF-CNPJ) e partes: tudo sem acento/ç (processos_ids_busca).
  const { data: idsBusca, error: errBusca } = await supabase.rpc('processos_ids_busca', { q })
  if (errBusca) throw new Error(errBusca.message)
  const idsEncontrados = (idsBusca ?? []) as string[]
  if (idsEncontrados.length > 0) {
    const { data } = await supabase
      .from('processos')
      .select(selectFields)
      .in('status', ['ativo', 'suspenso'])
      .in('id', idsEncontrados.slice(0, 200))
      .limit(limit * 3)
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
