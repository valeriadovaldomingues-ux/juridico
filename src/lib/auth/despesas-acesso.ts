// ─────────────────────────────────────────────────────────────────────────────
// Acesso restrito à tela /financeiro/despesas.
//
// O Financeiro como um todo é liberado só pra 'socio' (ver src/lib/permissions.ts
// e src/app/(dashboard)/financeiro/page.tsx). Esta é uma exceção pontual: o Célio
// (administrativo) precisa gerenciar despesas sem enxergar o resto do financeiro
// (receitas, honorários, etc). Como o papel 'administrativo' é compartilhado com
// outras pessoas (ex: Luana) que NÃO devem ter esse acesso, a liberação é por
// usuário, não por papel.
//
// Se amanhã mais gente precisar do mesmo acesso, vale a pena promover isso pra
// uma permissão de verdade em permissions.ts — por ora, uma lista pontual resolve.
// ─────────────────────────────────────────────────────────────────────────────

export const DESPESAS_EXTRA_USER_IDS: readonly string[] = [
  '3baf1f52-4950-4a1e-937a-126ce0fa1e34', // Célio Costa
]

/** Pode ver/gerenciar a tela dedicada de Despesas. */
export function podeAcessarDespesas(userId: string, role: string): boolean {
  return role === 'socio' || DESPESAS_EXTRA_USER_IDS.includes(userId)
}

/**
 * Pode criar/editar lançamentos de despesa via API — sócio/gerente sempre podem
 * (mesma regra do financeiro geral); o usuário extra só pode mexer em lançamentos
 * do tipo 'despesa'.
 */
export function podeGerenciarLancamentoDespesa(userId: string, role: string, tipoLancamento: string): boolean {
  if (role === 'socio' || role === 'gerente') return true
  return DESPESAS_EXTRA_USER_IDS.includes(userId) && tipoLancamento === 'despesa'
}
