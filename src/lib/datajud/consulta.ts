// Consulta à API pública do DataJud (CNJ): dados do processo e movimentações, para conferir o que o PEDV tem.
// Limites da fonte: não traz partes nem processos sigilosos, e atrasa em relação ao tribunal. A consulta é LENTA (30–40 s).
// A chave é a chave pública que o próprio CNJ divulga (muda de vez em quando); pode ser trocada pela variável DATAJUD_API_KEY.

import { aliasDoDataJud, soDigitos } from './tribunais'

const CHAVE_PUBLICA_CNJ = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
const BASE = 'https://api-publica.datajud.cnj.jus.br'

export interface MovimentoDataJud { data: string | null; nome: string; complemento: string | null }
export interface ProcessoDataJud {
  tribunal: string | null
  grau: string | null
  classe: string | null
  orgaoJulgador: string | null
  ajuizamento: string | null // AAAA-MM-DD
  assuntos: string[]
  sigilo: number | null
  atualizadoEm: string | null // AAAA-MM-DD
  movimentos: MovimentoDataJud[] // do mais recente para o mais antigo
}
export type ResultadoDataJud = { ok: true; processos: ProcessoDataJud[] } | { ok: false; erro: string }

/** "20261021130330" ou ISO → AAAA-MM-DD. */
export function dataDoDataJud(v: unknown): string | null {
  const s = String(v ?? '')
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

type Fonte = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function interpretarHit(src: Fonte, limiteMovimentos = 25): ProcessoDataJud {
  const movimentos: MovimentoDataJud[] = (Array.isArray(src.movimentos) ? src.movimentos : []).map((m: Fonte) => {
    const comp = (Array.isArray(m.complementosTabelados) ? m.complementosTabelados : []).map((c: Fonte) => c.nome ?? c.descricao).filter(Boolean).join('; ')
    return { data: dataDoDataJud(m.dataHora), nome: String(m.nome ?? ''), complemento: comp || null }
  })
  movimentos.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
  return {
    tribunal: src.tribunal ?? null,
    grau: src.grau ?? null,
    classe: src.classe?.nome ?? null,
    orgaoJulgador: src.orgaoJulgador?.nome ?? null,
    ajuizamento: dataDoDataJud(src.dataAjuizamento),
    assuntos: (Array.isArray(src.assuntos) ? src.assuntos : []).map((a: Fonte) => a.nome).filter(Boolean),
    sigilo: typeof src.nivelSigilo === 'number' ? src.nivelSigilo : null,
    atualizadoEm: dataDoDataJud(src.dataHoraUltimaAtualizacao),
    movimentos: movimentos.slice(0, limiteMovimentos),
  }
}

export async function consultarDataJud(numero: string, opcoes: { apiKey?: string; fetchFn?: typeof fetch; timeoutMs?: number } = {}): Promise<ResultadoDataJud> {
  const alias = aliasDoDataJud(numero)
  if (!alias) return { ok: false, erro: 'Número fora do padrão do CNJ ou de um tribunal que o DataJud não cobre.' }
  const cnj = soDigitos(numero)
  const controle = new AbortController()
  const t = setTimeout(() => controle.abort(), opcoes.timeoutMs ?? 55_000)
  try {
    const res = await (opcoes.fetchFn ?? fetch)(`${BASE}/${alias}/_search`, {
      method: 'POST',
      headers: { Authorization: `APIKey ${opcoes.apiKey ?? process.env.DATAJUD_API_KEY ?? CHAVE_PUBLICA_CNJ}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 5, query: { match: { numeroProcesso: cnj } } }),
      signal: controle.signal,
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) return { ok: false, erro: 'O CNJ recusou a chave de acesso (a chave pública pode ter mudado).' }
    if (!res.ok) return { ok: false, erro: `O DataJud respondeu com erro ${res.status}.` }
    const json = await res.json() as { hits?: { hits?: { _source?: Fonte }[] } }
    const processos = (json.hits?.hits ?? []).map(h => interpretarHit(h._source ?? {}))
    processos.sort((a, b) => (a.grau ?? '').localeCompare(b.grau ?? ''))
    return { ok: true, processos }
  } catch (e) {
    return { ok: false, erro: (e as Error).name === 'AbortError' ? 'O DataJud demorou demais para responder. Tente de novo.' : 'Não foi possível falar com o DataJud agora.' }
  } finally {
    clearTimeout(t)
  }
}
