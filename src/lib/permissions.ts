import type { UserRole } from '@/types'

// ─── Roles internos (staff) — usados para filtrar UIs internas ───────────────
// 'cliente' é um role externo do portal e não deve aparecer em
// seletores de criação/edição de usuários do escritório.
export const INTERNAL_ROLES: UserRole[] = [
  'estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio',
]

// ─── Labels e cores por perfil ────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  estagiario:     'Estagiário',
  comercial:      'Comercial',
  administrativo: 'Administrativo',
  advogado:       'Advogado',
  gerente:        'Gerente',
  socio:          'Sócio',
  cliente:        'Cliente',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  estagiario:     'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80',
  comercial:      'bg-orange-50 text-orange-700 ring-1 ring-orange-200/80',
  administrativo: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80',
  advogado:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
  gerente:        'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
  socio:          'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80',
  cliente:        'bg-teal-50 text-teal-700 ring-1 ring-teal-200/80',
}

// ─── Módulos e Ações ──────────────────────────────────────────────────────────

/**
 * Módulos funcionais do sistema.
 * Cada módulo pode ter ações independentes por perfil.
 */
export type Module =
  | 'dashboard'
  | 'clientes'
  | 'processos'
  | 'partes'        // partes do processo (vinculado ao módulo processos)
  | 'agenda'
  | 'kanban'
  | 'publicacoes'
  | 'documentos'
  | 'importacao'
  | 'financeiro'
  | 'comercial'
  | 'ferramentasPdf'
  | 'relatorios'
  | 'monitoramento'
  | 'usuarios'
  | 'configuracoes'

/**
 * Ações possíveis por módulo.
 * - view:   visualizar o módulo / lista de registros
 * - create: criar novos registros
 * - edit:   editar registros existentes
 * - delete: excluir registros
 * - manage: administração total (usuários, configurações)
 */
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'manage'

// ─── Matriz de Permissões ─────────────────────────────────────────────────────
//
// Fonte de verdade única para o controle de acesso por perfil.
// Use can(role, module, action) para verificar permissão em qualquer contexto.
//
// Convenções:
//  - Ausência de um módulo = sem acesso algum
//  - 'delete' é sempre restrito; apenas gerente/sócio em módulos operacionais,
//    apenas sócio em módulos críticos (financeiro, usuarios)
//  - 'manage' indica acesso administrativo total (além do CRUD)

type PermMatrix = Record<UserRole, Partial<Record<Module, Action[]>>>

