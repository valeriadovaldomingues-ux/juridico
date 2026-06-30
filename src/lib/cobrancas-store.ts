import type { SupabaseClient } from '@supabase/supabase-js'
import { COBRANCAS_SELECT } from './cobrancas'
import type { Cobranca, CobrancaDuplicateKey, CobrancaInsertRow, CobrancaUpdateRow } from '../types/cobrancas'

export interface CobrancasStore {
  findProcessoById(id: string): Promise<{ id: string; cliente_id: string | null } | null>
  findCobrancaById(id: string): Promise<Cobranca | null>
  findCobrancaByInterId(interCobrancaId: string): Promise<Cobranca | null>
  findDuplicateCharge(key: CobrancaDuplicateKey): Promise<Partial<Cobranca> | null>
  createCharge(input: CobrancaInsertRow): Promise<Cobranca>
  createCharges(inputs: CobrancaInsertRow[]): Promise<Cobranca[]>
  updateCharge(id: string, patch: CobrancaUpdateRow): Promise<Cobranca | null>
  insertEvent(row: Record<string, unknown>): Promise<void>
  insertLog(row: Record<string, unknown>): Promise<void>
  insertWebhookEvent(row: Record<string, unknown>): Promise<{ id: string; duplicate?: boolean }>
  updateWebhookEvent(id: string, patch: Record<string, unknown>): Promise<void>
}

export function createSupabaseCobrancasStore(supabase: SupabaseClient): CobrancasStore {
  return {
    async findProcessoById(id) {
      const { data } = await supabase
        .from('processos')
        .select('id, cliente_id')
        .eq('id', id)
        .maybeSingle()
      return data ?? null
    },

    async findCobrancaById(id) {
      const { data } = await supabase
        .from('cobrancas')
        .select(COBRANCAS_SELECT)
        .eq('id', id)
        .maybeSingle()
      return data ?? null
    },

    async findCobrancaByInterId(interCobrancaId) {
      const { data } = await supabase
        .from('cobrancas')
        .select(COBRANCAS_SELECT)
        .eq('inter_cobranca_id', interCobrancaId)
        .maybeSingle()
      return data ?? null
    },

    async findDuplicateCharge(key) {
      let query = supabase
        .from('cobrancas')
        .select('id, cliente_id, processo_id, valor, data_vencimento, parcela_numero, parcela_total, status')
        .eq('cliente_id', key.cliente_id)
        .eq('data_vencimento', key.data_vencimento)
        .eq('parcela_numero', key.parcela_numero)
        .eq('parcela_total', key.parcela_total)
        .eq('valor', key.valor)
        .neq('status', 'cancelada')

      if (key.processo_id) {
        query = query.eq('processo_id', key.processo_id)
      } else {
        query = query.is('processo_id', null)
      }

      const { data } = await query.maybeSingle()
      return data ?? null
    },

    async createCharge(input) {
      const { data, error } = await supabase
        .from('cobrancas')
        .insert(input)
        .select(COBRANCAS_SELECT)
        .single()
      if (error) throw new Error(error.message)
      return data
    },

    async createCharges(inputs) {
      const { data, error } = await supabase
        .from('cobrancas')
        .insert(inputs)
        .select(COBRANCAS_SELECT)
      if (error) throw new Error(error.message)
      return (data ?? []) as Cobranca[]
    },

    async updateCharge(id, patch) {
      const { data, error } = await supabase
        .from('cobrancas')
        .update(patch)
        .eq('id', id)
        .select(COBRANCAS_SELECT)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ?? null
    },

    async insertEvent(row) {
      const { error } = await supabase.from('cobranca_eventos').insert(row)
      if (error) throw new Error(error.message)
    },

    async insertLog(row) {
      const { error } = await supabase.from('cobranca_logs').insert(row)
      if (error) throw new Error(error.message)
    },

    async insertWebhookEvent(row) {
      const { data, error } = await supabase
        .from('cobranca_webhook_events')
        .insert(row)
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') return { id: '', duplicate: true }
        throw new Error(error.message)
      }

      return { id: data.id }
    },

    async updateWebhookEvent(id, patch) {
      const { error } = await supabase
        .from('cobranca_webhook_events')
        .update(patch)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
