import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

/**
 * DELETE /api/partes-processo/:id
 * Remove uma parte do processo. Restrito a sócios.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('partes_processo')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
