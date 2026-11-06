import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { usuarioPodeMcp } from '@/lib/mcp/permitidos'
import { validarPedidoAutorizacao } from '@/lib/mcp/oauth'
import Logo from '@/components/ui/Logo'
import Autorizar from './Autorizar'

// Tela de autorização do conector: o Claude manda a pessoa para cá; ela entra no PEDV (se preciso) e autoriza.
export const dynamic = 'force-dynamic'

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[460px]">
        <div className="flex justify-center mb-8"><Logo variant="login" /></div>
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_24px_70px_rgba(13,34,53,0.10)] p-7 sm:p-8">{children}</div>
      </div>
    </div>
  )
}

export default async function AutorizarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const um = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])
  const v = validarPedidoAutorizacao({
    client_id: um('client_id'), redirect_uri: um('redirect_uri'), state: um('state'),
    code_challenge: um('code_challenge'), code_challenge_method: um('code_challenge_method'), response_type: um('response_type'),
  })
  if (!v.ok) {
    return <Cartao><h1 className="font-brand text-[24px] text-[var(--color-ink)]">Não foi possível conectar</h1><p className="text-[13px] text-[var(--color-ink-3)] mt-2">{v.erro}</p></Cartao>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, val]) => (typeof val === 'string' ? [[k, val] as [string, string]] : [])))
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`)
  }
  if (!usuarioPodeMcp(user.id)) {
    return <Cartao><h1 className="font-brand text-[24px] text-[var(--color-ink)]">Acesso ainda não liberado</h1><p className="text-[13px] text-[var(--color-ink-3)] mt-2">Seu usuário ainda não foi liberado para o conector do Claude. Peça à Valéria para liberar.</p></Cartao>
  }

  const { pedido } = v
  return (
    <Cartao>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Conector do Claude</p>
      <h1 className="font-brand text-[26px] font-semibold leading-tight text-[var(--color-ink)]">Autorizar o {pedido.clienteNome} a acessar o PEDV?</h1>
      <p className="text-[13px] text-[var(--color-ink-3)] mt-3">Você entrou como <strong>{user.email}</strong>. O Claude poderá consultar processos, agenda, prazos e publicações e, se você tiver permissão, registrar andamentos e compromissos, sempre pedindo a sua confirmação antes de gravar. Nada é apagado.</p>
      <p className="text-[12px] text-[var(--color-ink-3)] mt-2">Você pode desligar esse acesso quando quiser.</p>
      <Autorizar pedido={{ client_id: pedido.clientId, redirect_uri: pedido.redirectUri, state: pedido.state, code_challenge: pedido.codeChallenge }} />
    </Cartao>
  )
}
