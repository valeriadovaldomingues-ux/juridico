// Regra ÚNICA de visibilidade do Portal do Cliente.
//
// "Liberação padrão": todo processo do cliente aparece, EXCETO:
//   • segredo de justiça (segredo_justica = true) — nunca aparece;
//   • os marcados pelo escritório com "Ocultar do portal do cliente" (ocultar_portal = true).
//
// Toda consulta do portal passa por aqui: filtro no SQL (filtrarVisiveisNoPortal) + conferência em memória
// (processoVisivelNoPortal), e o resultado é montado campo a campo (nunca com spread da linha do banco).

export interface FlagsVisibilidade {
  segredo_justica?: boolean | null
  ocultar_portal?: boolean | null
}

/**
 * Fail-closed: só é visível se o banco disse expressamente `ocultar_portal = false` e NÃO é segredo de justiça.
 * (segredo_justica nulo = "não informado" = não é segredo.)
 */
export function processoVisivelNoPortal(p: FlagsVisibilidade | null | undefined): boolean {
  if (!p) return false
  if (p.segredo_justica === true) return false
  return p.ocultar_portal === false
}

interface QueryFiltravel {
  eq(coluna: string, valor: unknown): unknown
  not(coluna: string, operador: string, valor: unknown): unknown
}

/** Mesmo critério de processoVisivelNoPortal, aplicado na consulta SQL. */
export function filtrarVisiveisNoPortal<Q>(consulta: Q): Q {
  const q = consulta as unknown as QueryFiltravel
  const comOcultar = q.eq('ocultar_portal', false) as QueryFiltravel
  return comOcultar.not('segredo_justica', 'is', true) as unknown as Q
}

// ── Andamentos: o que é "client-safe" ────────────────────────────────────────
// Entram só andamentos de movimentação processual, de origem humana/tribunal/publicação. Ficam FORA:
//   tipo contato_cliente (registro interno de contato), observacao (nota interna), prazo (prazos internos),
//   documento (documentos não fazem parte da v1), outro (genérico demais: na dúvida, omite);
//   origem sistema e aurora (texto gerado por automação/IA).
// Nunca saem: responsavel_id, criado_por, updated_at, nomes de quem lançou.
export const ANDAMENTO_TIPOS_PORTAL = ['peticao', 'decisao', 'despacho', 'audiencia', 'juntada', 'publicacao'] as const
export const ANDAMENTO_ORIGENS_PORTAL = ['manual', 'tribunal', 'publicacao'] as const

export function andamentoVisivelNoPortal(a: { tipo?: string | null; origem?: string | null }): boolean {
  return (ANDAMENTO_TIPOS_PORTAL as readonly string[]).includes(a.tipo ?? '') &&
    (ANDAMENTO_ORIGENS_PORTAL as readonly string[]).includes(a.origem ?? '')
}

/** Partes que o cliente vê: autor, réu e terceiro. O tipo "outro" (parte interessada/vínculo interno) é omitido. */
export const PARTES_TIPOS_PORTAL = ['autor', 'reu', 'terceiro'] as const

/**
 * Texto de andamento que o cliente lê. Mantém os parágrafos e tira as marcas de uso interno que
 * entram na descrição ("registrado via Claude por…", "(Fonte: …)", "Tempo: N min.", "Agenda pedvprazos…").
 */
export function descricaoParaCliente(bruto: string | null | undefined, max = 4000): string | null {
  const t = (bruto ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[registrado via [^\]]*\]/gi, ' ')
    .replace(/\(\s*Fonte:[^)]*\)/gi, ' ')
    .replace(/\bTempo:\s*\d+\s*min\.?/gi, ' ')
    .replace(/\bAgenda\s+pedvprazos\b[^.\n]*(?:\.|$)/gi, ' ')
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([.;,])/g, '$1')
    .trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
