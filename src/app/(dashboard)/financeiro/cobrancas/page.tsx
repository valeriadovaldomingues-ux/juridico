import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { Cobranca } from '@/types/cobrancas'
import CobrancasPage from './CobrancasPage'

interface ClienteOpcao {
  id: string
  nome: string
  cpf_cnpj: string | null
  email: string | null
  tipo_pessoa: string | null
  cep: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

interface ProcessoOpcao {
  id: string
  numero_processo: string | null
  titulo: string | null
  cliente_id: string | null
}

export default async function CobrancasRoute() {
  const { profile } = await requireRole(['socio'])
  const supabase = await createClient()

  // Só clientes de boleto (os da grade "Receita Partido") e quem já tem cobrança. A lista completa passava
  // de 1.000 clientes e o limite do banco cortava a lista na letra M.
  const [{ data: cobrancas }, { data: daGrade }] = await Promise.all([
    supabase
      .from('cobrancas')
      .select('*, cliente:clientes(id, nome, cpf_cnpj, email), processo:processos(id, numero_processo, titulo)')
      .order('data_vencimento', { ascending: false })
      .limit(500),
    supabase
      .from('grade_pagamento_clientes')
      .select('cliente_id')
      .eq('forma_pagamento', 'boleto'),
  ])

  const idsClientes = [...new Set([
    ...(daGrade ?? []).map(g => g.cliente_id as string | null),
    ...(cobrancas ?? []).map(c => c.cliente_id as string | null),
  ].filter((id): id is string => !!id))]

  const { data: clientes } = idsClientes.length === 0
    ? { data: [] as ClienteOpcao[] }
    : await supabase
        .from('clientes')
        .select('id, nome, cpf_cnpj, email, tipo_pessoa, cep, endereco, numero, complemento, bairro, cidade, uf')
        .in('id', idsClientes)
        .eq('ativo', true)
        .order('nome')

  // Processos só dos clientes da lista (o total de processos ativos passa de 1.000).
  const { data: processos } = idsClientes.length === 0
    ? { data: [] as ProcessoOpcao[] }
    : await supabase
        .from('processos')
        .select('id, numero_processo, titulo, cliente_id')
        .in('cliente_id', idsClientes)
        .in('status', ['ativo', 'suspenso'])
        .order('titulo')
        .limit(1000)

  return (
    <CobrancasPage
      initialCobrancas={(cobrancas ?? []) as Cobranca[]}
      clientes={(clientes ?? []) as ClienteOpcao[]}
      processos={(processos ?? []) as ProcessoOpcao[]}
      role={profile.role}
    />
  )
}