const PERMISSIONS: PermMatrix = {

  // ── Estagiário ───────────────────────────────────────────────────────────────
  // Acesso de leitura majoritariamente. Pode criar/editar apenas em módulos
  // operacionais de baixo risco (agenda e kanban próprios, upload de docs).
  estagiario: {
    dashboard:   ['view'],
    clientes:    ['view'],
    processos:   ['view'],
    partes:      ['view'],
    agenda:      ['view', 'create', 'edit'],
    kanban:      ['view', 'create', 'edit'],
    publicacoes: ['view'],
    documentos:  ['view', 'create'],
    ferramentasPdf: ['view'],
  },

  // ── Comercial ────────────────────────────────────────────────────────────────
  // Foco exclusivo no pipeline CRM. Acesso apenas ao módulo comercial e clientes.
  // Não acessa agenda, kanban, documentos, publicações, ia-juridica ou financeiro.
  comercial: {
    dashboard:  ['view'],
    clientes:   ['view', 'create', 'edit'],
    comercial:  ['view', 'create', 'edit', 'delete'],
    ferramentasPdf: ['view'],
  },

  // ── Administrativo ───────────────────────────────────────────────────────────
  // Acesso operacional completo. Sem publicacoes, financeiro, relatórios,
  // monitoramento, ia-juridica, automações, integrações ou configurações.
  administrativo: {
    dashboard:    ['view'],
    clientes:     ['view', 'create', 'edit'],
    processos:    ['view', 'create', 'edit'],
    partes:       ['view', 'create', 'edit'],
    agenda:       ['view', 'create', 'edit', 'delete'],
    kanban:       ['view', 'create', 'edit', 'delete'],
    documentos:   ['view', 'create', 'edit', 'delete'],
    importacao:   ['view', 'create'],
    comercial:    ['view'],
    ferramentasPdf: ['view'],
  },

  // ── Advogado ─────────────────────────────────────────────────────────────────
  // Acesso jurídico completo. Sem financeiro, relatórios, automações,
  // integrações, comercial ou configurações.
  advogado: {
    dashboard:    ['view'],
    clientes:     ['view', 'create', 'edit'],
    processos:    ['view', 'create', 'edit'],
    partes:       ['view', 'create', 'edit'],
    agenda:       ['view', 'create', 'edit', 'delete'],
    kanban:       ['view', 'create', 'edit', 'delete'],
    publicacoes:  ['view', 'create', 'edit'],
    documentos:   ['view', 'create', 'edit'],
    monitoramento: ['view'],
    ferramentasPdf: ['view'],
  },

  // ── Gerente ──────────────────────────────────────────────────────────────────
  // Visão operacional completa, incluindo automações, monitoramento e relatórios.
  // Sem financeiro, comercial (CRM interno) ou configurações.
  gerente: {
    dashboard:    ['view'],
    clientes:     ['view', 'create', 'edit'],
    processos:    ['view', 'create', 'edit'],
    partes:       ['view', 'create', 'edit'],
    agenda:       ['view', 'create', 'edit', 'delete'],
    kanban:       ['view', 'create', 'edit', 'delete'],
    publicacoes:  ['view', 'create', 'edit'],
    documentos:   ['view', 'create', 'edit'],
    importacao:   ['view', 'create'],
    relatorios:   ['view'],
    monitoramento: ['view'],
    ferramentasPdf: ['view'],
  },

  // ── Sócio ────────────────────────────────────────────────────────────────────
  // Acesso total ao sistema. Único perfil que pode excluir registros críticos,
  // gerenciar usuários e acessar configurações.
  socio: {
    dashboard:    ['view'],
    clientes:     ['view', 'create', 'edit', 'delete'],
    processos:    ['view', 'create', 'edit', 'delete'],
    partes:       ['view', 'create', 'edit', 'delete'],
    agenda:       ['view', 'create', 'edit', 'delete'],
    kanban:       ['view', 'create', 'edit', 'delete'],
    publicacoes:  ['view', 'create', 'edit', 'delete'],
    documentos:   ['view', 'create', 'edit', 'delete'],
    importacao:   ['view', 'create'],
    financeiro:   ['view', 'create', 'edit', 'delete'],
    comercial:    ['view', 'create', 'edit', 'delete'],
    relatorios:   ['view'],
    monitoramento: ['view', 'create', 'edit', 'manage'],
    usuarios:     ['view', 'create', 'edit', 'delete', 'manage'],
    configuracoes: ['view', 'edit', 'manage'],
    ferramentasPdf: ['view'],
  },

  // ── Cliente (portal externo) ──────────────────────────────────────────────
  // Sem acesso a nenhum módulo interno. Todo o acesso é via /portal/*.
  // Este objeto existe apenas para satisfazer Record<UserRole, …>.
  cliente: {},
}

// ─── Helper principal ─────────────────────────────────────────────────────────

/**
 * Verifica se um perfil pode executar uma ação em um módulo.
 *
 * @example
 * can('advogado', 'processos', 'edit')   // true
 * can('estagiario', 'financeiro', 'view') // false
 * can('socio', 'usuarios', 'manage')     // true
 */
export function can(role: UserRole, module: Module, action: Action = 'view'): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false
}

/**
 * Helpers de conveniência para os casos mais comuns.
 * Evitam repetição de action strings no código.
 */
export const canView   = (role: UserRole, module: Module) => can(role, module, 'view')
export const canCreate = (role: UserRole, module: Module) => can(role, module, 'create')
export const canEdit   = (role: UserRole, module: Module) => can(role, module, 'edit')
export const canDelete = (role: UserRole, module: Module) => can(role, module, 'delete')
export const canManage = (role: UserRole, module: Module) => can(role, module, 'manage')

// ─── Rotas permitidas por perfil (sidebar) ────────────────────────────────────
//
// Define quais hrefs aparecem na sidebar. Alinhado com a coluna 'view' da matriz
// acima. Separado para manter a navegação independente do PERMISSIONS map.

export const ALLOWED_ROUTES: Record<UserRole, string[]> = {
  estagiario: [
    '/dashboard',
    '/clientes',
    '/processos',
    '/agenda',
    '/kanban',
    '/publicacoes',
    '/documentos',
    '/ferramentas-pdf',
  ],
  comercial: [
    '/dashboard',
    '/clientes',
    '/comercial',
    '/ferramentas-pdf',
  ],
  administrativo: [
    '/dashboard',
    '/clientes',
    '/processos',
    '/agenda',
    '/kanban',
    '/documentos',
    '/ferramentas-pdf',
    '/importar',
    '/comercial',
  ],
  advogado: [
    '/dashboard',
    '/clientes',
    '/processos',
    '/agenda',
    '/kanban',
    '/publicacoes',
    '/documentos',
    '/ferramentas-pdf',
    '/monitoramento',
    '/ia-juridica',
  ],
  gerente: [
    '/dashboard',
    '/clientes',
    '/processos',
    '/agenda',
    '/kanban',
    '/publicacoes',
    '/documentos',
    '/ferramentas-pdf',
    '/relatorios',
    '/importar',
    '/automacoes',
    '/monitoramento',
    '/ia-juridica',
    '/integracoes/trello',
  ],
  socio: [
    '/dashboard',
    '/clientes',
    '/processos',
    '/agenda',
    '/kanban',
    '/publicacoes',
    '/financeiro',
    '/documentos',
    '/ferramentas-pdf',
    '/comercial',
    '/relatorios',
    '/importar',
    '/automacoes',
    '/monitoramento',
    '/ia-juridica',
    '/integracoes/trello',
    '/integracoes/gmail',
    '/configuracoes/usuarios',
    '/configuracoes',
  ],
  // Cliente externo: sem rotas internas — acesso exclusivo via /portal/*
  cliente: [],
}

