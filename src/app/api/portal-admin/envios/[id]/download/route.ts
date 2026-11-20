import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { BUCKET_ENVIOS } from '@/lib/portal-cliente/envios'
import { PAPEIS_ENVIOS } from '@/lib/portal-cliente/envios-constantes'
import { json, tratarErro } from '@/lib/portal-cliente/http'
import { isUUID } from '@/lib/portal/validate'

/**
 * GET /api/portal-admin/envios/[id]/download — URL assinada de 5 minutos (download forçado) e marca como visto.
 * O arquivo nunca é público: só quem da equipe está logado chega aqui.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PAPEIS_ENVIOS)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return json({ error: 'Arquivo não encontrado.' }, 404)
  try {
    const db = portalDb()
    const { data: envio, error } = await db
      .from('portal_envios')
      .select('id, storage_path, nome_original, visto_em')
      .eq('id', id)
      .eq('status', 'enviado')
      .maybeSingle()
    if (error) throw new Error('envios')
    if (!envio) return json({ error: 'Arquivo não encontrado.' }, 404)
    const { data, error: eUrl } = await db.storage.from(BUCKET_ENVIOS).createSignedUrl(envio.storage_path as string, 300, { download: envio.nome_original as string })
    if (eUrl || !data?.signedUrl) return json({ error: 'Não foi possível abrir o arquivo agora.' }, 502)
    if (!envio.visto_em) await db.from('portal_envios').update({ visto_por: auth.userId, visto_em: new Date().toISOString() }).eq('id', id)
    return NextResponse.redirect(data.signedUrl, 302)
  } catch (e) {
    return tratarErro(e, 'envios-download')
  }
}
