import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import type { Cliente, Processo, ProcessoAndamento } from '@/types'
import type { RelatorioClienteDraft } from './types'

export async function registrarLogRelatorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  relatorioId: string,
  acao: 'gerado' | 'editado' | 'aprovado' | 'publicado' | 'arquivado',
  executadoPor: string,
  detalhes: Record<string, unknown>,
) {
  await supabase.from('client_report_logs').insert({
    relatorio_id: relatorioId,
    acao,
    detalhes,
    executado_por: executadoPor,
  })
}

export async function buscarProcessoCompletoParaRelatorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
) {
  const { data, error } = await supabase
    .from('processos')
    .select(`
      id,
      numero_processo,
      titulo,
      area_direito,
      status,
      fase,
      tribunal,
      comarca,
      vara,
      classe_processual,
      assunto,
      segredo_justica,
      valor_causa,
      data_distribuicao,
      cliente_id,
      cliente:clientes(id, nome, tipo_pessoa, cpf_cnpj, email, telefone, celular, endereco)
    `)
    .eq('id', processoId)
    .single()

  if (error || !data || !isUUID(String((data as { id?: string }).id ?? ''))) {
    return null
  }

  return data as unknown as Processo & { cliente: Cliente }
}

export async function buscarAndamentosParaRelatorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
  opts: {
    andamentoIds?: string[]
    periodoInicio?: string | null
    periodoFim?: string | null
  } = {},
) {
  let query = supabase
    .from('processo_andamentos')
    .select(`
      *,
      responsavel:profiles(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .eq('processo_id', processoId)
    .order('data_andamento', { ascending: false })

  if (opts.andamentoIds && opts.andamentoIds.length > 0) {
    query = query.in('id', opts.andamentoIds)
  }

  if (opts.periodoInicio) {
    query = query.gte('data_andamento', opts.periodoInicio)
  }

  if (opts.periodoFim) {
    query = query.lte('data_andamento', opts.periodoFim)
  }

  const { data, error } = await query.limit(100)
  if (error) {
    throw error
  }

  return (data ?? []) as ProcessoAndamento[]
}

export async function buscarRelatorioCompleto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  relatorioId: string,
) {
  const { data, error } = await supabase
    .from('client_reports')
    .select(`
      *,
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .eq('id', relatorioId)
    .single()

  if (error || !data) {
    return null
  }

  return data as RelatorioClienteDraft
}
