// ─────────────────────────────────────────────────────────────────────────────
// Acesso ajustado POR USUÁRIO (não por papel).
//
// Usado quando uma pessoa precisa de um acesso diferente do papel dela, sem
// mudar o papel (que é compartilhado com outras pessoas). Mesmo espírito de
// despesas-acesso.ts, mas para o menu/páginas como um todo.
//
//  - liberadoDoModoRestrito: ignora o KANBAN_ONLY_MODE (ver kanban-only-mode.ts)
//    e passa a enxergar tudo o que o papel dela permite.
//  - rotasBloqueadas: prefixos de rota que ela NÃO acessa, mesmo que o papel
//    permita (somem do menu e o proxy redireciona para /dashboard).
//
// Módulo sem dependências: é importado pelo proxy (Edge Runtime), pela
// sidebar (client) e por permissions.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface AcessoUsuario {
  liberadoDoModoRestrito: boolean
  rotasBloqueadas: readonly string[]
}

// Advogados liberados do modo restrito, a pedido da Valéria em 08/10/2026: tudo do
// papel advogado, exceto Documentos, Monitoramento, IA Jurídica e Painel TV.
// (Comercial, Financeiro, Cobranças, Relatórios, Importar, Automações,
// Integrações, Dashboard TV, Usuários e Configurações já são barrados pelo papel.)
const ADVOGADO_SEM_DOCUMENTOS_MONITORAMENTO_IA_TV: AcessoUsuario = {
  liberadoDoModoRestrito: true,
  rotasBloqueadas: ['/documentos', '/monitoramento', '/ia-juridica', '/tv'],
}

export const ACESSO_POR_USUARIO: Readonly<Record<string, AcessoUsuario>> = {
  '1a5ed586-77e0-4f6f-a652-444056d86b1b': ADVOGADO_SEM_DOCUMENTOS_MONITORAMENTO_IA_TV, // Marcelo Mariano
  'dd154172-ebb2-498a-af49-c56ada33792a': ADVOGADO_SEM_DOCUMENTOS_MONITORAMENTO_IA_TV, // Débora Brito
}

export function acessoDoUsuario(userId?: string | null): AcessoUsuario | null {
  return (userId && ACESSO_POR_USUARIO[userId]) || null
}

export function usuarioLiberadoDoModoRestrito(userId?: string | null): boolean {
  return acessoDoUsuario(userId)?.liberadoDoModoRestrito ?? false
}

export function rotaBloqueadaParaUsuario(pathname: string, userId?: string | null): boolean {
  const acesso = acessoDoUsuario(userId)
  return !!acesso && acesso.rotasBloqueadas.some(prefixo => pathname.startsWith(prefixo))
}

/**
 * Quem enxerga a aba "Meu quadro" (Kanban pessoal por status) na página do Kanban.
 * A pedido da Valéria em 08/10/2026: os advogados preferem só o quadro do escritório
 * (estilo Trello); o quadro pessoal ficou só para ela.
 */
export const MEU_QUADRO_USER_IDS: readonly string[] = [
  'a7eccddf-443a-408d-be21-23a285093fca', // Valéria do Val
]

export function temMeuQuadro(userId?: string | null): boolean {
  return !!userId && MEU_QUADRO_USER_IDS.includes(userId)
}
