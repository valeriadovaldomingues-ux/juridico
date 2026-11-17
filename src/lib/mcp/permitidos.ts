// Quem pode ligar o próprio Claude/ChatGPT ao PEDV: TODA a equipe ativa — sócios, advogados, gerentes, estagiários, administrativo e
// comercial (advogados e gerentes liberados pela Valéria em 05/11/2026, estagiários em 09/11/2026; "para todos" em 17/11/2026).
// Quem estiver inativo continua barrado. Clientes do portal nunca entram.
export const MCP_PAPEIS_LIBERADOS = ['advogado', 'gerente', 'estagiario', 'administrativo', 'comercial', 'socio'] as const

// Pessoas liberadas à parte, além dos papéis acima. Acrescente o id do usuário para liberar mais alguém (só advogado/gerente/sócio entram).
export const MCP_USUARIOS_PERMITIDOS: readonly string[] = [
  'dd154172-ebb2-498a-af49-c56ada33792a', // Débora Brito
  '80be07bd-e23a-4ece-aa02-a7cde54bf6c7', // Tuane Miranda
  'a7eccddf-443a-408d-be21-23a285093fca', // Valéria do Val (sócia; liberada em 05/11/2026)
]

// Quem, dentre os liberados, também pode GRAVAR pelo conector (criar andamento, compromisso, cliente...): os mesmos papéis liberados
// e, à parte, quem estiver aqui.
export const MCP_USUARIOS_ESCRITA: readonly string[] = [
  'dd154172-ebb2-498a-af49-c56ada33792a', // Débora Brito
  '80be07bd-e23a-4ece-aa02-a7cde54bf6c7', // Tuane Miranda
  'a7eccddf-443a-408d-be21-23a285093fca', // Valéria do Val
]

export const MCP_PAPEIS_PERMITIDOS = MCP_PAPEIS_LIBERADOS

const papelLiberado = (role: string | null | undefined) => !!role && (MCP_PAPEIS_LIBERADOS as readonly string[]).includes(role)

/** Pode usar o conector? `role` é o papel da pessoa no PEDV (todos os advogados, gerentes e estagiários entram; os demais só se estiverem na lista). */
export function usuarioPodeMcp(userId: string | null | undefined, role?: string | null): boolean {
  return !!userId && (MCP_USUARIOS_PERMITIDOS.includes(userId) || papelLiberado(role))
}

/** Pode GRAVAR pelo conector? Só quem também pode usá-lo. */
export function usuarioPodeEscreverMcp(userId: string | null | undefined, role?: string | null): boolean {
  return usuarioPodeMcp(userId, role) && (MCP_USUARIOS_ESCRITA.includes(userId as string) || papelLiberado(role))
}
