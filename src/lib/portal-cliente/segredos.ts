// Hashes e comparações do portal. Nada aqui grava ou loga dado pessoal.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** O portal ainda não pode operar (tabelas ausentes ou segredo não configurado). Vira 503 genérico, nunca 500. */
export class PortalIndisponivel extends Error {
  constructor(motivo = 'portal indisponível') {
    super(motivo)
    this.name = 'PortalIndisponivel'
  }
}

function segredo(): string {
  const s = process.env.PORTAL_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new PortalIndisponivel('segredo do portal não configurado')
  return s
}

/** HMAC-SHA256 em hex, com contexto (separa o uso: código, chave de tentativa…). */
export function hmac(contexto: string, valor: string): string {
  return createHmac('sha256', segredo()).update(`${contexto}\u0000${valor}`).digest('hex')
}

/** sha256 em hex — para o token de sessão (já é aleatório de 256 bits). */
export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Comparação em tempo constante de duas strings (hex). */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** IP resumido para guardar (IPv4 termina em .0; IPv6 mantém só os 4 primeiros grupos). */
export function resumirIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip)
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`
  if (ip.includes(':')) return `${ip.split(':').slice(0, 4).join(':')}::`
  return null
}

export function resumirUserAgent(ua: string | null | undefined): string | null {
  return ua ? ua.slice(0, 120) : null
}
