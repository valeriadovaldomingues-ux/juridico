import { createClient } from '@/lib/supabase/server'

// Página raiz do portal — placeholder para Fase 2 (dashboard real)
export default async function PortalHome() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: portalCliente } = user
    ? await supabase
        .from('portal_clientes')
        .select('clientes(nome)')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .single()
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomeCliente: string = (portalCliente as any)?.clientes?.nome
    ?? (portalCliente as any)?.clientes?.[0]?.nome
    ?? 'Cliente'

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-2xl border border-[#D0DCDC] p-8 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h1 className="text-[20px] font-semibold text-[#0f1923] mb-1">
          Olá, {nomeCliente}
        </h1>
        <p className="text-[13px] text-[#7a8899]">
          Bem-vindo ao portal do cliente PEDV.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#D0DCDC] p-8 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-[#9ca3af] text-center py-8">
          Funcionalidades em desenvolvimento. Em breve você poderá acompanhar
          seus processos, prazos e documentos aqui.
        </p>
      </div>

    </div>
  )
}