// ─── Rotas restritas (enforcement no proxy) ───────────────────────────────────
//
// Paths mais específicos devem vir antes dos mais genéricos.
// Esta lista é inlined em proxy.ts por compatibilidade com edge runtime.

// Paths mais específicos DEVEM vir antes dos genéricos (ex: /ia-juridica/aurora antes de /ia-juridica).
export const RESTRICTED_ROUTES: Array<{ prefix: string; roles: UserRole[] }> = [
  // ── Aurora (exclusivo sócio — trava para futura feature) ─────────────────────
  { prefix: '/aurora-mobile',          roles: ['socio'] },
  { prefix: '/ia-juridica/aurora',    roles: ['socio'] },

  // ── Financeiro ────────────────────────────────────────────────────────────────
  { prefix: '/financeiro',            roles: ['socio'] },

  // ── Automação e integrações ───────────────────────────────────────────────────
  { prefix: '/automacoes',            roles: ['gerente', 'socio'] },
  { prefix: '/integracoes/gmail',      roles: ['socio'] },
  { prefix: '/integracoes',           roles: ['gerente', 'socio'] },

  // ── Relatórios (gerente e sócio — advogado removido) ─────────────────────────
  { prefix: '/relatorios',            roles: ['gerente', 'socio'] },

  // ── Comercial (CRM interno — somente quem o usa) ─────────────────────────────
  { prefix: '/comercial',             roles: ['comercial', 'administrativo', 'socio'] },

  // ── Monitoramento (advogado, gerente, sócio) ──────────────────────────────────
  { prefix: '/monitoramento',         roles: ['advogado', 'gerente', 'socio'] },

  // ── Importar (administrativo, gerente, sócio) ─────────────────────────────────
  { prefix: '/importar',             roles: ['administrativo', 'gerente', 'socio'] },

  // ── IA Jurídica (/aurora já tratado acima) ────────────────────────────────────
  { prefix: '/ia-juridica',           roles: ['advogado', 'gerente', 'socio'] },

  // ── Configurações (/usuarios mais específico antes) ───────────────────────────
  { prefix: '/configuracoes/usuarios', roles: ['socio'] },
  { prefix: '/configuracoes',         roles: ['socio'] },
]

/**
 * Retorna se um perfil pode acessar uma rota.
 * Usado por guards server-side. O proxy.ts tem a mesma lógica inlined
 * para compatibilidade com edge runtime.
 */
export function roleCanAccessRoute(role: UserRole, pathname: string): boolean {
  for (const { prefix, roles } of RESTRICTED_ROUTES) {
    if (pathname.startsWith(prefix)) return roles.includes(role)
  }
  return true
}

// ─── Extensão futura: acesso por processo ────────────────────────────────────
//
// Hoje: todos os usuários autenticados veem todos os processos.
// Para ativar restrição por responsável/equipe (fase 2), consultar:
//   supabase/rbac_migration.sql — seção "Restrição por responsável"

export function canAccessProcesso(
  _role: UserRole,
  _userId: string,
  _processoResponsavelId: string | null,
): boolean {
  return true
  // Fase 2:
  // return ['socio', 'gerente'].includes(_role) || _processoResponsavelId === _userId
}

// ─── canAccessModule ──────────────────────────────────────────────────────────
/**
 * Verifica se um perfil pode visualizar (acessar) um módulo.
 * Equivale a canView, nomeado para clareza semântica.
 */
export const canAccessModule = (role: UserRole, module: Module) => can(role, module, 'view')

// ─── Redirecionamento pós-login por perfil ────────────────────────────────────
//
// Define para qual rota cada perfil é enviado imediatamente após o login.
// 'comercial' vai direto para o módulo comercial; demais vão para o dashboard.

export const ROLE_REDIRECT: Record<UserRole, string> = {
  estagiario:     '/dashboard',
  comercial:      '/comercial',
  administrativo: '/dashboard',
  advogado:       '/dashboard',
  gerente:        '/dashboard',
  socio:          '/dashboard',
  cliente:        '/portal',
}
