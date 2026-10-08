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

export const ACESSO_POR_USUARIO: Readonly<Record<string, AcessoUsuario>> = {
  // Marcelo Mariano (advogado) — a pedido da Valéria em 08/10/2026: tudo do papel
  // advogado, exceto Documentos, Monitoramento, IA Jurídica e Painel TV.
  // (Comercial, Financeiro, Cobranças, Relatórios, Importar, Automações,
  // Integrações, Dashboard TV, Usuários e Configurações já são barrados pelo papel.)
  '1a5ed586-77e0-4f6f-a652-444056d86b1b': {
    liberadoDoModoRestrito: true,
    rotasBloqueadas: ['/documentos', '/monitoramento', '/ia-juridica', '/tv'],
  },
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
