// Quem pode ligar o próprio Claude ao PEDV. Começou com a Débora (pedido da Valéria em 22/10/2026); Tuane liberada em 05/11/2026.
// Para liberar mais alguém, acrescente o id do usuário aqui (e só advogados/sócios entram).
export const MCP_USUARIOS_PERMITIDOS: readonly string[] = [
  'dd154172-ebb2-498a-af49-c56ada33792a', // Débora Brito
  '80be07bd-e23a-4ece-aa02-a7cde54bf6c7', // Tuane Miranda
]

// Quem, dentre os liberados, também pode GRAVAR pelo conector (criar andamento, compromisso, cliente...).
export const MCP_USUARIOS_ESCRITA: readonly string[] = [
  'dd154172-ebb2-498a-af49-c56ada33792a', // Débora Brito
  '80be07bd-e23a-4ece-aa02-a7cde54bf6c7', // Tuane Miranda
]

export function usuarioPodeEscreverMcp(userId: string | null | undefined): boolean {
  return !!userId && MCP_USUARIOS_ESCRITA.includes(userId) && MCP_USUARIOS_PERMITIDOS.includes(userId)
}

export const MCP_PAPEIS_PERMITIDOS = ['advogado', 'gerente', 'socio'] as const

export function usuarioPodeMcp(userId: string | null | undefined): boolean {
  return !!userId && MCP_USUARIOS_PERMITIDOS.includes(userId)
}
