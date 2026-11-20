// Trilha de auditoria do portal (portal_acessos_log). Falha em silêncio: nunca derruba a operação principal.
// Sem dado pessoal em "detalhes" (nada de documento, e-mail ou código).

import type { Db } from './db'

export type AcaoPortalLog =
  | 'login'
  | 'logout'
  | 'download_relatorio'
  | 'pedido_criado'
  | 'pedido_aprovado'
  | 'pedido_rejeitado'
  | 'acesso_liberado'
  | 'acesso_revogado'
  | 'sessoes_encerradas'
  | 'processo_ocultado'
  | 'processo_reexibido'
  | 'previa_socio'
  | 'horas_visibilidade'

export async function registrarLogPortal(
  db: Db,
  entrada: {
    acao: AcaoPortalLog
    clienteId?: string | null
    processoId?: string | null
    pedidoId?: string | null
    usuarioId?: string | null
    detalhes?: Record<string, string | number | boolean | null>
  },
): Promise<void> {
  try {
    await db.from('portal_acessos_log').insert({
      acao: entrada.acao,
      cliente_id: entrada.clienteId ?? null,
      processo_id: entrada.processoId ?? null,
      pedido_id: entrada.pedidoId ?? null,
      usuario_id: entrada.usuarioId ?? null,
      detalhes: entrada.detalhes ?? null,
    })
  } catch {
    // silencioso
  }
}
