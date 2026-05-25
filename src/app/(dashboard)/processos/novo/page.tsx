import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import ProcessoForm from '../ProcessoForm'
import { Scale } from 'lucide-react'

export default async function NovoProcessoPage() {
  // estagiario e comercial não criam processos
  await requireRole(['administrativo', 'advogado', 'gerente', 'socio'])
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="internal-page space-y-6 max-w-5xl">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
            Cadastro processual
          </p>
          <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
            Novo Processo
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)] mt-2 flex items-center gap-1.5">
            <Scale size={12} />
            Preencha os dados principais do processo.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] p-1 sm:p-2">
        <ProcessoForm clientes={clientes ?? []} />
      </div>
    </div>
  )
}
