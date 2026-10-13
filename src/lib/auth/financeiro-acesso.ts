// ─────────────────────────────────────────────────────────────────────────────
// Acesso à aba FINANCEIRO por usuário (não por papel).
//
// Pedido da Valéria em 13/10/2026: o Célio (administrativo) tem a aba Financeiro SÓ com as partes de
// DESPESAS (Despesas, Pedidos a pagar, A Pagar) e SALÁRIOS (folha de pagamento). Sem receitas: Receita Partido (grade),
// Receitas Extras, A Receber, Lançamentos e Relatórios. Continua SÓ com o sócio: apagar lançamentos e Cobranças (Inter).
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

/** Abas do Financeiro que as pessoas liberadas individualmente enxergam (sócio vê todas). */
export const ABAS_FINANCEIRO_LIBERADO = ['despesas', 'pedidos', 'pagar', 'salarios'] as const

/** Folha de pagamento (Salários): sócio e quem foi liberado individualmente. */
export function podeAcessarSalarios(userId: string | null | undefined, role: string): boolean {
  return role === 'socio' || financeiroLiberadoPorUsuario(userId)
}
