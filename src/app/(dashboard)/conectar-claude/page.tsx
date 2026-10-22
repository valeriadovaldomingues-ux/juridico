import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { usuarioPodeMcp } from '@/lib/mcp/permitidos'
import ConectarClaude from './ConectarClaude'

export default async function ConectarClaudePage() {
  const { userId } = await requireAuth()
  if (!usuarioPodeMcp(userId)) redirect('/dashboard')
  return (
    <div className="internal-page max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Conectar meu Claude ao PEDV</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Deixe o seu Claude (no computador) consultar processos, agenda, prazos e publicações do PEDV, em linguagem normal. Só leitura.</p>
      </div>
      <ConectarClaude />
    </div>
  )
}
