import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES } from '@/lib/portal-cliente/anti-abuso'
import { BUCKET_ENVIOS, solicitarEnvio } from '@/lib/portal-cliente/envios'
import { json, lerCorpoJson, tratarErro } from '@/lib/portal-cliente/http'

/**
 * POST /api/portal/envios { nome, tamanho, processo_id?, descricao? }
 * Passo 1 do envio de documento: o servidor valida (tipo, 25 MB, processo do próprio cliente), cria o registro "pendente"
 * e devolve uma URL assinada de uso único para UM caminho. O navegador então envia o arquivo direto ao Storage e chama
 * /api/portal/envios/[id]/confirmar. Na visualização do sócio ("ver como cliente") não envia nada.
 */
export async function POST(request: Request) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  if (session.previa) return json({ error: 'Na visualização do escritório não é possível enviar documentos.' }, 403)

  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro
  const { nome, tamanho, processo_id, descricao } = lido.corpo

  try {
    const db = portalDb()
    const limite = await aplicarLimites(db, [LIMITES.envioPorCliente(session.clienteId)])
    if (!limite.ok) return json({ error: 'Muitos envios em pouco tempo. Tente de novo daqui a pouco.' }, 429)

    const r = await solicitarEnvio(db, session.clienteId, { nome, tamanho, processoId: processo_id, descricao })
    if (!r.ok) return json({ error: r.erro }, r.status)

    const { data, error } = await db.storage.from(BUCKET_ENVIOS).createSignedUploadUrl(r.envio.caminho)
    if (error || !data?.token) {
      await db.from('portal_envios').delete().eq('id', r.envio.id).eq('cliente_id', session.clienteId)
      throw new Error('envios: url assinada')
    }
    return json({ id: r.envio.id, caminho: r.envio.caminho, token: data.token, contentType: r.envio.contentType, bucket: BUCKET_ENVIOS })
  } catch (e) {
    return tratarErro(e, 'envios')
  }
}
