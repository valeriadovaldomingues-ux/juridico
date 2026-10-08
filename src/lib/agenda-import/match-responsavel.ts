// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/match-responsavel.ts
//
// O EasyJur exporta o nome completo do responsável ("VALERIA FERREIRA DO VAL
// DOMINGUES PESSOA"); no sistema o perfil usa o nome simples ("Valéria do Val").
// Um perfil casa com o nome do EasyJur quando TODAS as partes do nome simples
// aparecem no nome completo (sem acento, sem maiúsculas, ignorando de/da/do/e).
// Partes com 4+ letras também casam por prefixo ("Tainã" ↔ "TAINAN").
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])

function tokens(nome: string): string[] {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(t => t && !STOPWORDS.has(t))
}

function tokenCasa(a: string, b: string): boolean {
  if (a === b) return true
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))
}

export interface PerfilSimples {
  id: string
  nome: string
}

/** Retorna o id do perfil que corresponde ao nome do EasyJur, ou null se nenhum/ambíguo. */
export function matchPerfilPorNome(nomeEasyJur: string, perfis: PerfilSimples[]): string | null {
  const alvo = tokens(nomeEasyJur)
  if (alvo.length === 0) return null

  const candidatos = perfis
    .map(p => ({ p, partes: tokens(p.nome) }))
    .filter(({ partes }) => partes.length > 0 && partes.every(parte => alvo.some(t => tokenCasa(parte, t))))

  if (candidatos.length === 1) return candidatos[0].p.id
  if (candidatos.length > 1) {
    // Empate: vale o perfil com mais partes casadas, se for único.
    const max = Math.max(...candidatos.map(c => c.partes.length))
    const melhores = candidatos.filter(c => c.partes.length === max)
    if (melhores.length === 1) return melhores[0].p.id
  }
  return null
}
