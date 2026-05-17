import { createClient } from '@/lib/supabase/server'
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
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Contatos</h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5 flex items-center gap-1.5">
            <Users size={12} />
            {clientes.length} registro{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 px-4 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} />
          Novo Contato
        </Link>
      </div>
      <ClientesTable
        clientes={clientes}
        profiles={profiles as Profile[] ?? []}
      />
    </div>
  )
}
