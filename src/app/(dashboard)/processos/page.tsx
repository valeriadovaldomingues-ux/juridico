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
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Processos</h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5 flex items-center gap-1.5">
            <Scale size={12} />
            {processos?.length ?? 0} registro{(processos?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/processos/novo"
          className="flex items-center gap-2 px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} />
          Novo Processo
        </Link>
      </div>
      <ProcessosTable processos={processos ?? []} />
    </div>
  )
}
