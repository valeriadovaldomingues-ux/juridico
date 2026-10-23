import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { removeFileFromStorage } from '@/lib/central-arquivos/storage'

// DELETE — só sócio apaga uma ata de reunião (a lixeirinha). Quem apagou fica registrado no banco.
// Os cartões já criados no Kanban continuam; só perdem o vínculo com a ata.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const supabase = await createClient()
  const { data: arquivoPath, error } = await supabase.rpc('apagar_reuniao_pedv', { p_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (arquivoPath) await removeFileFromStorage(arquivoPath as string).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
