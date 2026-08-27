/**
 * Modo restrito temporário — só Kanban liberado para quem não é sócio.
 *
 * Módulo isolado (zero dependências) para ser importado tanto pelo
 * proxy.ts (Edge Runtime) quanto por lib/permissions.ts, com uma única
 * fonte de verdade — e para os testes conseguirem mockar o valor sem
 * afetar o comportamento real em produção (ver proxy.test.ts vs
 * proxy.kanban-only-mode.test.ts).
 *
 * Reverter = virar false aqui. A matriz de permissões em permissions.ts
 * (PERMISSIONS, ALLOWED_ROUTES, RESTRICTED_ROUTES) continua intacta e
 * volta a valer normalmente, sem precisar reescrever nada.
 */
export const KANBAN_ONLY_MODE = true
