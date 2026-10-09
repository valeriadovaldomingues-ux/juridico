import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createDownloadUrl } from '@/lib/central-arquivos/storage'

// GET — link temporário para baixar a ata original.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; ataId: string }> }) {
  const auth = await apiGuard(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const { id, ataId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('atas_audiencia').select('arquivo_path').eq('id', ataId).eq('processo_id', id).maybeSingle()
  if (!data?.arquivo_path) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  try {
    return NextResponse.redirect(new URL(await createDownloadUrl(data.arquivo_path)))
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar o link do arquivo.' }, { status: 500 })
  }
}
