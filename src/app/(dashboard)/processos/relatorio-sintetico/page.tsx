import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import { listarPessoasComProcessos } from '@/lib/relatorio-sintetico/dados'
import RelatorioSinteticoForm from './RelatorioSinteticoForm'

// Relatório sintético de processos em nome de uma pessoa (ex.: José Silvestre, parte em processos de várias empresas).
export default async function RelatorioSinteticoPage() {
  await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  const pessoas = await listarPessoasComProcessos(await createClient())

  return (
    <div className="internal-page space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/processos" className="flex items-center gap-1.5 text-[13px] text-[#6b7280] hover:text-[#1a1d23]"><ArrowLeft size={14} /> Processos</Link>
        <span className="text-[#d1d5db]">/</span>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Relatório sintético de processos</h1>
      </div>
      <p className="text-[13px] text-[#6b7280]">
        PDF com todos os processos em que a pessoa é parte (em qualquer empresa dela): dados do processo, partes e andamentos, no padrão do relatório do EasyJur.
      </p>
      <RelatorioSinteticoForm pessoas={pessoas} />
    </div>
  )
}
