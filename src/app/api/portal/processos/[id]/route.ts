import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { listarAndamentos, listarPartes, obterProcessoDoCliente } from '@/lib/portal-cliente/consultas'
import { json, tratarErro } from '@/lib/portal-cliente/http'

/**
 * GET /api/portal/processos/[id]
 * Detalhe de UM processo: dados básicos, partes (autor/réu/terceiro) e andamentos client-safe.
 *
 * O id da URL só vale se o processo for do cliente da sessão E visível no portal; qualquer outro caso
 * (processo de outro cliente, oculto, segredo de justiça, inexistente, id inválido) responde 404 idêntico.
 *
 * Nunca expostos: observacoes, valor_causa, advogado_*, parte_contraria (texto interno), documento das partes,
 * partes do tipo "outro", andamentos internos (contato com cliente, observação, prazo, documento, Aurora/sistema).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  const { id } = await params
  try {
    const db = portalDb()
    const processo = await obterProcessoDoCliente(db, session.clienteId, id)
    if (!processo) return json({ error: 'Processo não encontrado.' }, 404)
    const [partes, andamentos] = await Promise.all([listarPartes(db, [processo.id]), listarAndamentos(db, processo.id)])
    return json({ ...processo, partes: partes.get(processo.id) ?? [], andamentos })
  } catch (e) {
    return tratarErro(e, 'processo')
  }
}
