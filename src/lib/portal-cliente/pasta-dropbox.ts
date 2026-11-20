// Pasta do Dropbox do cliente dentro do portal (etapa 1: só um LINK compartilhado, sem API do Dropbox).
// O link fica em portal_acessos.pasta_dropbox_url e só aparece para o cliente logado dono dele.
// Segurança do link em si: quem cria é o escritório, no Dropbox (recomendado: "só convidados"). Aqui só aceitamos
// endereços https do próprio Dropbox, para que o campo nunca vire um redirecionamento para outro site.

import type { Db } from './db'

export const MAX_LINK_DROPBOX = 600

export type ResultadoLink = { ok: true; url: string | null } | { ok: false; erro: string }

/** Valida o link colado na ficha. Vazio → limpa (null). Só https://(www.)dropbox.com/… */
export function validarLinkDropbox(bruto: unknown): ResultadoLink {
  if (bruto === null || bruto === undefined) return { ok: true, url: null }
  if (typeof bruto !== 'string') return { ok: false, erro: 'Link inválido.' }
  const texto = bruto.trim()
  if (texto === '') return { ok: true, url: null }
  if (texto.length > MAX_LINK_DROPBOX) return { ok: false, erro: 'Link muito longo.' }
  let u: URL
  try {
    u = new URL(texto)
  } catch {
    return { ok: false, erro: 'Cole o endereço completo da pasta (começa com https://www.dropbox.com/…).' }
  }
  const host = u.hostname.toLowerCase()
  const doDropbox = host === 'dropbox.com' || host.endsWith('.dropbox.com')
  if (u.protocol !== 'https:' || !doDropbox || u.username || u.password) {
    return { ok: false, erro: 'O link precisa ser do Dropbox (https://www.dropbox.com/…).' }
  }
  return { ok: true, url: u.toString() }
}

/**
 * Link da pasta do cliente para o portal. `clienteId` vem SEMPRE da sessão. Qualquer falha (coluna ainda não criada,
 * tabela ausente, link antigo inválido) → null: o cartão simplesmente não aparece, a página nunca quebra.
 */
export async function pastaDropboxDoCliente(db: Db, clienteId: string): Promise<string | null> {
  const { data, error } = await db.from('portal_acessos').select('pasta_dropbox_url').eq('cliente_id', clienteId).maybeSingle()
  if (error || !data) return null
  const v = validarLinkDropbox(data.pasta_dropbox_url)
  return v.ok ? v.url : null
}
