import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Scale } from 'lucide-react'
import ProcessosTable from './ProcessosTable'

export default async function ProcessosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('processos')
    .select('*, cliente:clientes(id, nome), partes_processo(id, pessoa_nome, tipo_parte)')
    .order('created_at', { ascending: false })

  if (params.titulo) query = query.ilike('titulo', `%${params.titulo}%`)
  if (params.numero) query = query.ilike('numero_processo', `%${params.numero}%`)
  if (params.area_direito) query = query.eq('area_direito', params.area_direito)
  if (params.status) query = query.eq('status', params.status)

  const { data: processos } = await query

  return (
    <div className="internal-page space-y-6 max-w-7xl">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
            Gestão processual
          </p>
          <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
            Processos
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)] mt-2 flex items-center gap-1.5">
            <Scale size={12} />
            {processos?.length ?? 0} registro{(processos?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/processos/novo"
          className="flex items-center gap-2 px-4 py-3 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} />
          Novo Processo
        </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] overflow-hidden">
        <ProcessosTable processos={processos ?? []} />
      </div>
    </div>
  )
}
