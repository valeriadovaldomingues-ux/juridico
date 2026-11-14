// Utilitários compartilhados pelas rotas /api/monitoramento/clientes/*.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'
import { erroDeTabelaAusente } from './executar'
import { soDigitos } from './documento'

/** Leitura: quem pode ver a lista e os alertas. */
export const PAPEIS_LEITURA: UserRole[] = ['socio', 'gerente', 'advogado', 'administrativo']
/** Escrita: cadastrar/editar documentos e tratar alertas. */
export const PAPEIS_ESCRITA: UserRole[] = ['socio', 'gerente']

export const STATUS_ALERTA = ['novo', 'visto', 'descartado', 'processo_cadastrado'] as const
export type StatusAlerta = (typeof STATUS_ALERTA)[number]

/** Converte erro do Supabase em resposta HTTP (503 amigável quando a migração ainda não foi aplicada). */
export function respostaErroBanco(erro: { code?: string; message?: string }, contexto: string) {
  if (erroDeTabelaAusente(erro)) {
    return NextResponse.json(
      { error: 'O monitoramento de clientes ainda não foi ativado no banco (migração pendente).', migracaoPendente: true },
      { status: 503 },
    )
  }
  console.error(`[monitoramento-clientes] ${contexto}:`, erro.message)
  return NextResponse.json({ error: `${contexto}.` }, { status: 500 })
}

/**
 * Mapa documento (só dígitos) → id do cliente cadastrado com esse CPF/CNPJ.
 * Comparação só por dígitos (clientes.cpf_cnpj pode estar com máscara). Se mais de um
 * cliente tiver o mesmo documento, não vincula (ambíguo).
 */
export async function mapaClientesPorDocumento(supabase: SupabaseClient): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>()
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, cpf_cnpj')
      .not('cpf_cnpj', 'is', null)
      .range(de, de + 999)
    if (error) throw new Error(error.message)
    for (const c of (data ?? []) as Array<{ id: string; cpf_cnpj: string | null }>) {
      const d = soDigitos(c.cpf_cnpj)
      if (!d) continue
      mapa.set(d, mapa.has(d) && mapa.get(d) !== c.id ? null : c.id)
    }
    if (!data || data.length < 1000) break
  }
  return mapa
}
