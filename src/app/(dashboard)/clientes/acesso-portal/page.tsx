import { requireRole } from '@/lib/auth/guards'
import { portalDb, tabelaAusente } from '@/lib/portal-cliente/db'
import { listarPedidosPendentes, type PedidoNaFila } from '@/lib/portal-cliente/gestao'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { PortalIndisponivel } from '@/lib/portal-cliente/segredos'
import type { UserRole } from '@/types'
import FilaPedidosAcesso from './FilaPedidosAcesso'

export const dynamic = 'force-dynamic'

export default async function AcessoPortalPage() {
  await requireRole(PORTAL_PAPEIS_GESTAO as UserRole[])

  let pedidos: PedidoNaFila[] = []
  let disponivel = true
  try {
    pedidos = await listarPedidosPendentes(portalDb())
  } catch (e) {
    if (e instanceof PortalIndisponivel || tabelaAusente(e as { message?: string })) disponivel = false
    else throw e
  }

  return (
    <div className="internal-page max-w-5xl space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Portal do Cliente</p>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Pedidos de acesso</h1>
        <p className="text-[13px] text-[#7a8899] mt-0.5">
          Clientes que pediram o primeiro acesso. Nenhum código é enviado até você aprovar. Para liberar um cliente direto, use o bloco &ldquo;Acesso ao portal&rdquo; na ficha dele.
        </p>
      </div>
      {!disponivel ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-800">
          O portal do cliente ainda não foi ativado no banco de dados (a migração <code>portal_cliente_v2_migration.sql</code> está pendente).
        </div>
      ) : (
        <FilaPedidosAcesso pedidos={pedidos} />
      )}
    </div>
  )
}
