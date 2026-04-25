import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** PATCH /api/automations/:id — atualiza configurações de uma automação */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body   = await req.json()

  const allowed = ['name', 'description', 'is_active', 'trigger_conditions', 'action_payload']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of allowed) {
    if (field in body) updates[field] = body[field]
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
