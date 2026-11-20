import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { confirmarEnvio } from '@/lib/portal-cliente/envios'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { json, tratarErro } from '@/lib/portal-cliente/http'
import { isUUID } from '@/lib/portal/validate'

/** POST /api/portal/envios/[id]/confirmar — passo 2: confere no Storage que o arquivo chegou e publica o envio para a equipe. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  if (session.previa) return json({ error: 'Na visualização do escritório não é possível enviar documentos.' }, 403)
  const { id } = await params
  if (!isUUID(id)) return json({ error: 'Envio não encontrado.' }, 404)
  try {
    const db = portalDb()
    const r = await confirmarEnvio(db, session.clienteId, id)
    if (!r.ok) return json({ error: r.erro }, r.status)
    await registrarLogPortal(db, { acao: 'envio_documento', clienteId: session.clienteId, detalhes: { bytes: r.tamanho } })
    return json({ ok: true })
  } catch (e) {
    return tratarErro(e, 'envios-confirmar')
  }
}
