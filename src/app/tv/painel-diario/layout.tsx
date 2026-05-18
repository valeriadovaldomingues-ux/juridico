import { requireRole } from '@/lib/auth/guards'

export const metadata = {
  title: 'Painel Diário — Pessoa e do Val Advocacia',
}

/**
 * Layout isolado para o Painel TV Diário.
 * Sem Sidebar nem Header do dashboard — tela limpa para exibição em TV.
 * Acesso restrito a gerente e sócio.
 */
export default async function PainelDiarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Guard server-side — consistente com o padrão do sistema
  await requireRole(['gerente', 'socio'])

  return (
    <div
      className="w-screen h-screen overflow-hidden text-white select-none"
      style={{ background: '#030C17' }}
    >
      {children}
    </div>
  )
}
