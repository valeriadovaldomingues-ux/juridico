import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { usuarioPodeMcp } from '@/lib/mcp/permitidos'
import ConectarClaude from './ConectarClaude'
import AcessosClaude from './AcessosClaude'
import { createServiceClient } from '@/lib/supabase/service'
import { listarAcessos } from '@/lib/mcp/oauth-acessos'

export default async function ConectarClaudePage() {
  const { userId, profile } = await requireAuth()
  const podeConectar = usuarioPodeMcp(userId, profile.role)
  // Sócio entra mesmo sem usar o conector: precisa ver e revogar os acessos de todos.
  if (!podeConectar && profile.role !== 'socio') redirect('/dashboard')
  // Ver e revogar acessos é só dos sócios (Valéria e Cristiano); os demais só conectam o próprio Claude.
  const ehSocio = profile.role === 'socio'
  const acessos = ehSocio ? await listarAcessos(createServiceClient()).catch(() => []) : []
  return (
    <div className="internal-page max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Conectar meu Claude ao PEDV</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Deixe o seu Claude consultar processos, agenda, prazos e publicações do PEDV, em linguagem normal, e também preencher dados no sistema (sempre pedindo a sua confirmação antes de gravar).</p>
      </div>
      {podeConectar && <ConectarClaude />}
      {ehSocio && <AcessosClaude iniciais={acessos} todos />}
    </div>
  )
}
