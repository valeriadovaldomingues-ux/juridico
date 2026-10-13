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

import { KANBAN_ONLY_MODE } from '@/lib/kanban-only-mode'

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

// Pedido da Valéria em 13/10/2026: o que está liberado para a Débora (Dashboard, Clientes,
// Processos, INPI, Agenda, Kanban, Reuniões, Horas, Publicações e Ferramentas PDF) vale para
// TODOS os advogados, para o gerente e para o estagiário — inclusive quem entrar depois.
// Cada papel bloqueia o que a Débora não tem. Administrativo e comercial ficam como estavam.
// (Permissões de dados por papel — ex.: estagiário só lança observação — continuam valendo.)
export const ACESSO_POR_PAPEL: Readonly<Record<string, AcessoUsuario>> = {
  advogado: ADVOGADO_SEM_DOCUMENTOS_MONITORAMENTO_IA_TV,
  gerente: {
    liberadoDoModoRestrito: true,
    rotasBloqueadas: ['/documentos', '/relatorios', '/importar', '/automacoes', '/monitoramento', '/ia-juridica', '/integracoes', '/tv'],
  },
  estagiario: {
    liberadoDoModoRestrito: true,
    rotasBloqueadas: ['/documentos', '/tv'],
  },
}

/**
 * Ajuste pessoal tem prioridade; senão vale o do papel (quando informado). O do papel só existe
 * enquanto o modo restrito (KANBAN_ONLY_MODE) estiver ligado: é ele que libera esses papéis do
 * modo restrito mantendo o escopo da Débora. Desligando o modo, volta a valer a matriz normal.
 */
export function acessoDoUsuario(userId?: string | null, role?: string | null): AcessoUsuario | null {
  return (userId && ACESSO_POR_USUARIO[userId]) || (KANBAN_ONLY_MODE && role && ACESSO_POR_PAPEL[role]) || null
}

export function usuarioLiberadoDoModoRestrito(userId?: string | null, role?: string | null): boolean {
  return acessoDoUsuario(userId, role)?.liberadoDoModoRestrito ?? false
}

export function rotaBloqueadaParaUsuario(pathname: string, userId?: string | null, role?: string | null): boolean {
  const acesso = acessoDoUsuario(userId, role)
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
