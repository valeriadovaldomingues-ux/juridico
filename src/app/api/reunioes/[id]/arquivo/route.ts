import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createDownloadUrl } from '@/lib/central-arquivos/storage'

// GET — link temporário para baixar o arquivo original da ata (qualquer pessoa da equipe).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('reunioes_pedv').select('arquivo_path').eq('id', id).maybeSingle()
  if (!data?.arquivo_path) return NextResponse.json({ error: 'Esta ata não tem arquivo guardado.' }, { status: 404 })
  try {
    return NextResponse.redirect(new URL(await createDownloadUrl(data.arquivo_path)))
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar o link do arquivo.' }, { status: 500 })
  }
}
