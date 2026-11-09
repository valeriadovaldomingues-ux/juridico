// Quem pode ligar o próprio Claude ao PEDV: todos os ADVOGADOS, GERENTES e ESTAGIÁRIOS ativos (advogados e gerentes liberados pela
// Valéria em 05/11/2026, depois de começar só com a Débora e a Tuane; estagiários em 09/11/2026) e, individualmente, quem estiver
// nas listas abaixo (ex.: um sócio).
export const MCP_PAPEIS_LIBERADOS = ['advogado', 'gerente', 'estagiario'] as const

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

export const MCP_PAPEIS_PERMITIDOS = ['advogado', 'gerente', 'estagiario', 'socio'] as const

const papelLiberado = (role: string | null | undefined) => !!role && (MCP_PAPEIS_LIBERADOS as readonly string[]).includes(role)

/** Pode usar o conector? `role` é o papel da pessoa no PEDV (todos os advogados, gerentes e estagiários entram; os demais só se estiverem na lista). */
export function usuarioPodeMcp(userId: string | null | undefined, role?: string | null): boolean {
  return !!userId && (MCP_USUARIOS_PERMITIDOS.includes(userId) || papelLiberado(role))
}

/** Pode GRAVAR pelo conector? Só quem também pode usá-lo. */
export function usuarioPodeEscreverMcp(userId: string | null | undefined, role?: string | null): boolean {
  return usuarioPodeMcp(userId, role) && (MCP_USUARIOS_ESCRITA.includes(userId as string) || papelLiberado(role))
}
