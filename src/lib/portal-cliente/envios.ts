// Documentos que o CLIENTE envia ao escritório pelo portal (vão direto para a equipe, sem fila de revisão).
// O arquivo vai do navegador para o Storage por URL assinada de uso único (o corpo de uma função da Vercel só aceita
// ~4,5 MB, e o limite aqui é 25 MB); o servidor valida nome/tamanho/tipo ANTES de assinar e CONFIRMA depois.
// Sempre filtra por clienteId da sessão. O caminho no Storage nunca vai para o navegador do cliente depois do envio.

import { randomUUID } from 'node:crypto'
import type { Db } from './db'
import { checar } from './db'
import { processoVisivelNoPortal } from './visibilidade'
import { MAX_DESCRICAO, TAMANHO_MAXIMO_BYTES, TIPOS_ACEITOS, extensaoDe } from './envios-constantes'

export const BUCKET_ENVIOS = 'portal-envios'
export { TAMANHO_MAXIMO_BYTES, MAX_DESCRICAO, TIPOS_ACEITOS, EXTENSOES_ACEITAS, extensaoDe } from './envios-constantes'
export interface EnvioDoCliente {
  id: string
  nome: string
  tamanho: number | null
  enviadoEm: string
  processoNumero: string | null
}

/** Remove caminho e caracteres estranhos; mantém a extensão. "Contrato (1).PDF" → "Contrato_1_.pdf". */
export function nomeSeguro(bruto: string): string {
  const base = bruto.split(/[\\/]/).pop() ?? ''
  const limpo = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '')
  const ponto = limpo.lastIndexOf('.')
  const ext = ponto > 0 ? limpo.slice(ponto + 1).toLowerCase() : ''
  const nome = (ponto > 0 ? limpo.slice(0, ponto) : limpo).replace(/_+/g, '_').slice(0, 80) || 'arquivo'
  return ext ? `${nome}.${ext}` : nome
}

export type ResultadoSolicitacao =
  | { ok: true; envio: { id: string; caminho: string; contentType: string } }
  | { ok: false; erro: string; status: number }

export async function solicitarEnvio(
  db: Db,
  clienteId: string,
  entrada: { nome: unknown; tamanho: unknown; processoId?: unknown; descricao?: unknown },
): Promise<ResultadoSolicitacao> {
  if (typeof entrada.nome !== 'string' || !entrada.nome.trim() || entrada.nome.length > 255) return { ok: false, erro: 'Arquivo inválido.', status: 400 }
  const ext = extensaoDe(entrada.nome)
  const contentType = TIPOS_ACEITOS[ext]
  if (!contentType) {
    return { ok: false, erro: `Este tipo de arquivo não é aceito. Envie PDF, foto (JPG, PNG, HEIC), Word, Excel, TXT ou CSV.`, status: 415 }
  }
  const tamanho = entrada.tamanho
  if (typeof tamanho !== 'number' || !Number.isFinite(tamanho) || tamanho <= 0) return { ok: false, erro: 'Arquivo vazio.', status: 400 }
  if (tamanho > TAMANHO_MAXIMO_BYTES) return { ok: false, erro: 'O arquivo passa de 25 MB. Envie um menor ou divida em partes.', status: 413 }

  let processoId: string | null = null
  if (entrada.processoId !== undefined && entrada.processoId !== null && entrada.processoId !== '') {
    if (typeof entrada.processoId !== 'string') return { ok: false, erro: 'Processo inválido.', status: 400 }
    const { data, error } = await db
      .from('processos')
      .select('id, cliente_id, ocultar_portal, segredo_justica')
      .eq('id', entrada.processoId)
      .eq('cliente_id', clienteId)
      .maybeSingle()
    checar(error, 'processos')
    if (!data || !processoVisivelNoPortal(data as never)) return { ok: false, erro: 'Processo não encontrado.', status: 404 }
    processoId = data.id as string
  }

  let descricao: string | null = null
  if (typeof entrada.descricao === 'string' && entrada.descricao.trim()) descricao = entrada.descricao.trim().slice(0, MAX_DESCRICAO)

  const nome = nomeSeguro(entrada.nome)
  const caminho = `${clienteId}/${randomUUID()}-${nome}`
  const { data: criado, error } = await db
    .from('portal_envios')
    .insert({ cliente_id: clienteId, processo_id: processoId, nome_original: entrada.nome.trim().slice(0, 255), storage_path: caminho, tipo_mime: contentType, descricao, status: 'pendente' })
    .select('id')
  checar(error, 'envios')
  const id = (criado?.[0]?.id as string | undefined) ?? null
  if (!id) throw new Error('envios: sem id')
  return { ok: true, envio: { id, caminho, contentType } }
}

export type ResultadoConfirmacao = { ok: true; tamanho: number } | { ok: false; erro: string; status: number }

