// Quem pode ligar o próprio Claude ao PEDV. Começa só com a Débora (pedido da Valéria em 22/10/2026).
// Para liberar mais alguém, acrescente o id do usuário aqui (e só advogados/sócios entram).
export const MCP_USUARIOS_PERMITIDOS: readonly string[] = [
  'dd154172-ebb2-498a-af49-c56ada33792a', // Débora Brito
]

export const MCP_PAPEIS_PERMITIDOS = ['advogado', 'gerente', 'socio'] as const

export function usuarioPodeMcp(userId: string | null | undefined): boolean {
  return !!userId && MCP_USUARIOS_PERMITIDOS.includes(userId)
}
