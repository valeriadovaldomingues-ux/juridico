import { requireRole } from '@/lib/auth/guards'
import Link from 'next/link'
import { Plug, Settings, UserCog } from 'lucide-react'

export default async function ConfiguracoesPage() {
  // Somente sócios acessam a página principal de configurações.
  // O proxy também bloqueia esta rota para outros papéis.
  await requireRole(['socio'])

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Configurações</h1>
        <p className="text-[13px] text-[#7a8899] mt-0.5">Administração e preferências do sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Gestão de usuários */}
        <Link href="/configuracoes/usuarios" className="group">
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 hover:border-[#145A5B] hover:shadow-[0_4px_16px_rgba(20,90,91,0.08)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#E8F2F2] flex items-center justify-center mb-4">
              <UserCog size={18} className="text-[#1D5F60]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#1a1d23] mb-1">Gestão de Usuários</h2>
            <p className="text-[13px] text-[#7a8899] leading-relaxed">
              Cadastre membros da equipe, defina perfis e gerencie acessos.
            </p>
            <span className="inline-flex items-center gap-1 mt-4 text-[12px] font-semibold text-[#1D5F60] group-hover:underline">
              Acessar &rarr;
            </span>
          </div>
        </Link>

        <Link href="/configuracoes/integracoes-processuais" className="group">
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 hover:border-[#145A5B] hover:shadow-[0_4px_16px_rgba(20,90,91,0.08)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#E8F2F2] flex items-center justify-center mb-4">
              <Plug size={18} className="text-[#1D5F60]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#1a1d23] mb-1">Integrações Processuais</h2>
            <p className="text-[13px] text-[#7a8899] leading-relaxed">
              Configure providers, acompanhe logs e teste consultas processuais seguras.
            </p>
            <span className="inline-flex items-center gap-1 mt-4 text-[12px] font-semibold text-[#1D5F60] group-hover:underline">
              Acessar &rarr;
            </span>
          </div>
        </Link>

        {/* Preferências do sistema — em breve */}
        <div className="bg-white rounded-lg border border-[#E2DDD8] border-dashed p-6 opacity-60">
          <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] flex items-center justify-center mb-4">
            <Settings size={18} className="text-[#a8b3c4]" />
          </div>
          <h2 className="text-[14px] font-semibold text-[#3d4a5c] mb-1">Preferências do Sistema</h2>
          <p className="text-[13px] text-[#a8b3c4] leading-relaxed">
            Integrações, notificações e configurações gerais.
          </p>
          <span className="inline-block mt-4 text-[11px] font-semibold text-[#7a8899] bg-[#F3F1EE] px-3 py-1 rounded-full uppercase tracking-wider">
            Em breve
          </span>
        </div>
      </div>
    </div>
  )
}
