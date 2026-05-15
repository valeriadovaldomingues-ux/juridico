import { createClient } from '@/lib/supabase/server'
import Link             from 'next/link'
import { Scale, CalendarDays, FileText, MessageSquare, ArrowRight } from 'lucide-react'

const QUICK_LINKS = [
  { href: '/portal/processos',  icon: Scale,         label: 'Meus Processos',  desc: 'Acompanhe o andamento' },
  { href: '/portal/agenda',     icon: CalendarDays,  label: 'Agenda e Prazos', desc: 'Audiências e vencimentos' },
  { href: '/portal/documentos', icon: FileText,      label: 'Documentos',      desc: 'Arquivos liberados'       },
  { href: '/portal/mensagens',  icon: MessageSquare, label: 'Mensagens',       desc: 'Fale com o escritório'   },
]

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

  // Primeiro nome apenas
  const primeiroNome = nomeCliente.split(' ')[0]

  return (
    <div className="space-y-8">

      {/* ── Boas-vindas ──────────────────────────────────────────────────── */}
      <div className="bg-[#0C1B2A] px-8 py-10 relative overflow-hidden">

        {/* Linha dourada decorativa */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/50 to-transparent" />

        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[#C49557] text-[10px] tracking-[0.2em] uppercase mb-3">
              Bem-vindo ao portal
            </p>
            <h1
              className="text-white text-[32px] sm:text-[40px] leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
            >
              {primeiroNome}
            </h1>
            <p className="text-white/40 text-[13px] mt-2 max-w-sm leading-relaxed">
              Acompanhe seus processos, prazos e documentos com clareza e segurança jurídica.
            </p>
          </div>

          {/* Assinatura discreta */}
          <span className="text-white/10 text-[11px] tracking-[0.15em] uppercase self-start mt-2">
            P&amp;V · MMV
          </span>
        </div>

        {/* Linha dourada decorativa inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#C49557]/30 via-transparent to-transparent" />
      </div>

      {/* ── Acesso rápido ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-4">
          Acesso rápido
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 bg-white border border-[#E8E3D8] px-5 py-4 hover:border-[#C49557]/40 hover:shadow-sm transition-all"
            >
              <div className="w-9 h-9 border border-[#E8E3D8] group-hover:border-[#C49557]/40 flex items-center justify-center shrink-0 transition-colors">
                <Icon size={15} className="text-[#C49557]" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1C1C2E]">{label}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{desc}</p>
              </div>
              <ArrowRight
                size={13}
                className="text-[#E8E3D8] group-hover:text-[#C49557] transition-colors shrink-0"
              />
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
