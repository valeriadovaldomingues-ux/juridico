// ─────────────────────────────────────────────────────────────────────────────
// Acesso à aba FINANCEIRO por usuário (não por papel).
//
// Pedido da Valéria em 13/10/2026: o Célio (administrativo) passa a ter a aba Financeiro —
// lançamentos de receita e despesa e grade de pagamento (ver e lançar/editar).
// Continua SÓ com o sócio: apagar lançamentos, Salários/folha de pagamento e Cobranças (Inter).
// Espelha as políticas do banco (função SQL public.financeiro_usuario_liberado()).
// ─────────────────────────────────────────────────────────────────────────────

export const FINANCEIRO_EXTRA_USER_IDS: readonly string[] = [
  '3baf1f52-4950-4a1e-937a-126ce0fa1e34', // Célio Costa
]

/** Vê a aba Financeiro (sócio, ou quem foi liberado individualmente). */
export function podeAcessarFinanceiro(userId: string | null | undefined, role: string): boolean {
  return role === 'socio' || (!!userId && FINANCEIRO_EXTRA_USER_IDS.includes(userId))
}

/** Libera por pessoa lançar/editar (não apagar) em todo o Financeiro. */
export function financeiroLiberadoPorUsuario(userId: string | null | undefined): boolean {
  return !!userId && FINANCEIRO_EXTRA_USER_IDS.includes(userId)
}
