import { createClient } from '@/lib/supabase/server'
import { createClient as svcClient }  from '@supabase/supabase-js'

let _svc: ReturnType<typeof svcClient> | null = null
function getServiceClient() {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _svc = svcClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import ClientesTable from './ClientesTable'
import type { Cliente, Profile } from '@/types'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('clientes')
    .select('*, responsavel:profiles!responsavel_id(id, nome, role)')
    .order('nome', { ascending: true })

  if (params.nome)       query = query.ilike('nome', `%${params.nome}%`)
  if (params.cpf_cnpj)   query = query.ilike('cpf_cnpj', `%${params.cpf_cnpj}%`)
  if (params.cidade)     query = query.ilike('cidade', `%${params.cidade}%`)
  if (params.tipo_contato) query = query.eq('tipo_contato', params.tipo_contato)
  if (params.responsavel_id) query = query.eq('responsavel_id', params.responsavel_id)
  if (params.ativo !== undefined) query = query.eq('ativo', params.ativo === 'true')

  const { data: clientesRaw } = await query

  // Busca contagem de processos por cliente
  const { data: contagemProcessos } = await supabase
    .from('processos')
    .select('cliente_id')

  const countMap: Record<string, number> = {}
  for (const p of contagemProcessos ?? []) {
    countMap[p.cliente_id] = (countMap[p.cliente_id] ?? 0) + 1
  }

  const clientes: Cliente[] = (clientesRaw ?? []).map((c: any) => ({
    ...c,
    processos_count: countMap[c.id] ?? 0,
  }))

  // Busca profiles para o filtro de responsável
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, role')
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="internal-page space-y-6 max-w-7xl">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
            Relacionamento
          </p>
          <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
            Contatos
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)] mt-2 flex items-center gap-1.5">
            <Users size={12} />
            {clientes.length} registro{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 px-4 py-3 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} />
          Novo Contato
        </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] overflow-hidden">
        <ClientesTable
          clientes={clientes}
          profiles={profiles as Profile[] ?? []}
        />
      </div>
    </div>
  )
}
