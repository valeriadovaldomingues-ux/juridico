import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

function getDateParts(date: Date) {
  return { month: date.getMonth() + 1, day: date.getDate() }
}

function matchesDate(dateStr: string, month: number, day: number): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  return d.getMonth() + 1 === month && d.getDate() === day
}

// GET /api/aniversarios
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  // "this_week" = day after tomorrow through end of week (up to 7 days)
  const weekDays: { month: number; day: number }[] = []
  for (let i = 2; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    weekDays.push(getDateParts(d))
  }

  const todayParts    = getDateParts(today)
  const tomorrowParts = getDateParts(tomorrow)

  const [
    { data: clientes },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, tipo_pessoa, celular, telefone, tipo_contato, data_nascimento, responsavel_id')
      .not('data_nascimento', 'is', null)
      .eq('ignore_birthday', false)
      .eq('ativo', true),
    supabase
      .from('profiles')
      .select('id, nome, role, email, data_nascimento')
      .not('data_nascimento', 'is', null)
      .eq('ignore_birthday', false)
      .eq('ativo', true),
  ])

  const clientesList = clientes ?? []
  const profilesList = profiles ?? []

  const todayClientes    = clientesList.filter(c => matchesDate(c.data_nascimento!, todayParts.month, todayParts.day))
  const tomorrowClientes = clientesList.filter(c => matchesDate(c.data_nascimento!, tomorrowParts.month, tomorrowParts.day))
  const weekClientes     = clientesList.filter(c =>
    weekDays.some(wd => matchesDate(c.data_nascimento!, wd.month, wd.day))
  )

  const todayProfiles    = profilesList.filter(p => matchesDate(p.data_nascimento!, todayParts.month, todayParts.day))
  const tomorrowProfiles = profilesList.filter(p => matchesDate(p.data_nascimento!, tomorrowParts.month, tomorrowParts.day))
  const weekProfiles     = profilesList.filter(p =>
    weekDays.some(wd => matchesDate(p.data_nascimento!, wd.month, wd.day))
  )

  return NextResponse.json({
    today:    { clientes: todayClientes,    profiles: todayProfiles    },
    tomorrow: { clientes: tomorrowClientes, profiles: tomorrowProfiles },
    week:     { clientes: weekClientes,     profiles: weekProfiles     },
  })
}
