import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { Cobranca } from '@/types/cobrancas'
import CobrancasPage from './CobrancasPage'

interface ClienteOpcao {
  id: string
  nome: string
  cpf_cnpj: string | null
  email: string | null
}

interface ProcessoOpcao {
  id: string
  numero_processo: string | null
  titulo: string | null
  cliente_id: string | null
}

export default async function CobrancasRoute() {
  const { profile } = await requireRole(['administrativo', 'gerente', 'socio'])
  const supabase = await createClient()

  const [{ data: cobrancas }, { data: clientes }, { data: processos }] = await Promise.all([
    supabase
      .from('cobrancas')
      .select('*, cliente:clientes(id, nome, cpf_cnpj, email), processo:processos(id, numero_processo, titulo)')
      .order('data_vencimento', { ascending: false })
      .limit(500),
    supabase
      .from('clientes')
      .select('id, nome, cpf_cnpj, email')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('processos')
      .select('id, numero_processo, titulo, cliente_id')
      .in('status', ['ativo', 'suspenso'])
      .order('titulo'),
  ])

  return (
    <CobrancasPage
      initialCobrancas={(cobrancas ?? []) as Cobranca[]}
      clientes={(clientes ?? []) as ClienteOpcao[]}
      processos={(processos ?? []) as ProcessoOpcao[]}
      role={profile.role}
    />
  )
}
