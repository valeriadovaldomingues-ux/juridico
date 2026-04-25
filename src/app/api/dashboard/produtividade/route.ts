import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['socio']

export interface ProdutividadeRow {
  profile_id: string
  nome:       string
  role:       string
  total:      number
  no_prazo:   number
  adiantado:  number
  atrasado:   number
  sem_prazo:  number
}

/**
 * GET /api/dashboard/produtividade?inicio=ISO&fim=ISO
 *
 * Retorna produtividade agregada por colaborador no intervalo.
 * Restrito a sócios.
 */
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const inicio = searchParams.get('inicio')
  const fim    = searchParams.get('fim')

  if (!inicio || !fim) {
    return NextResponse.json({ error: 'Parâmetros inicio e fim são obrigatórios' }, { status: 400 })
  }

  // Validação básica: devem ser ISO datetime válidos
  if (isNaN(Date.parse(inicio)) || isNaN(Date.parse(fim))) {
    return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_produtividade_colaboradores', {
    p_inicio: inicio,
    p_fim:    fim,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Converter bigint strings para number (Supabase retorna bigint como string)
  const rows: ProdutividadeRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    profile_id: r.profile_id as string,
    nome:       r.nome       as string,
    role:       r.role       as string,
    total:      Number(r.total),
    no_prazo:   Number(r.no_prazo),
    adiantado:  Number(r.adiantado),
    atrasado:   Number(r.atrasado),
    sem_prazo:  Number(r.sem_prazo),
  }))

  return NextResponse.json(rows)
}