/** Confere no Storage que o arquivo chegou (e dentro do limite) e só então publica o envio para a equipe. */
export async function confirmarEnvio(db: Db, clienteId: string, envioId: string, agora: Date = new Date()): Promise<ResultadoConfirmacao> {
  const { data: envio, error } = await db
    .from('portal_envios')
    .select('id, storage_path, status')
    .eq('id', envioId)
    .eq('cliente_id', clienteId)
    .maybeSingle()
  checar(error, 'envios')
  if (!envio) return { ok: false, erro: 'Envio não encontrado.', status: 404 }
  if (envio.status === 'enviado') return { ok: false, erro: 'Este envio já foi concluído.', status: 409 }

  const caminho = envio.storage_path as string
  const pasta = caminho.slice(0, caminho.lastIndexOf('/'))
  const arquivo = caminho.slice(caminho.lastIndexOf('/') + 1)
  const { data: itens, error: eList } = await db.storage.from(BUCKET_ENVIOS).list(pasta, { search: arquivo, limit: 5 })
  if (eList) throw new Error('envios: storage')
  const achado = (itens ?? []).find(i => i.name === arquivo)
  const tamanho = Number((achado?.metadata as { size?: number } | null | undefined)?.size ?? 0)
  if (!achado || !(tamanho > 0)) return { ok: false, erro: 'O arquivo não chegou. Tente enviar de novo.', status: 409 }
  if (tamanho > TAMANHO_MAXIMO_BYTES) {
    await db.storage.from(BUCKET_ENVIOS).remove([caminho])
    await db.from('portal_envios').delete().eq('id', envioId).eq('cliente_id', clienteId)
    return { ok: false, erro: 'O arquivo passa de 25 MB.', status: 413 }
  }
  const { error: eUp } = await db
    .from('portal_envios')
    .update({ status: 'enviado', tamanho_bytes: tamanho, enviado_em: agora.toISOString() })
    .eq('id', envioId)
    .eq('cliente_id', clienteId)
    .eq('status', 'pendente')
  checar(eUp, 'envios')
  return { ok: true, tamanho }
}

const numeroDosProcessos = async (db: Db, ids: string[], clienteId?: string): Promise<Map<string, string>> => {
  const mapa = new Map<string, string>()
  if (!ids.length) return mapa
  let q = db.from('processos').select('id, numero_processo').in('id', ids)
  if (clienteId) q = q.eq('cliente_id', clienteId)
  const { data, error } = await q
  checar(error, 'processos')
  for (const p of data ?? []) mapa.set(p.id as string, (p.numero_processo as string | null) ?? '')
  return mapa
}

/** O que o PRÓPRIO cliente vê: só nome, data, tamanho e processo. Nunca o caminho do arquivo. */
export async function listarEnviosDoCliente(db: Db, clienteId: string): Promise<EnvioDoCliente[]> {
  const { data, error } = await db
    .from('portal_envios')
    .select('id, nome_original, tamanho_bytes, enviado_em, processo_id')
    .eq('cliente_id', clienteId)
    .eq('status', 'enviado')
    .order('enviado_em', { ascending: false })
    .limit(200)
  checar(error, 'envios')
  const linhas = data ?? []
  const nums = await numeroDosProcessos(db, [...new Set(linhas.map(l => l.processo_id as string | null).filter((x): x is string => !!x))], clienteId)
  return linhas.map(l => ({
    id: l.id as string,
    nome: l.nome_original as string,
    tamanho: (l.tamanho_bytes as number | null) ?? null,
    enviadoEm: l.enviado_em as string,
    processoNumero: l.processo_id ? nums.get(l.processo_id as string) || null : null,
  }))
}

export interface EnvioParaEquipe extends EnvioDoCliente {
  descricao: string | null
  visto: boolean
}

/** Lista da equipe (ficha do cliente): inclui a descrição e se alguém já abriu. Só chamar depois de checar o papel. */
export async function listarEnviosParaEquipe(db: Db, clienteId: string): Promise<EnvioParaEquipe[]> {
  const { data, error } = await db
    .from('portal_envios')
    .select('id, nome_original, tamanho_bytes, enviado_em, processo_id, descricao, visto_em')
    .eq('cliente_id', clienteId)
    .eq('status', 'enviado')
    .order('enviado_em', { ascending: false })
    .limit(200)
  checar(error, 'envios')
  const linhas = data ?? []
  const nums = await numeroDosProcessos(db, [...new Set(linhas.map(l => l.processo_id as string | null).filter((x): x is string => !!x))])
  return linhas.map(l => ({
    id: l.id as string,
    nome: l.nome_original as string,
    tamanho: (l.tamanho_bytes as number | null) ?? null,
    enviadoEm: l.enviado_em as string,
    processoNumero: l.processo_id ? nums.get(l.processo_id as string) || null : null,
    descricao: (l.descricao as string | null) ?? null,
    visto: !!l.visto_em,
  }))
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
