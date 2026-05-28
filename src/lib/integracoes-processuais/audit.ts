import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegracaoProcessualOperacao, IntegracaoProcessualStatus } from './types'

const SENSITIVE_KEYS = [
  'token',
  'senha',
  'password',
  'certificado',
  'certificate',
  'cookie',
  'session',
  'segredo',
  'secret',
  'totp',
  'mfa',
  'qr',
]

export function contemCampoSensivel(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false
  return Object.keys(input as Record<string, unknown>).some(key => {
    const lower = key.toLowerCase()
    return SENSITIVE_KEYS.some(sensitive => lower.includes(sensitive))
  })
}

export function redigirDetalhesSensiveis(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redigirDetalhesSensiveis)
  if (!input || typeof input !== 'object') return input

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      const lower = key.toLowerCase()
      const sensitive = SENSITIVE_KEYS.some(item => lower.includes(item))
      return [key, sensitive ? '[redigido]' : redigirDetalhesSensiveis(value)]
    }),
  )
}

export async function registrarLogIntegracaoProcessual(
  supabase: SupabaseClient,
  input: {
    provider: string
    tipoOperacao: IntegracaoProcessualOperacao
    status: IntegracaoProcessualStatus
    referencia?: string | null
    mensagem?: string | null
    detalhes?: unknown
    iniciadoEm: string
    finalizadoEm?: string | null
    criadoPor: string
  },
) {
  const detalhes = redigirDetalhesSensiveis(input.detalhes ?? {})
  await supabase.from('integracoes_processuais_sync_logs').insert({
    provider: input.provider,
    tipo_operacao: input.tipoOperacao,
    status: input.status,
    referencia: input.referencia ?? null,
    mensagem: input.mensagem?.slice(0, 500) ?? null,
    detalhes,
    iniciado_em: input.iniciadoEm,
    finalizado_em: input.finalizadoEm ?? new Date().toISOString(),
    criado_por: input.criadoPor,
  })
}
