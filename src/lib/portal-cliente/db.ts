// Acesso ao banco do portal: só service_role, só no servidor. As tabelas portal_* não têm policy nenhuma.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { PortalIndisponivel } from './segredos'

export type Db = SupabaseClient

export function portalDb(): Db {
  try {
    return createServiceClient() as unknown as Db
  } catch {
    throw new PortalIndisponivel('service role não configurada')
  }
}

interface ErroPg { code?: string | null; message?: string | null }

/** Tabela/coluna do portal ainda não existe (migração não aplicada). */
export function tabelaAusente(erro: ErroPg | null | undefined): boolean {
  if (!erro) return false
  if (erro.code && ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(erro.code)) return true
  const m = (erro.message ?? '').toLowerCase()
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table')
}

/** Lança PortalIndisponivel se a migração não foi aplicada; senão, um erro comum (sem dados pessoais). */
export function checar(erro: ErroPg | null | undefined, onde: string): void {
  if (!erro) return
  if (tabelaAusente(erro)) throw new PortalIndisponivel(`${onde}: tabela ausente`)
  throw new Error(`${onde}: ${erro.code ?? 'erro'}`)
}
