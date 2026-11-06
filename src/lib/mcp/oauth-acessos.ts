// Painel de acessos do conector: quem ligou o Claude ao PEDV pelo login (claude.ai, celular, nuvem) e a revogação.
// Cada pessoa vê e revoga os próprios acessos; o sócio vê e revoga os de todos. Revogar vale na próxima chamada do Claude.

type Db = { from: (t: string) => any }  // eslint-disable-line @typescript-eslint/no-explicit-any

const TABELA = 'mcp_oauth_concessoes'

export interface Acesso {
  id: string
  usuario_id: string
  usuario_nome: string | null
  cliente: string
  conectado_em: string
  ultimo_uso_em: string | null
  renovacao_expira_em: string | null
}

/** Acessos ativos (autorizados e não revogados). Com `userId`, só os dessa pessoa. */
export async function listarAcessos(db: Db, opts: { userId?: string } = {}): Promise<Acesso[]> {
  let q = db.from(TABELA)
    .select('id, user_id, client_nome, criado_em, ultimo_uso_em, refresh_expira_em')
    .not('refresh_hash', 'is', null).is('revogado_em', null)
    .order('criado_em', { ascending: false }).limit(200)
  if (opts.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const linhas = (data ?? []) as Array<{ id: string; user_id: string; client_nome: string | null; criado_em: string; ultimo_uso_em: string | null; refresh_expira_em: string | null }>
  const ids = [...new Set(linhas.map(l => l.user_id))]
  const nomes = new Map<string, string>()
  if (ids.length) {
    const { data: perfis } = await db.from('profiles').select('id, nome').in('id', ids)
    for (const p of (perfis ?? []) as Array<{ id: string; nome: string | null }>) if (p.nome) nomes.set(p.id, p.nome)
  }
  return linhas.map(l => ({
    id: l.id, usuario_id: l.user_id, usuario_nome: nomes.get(l.user_id) ?? null, cliente: l.client_nome || 'Claude',
    conectado_em: l.criado_em, ultimo_uso_em: l.ultimo_uso_em, renovacao_expira_em: l.refresh_expira_em,
  }))
}

/** Revoga um acesso. Sem `userId` (sócio) revoga qualquer um; com `userId` só se for dessa pessoa. Devolve se revogou. */
export async function revogarAcesso(db: Db, id: string, opts: { userId?: string; agora?: number } = {}): Promise<boolean> {
  let q = db.from(TABELA).update({ revogado_em: new Date(opts.agora ?? Date.now()).toISOString() }).eq('id', id).is('revogado_em', null)
  if (opts.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q.select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}
