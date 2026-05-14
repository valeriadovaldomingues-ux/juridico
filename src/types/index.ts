// ─── Usuários e Perfis ────────────────────────────────────────────────────────

/**
 * Papéis de usuário do sistema.
 * Roles internos (staff): estagiario < comercial < administrativo < advogado < gerente < socio
 * Role externo (portal): cliente — acesso exclusivo a /portal, sem acesso ao painel interno
 */
export type UserRole =
  | 'estagiario'
  | 'comercial'
  | 'administrativo'
  | 'advogado'
  | 'gerente'
  | 'socio'
  | 'cliente'

export interface Profile {
  id: string
  nome: string
  email: string
  role: UserRole
  ativo: boolean
  created_at: string
}

// ─── Clientes / CRM ───────────────────────────────────────────────────────────

export type TipoPessoa = 'fisica' | 'juridica'

export type TipoContato =
  | 'cliente'
  | 'parte_contraria'
  | 'parceiro'
  | 'fornecedor'
  | 'comercial'

export type TipoInteracao =
  | 'ligacao'
  | 'reuniao'
  | 'email'
  | 'mensagem'
  | 'observacao'
  | 'tarefa_concluida'

export interface Cliente {
  id: string
  tipo_pessoa: TipoPessoa
  nome: string
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  celular: string | null
  cep: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  // CRM fields (added via clientes_crm_migration.sql)
  tipo_contato: TipoContato
  responsavel_id: string | null
  ultimo_contato: string | null
  cargo: string | null
  empresa: string | null
  tags: string[]
  // Campos de busca e relatório (added via clientes_campos_relatorio.sql)
  nome_fantasia?: string | null
  socio_representante?: string | null
  cnpj_raiz?: string | null
  // joined
  responsavel?: Profile
  processos_count?: number
}

export interface ContactInteraction {
  id: string
  cliente_id: string
  tipo: TipoInteracao
  descricao: string
  usuario_id: string
  created_at: string
  usuario?: Profile
}

// ─── Processos ────────────────────────────────────────────────────────────────

export type AreaDireito =
  | 'civil'
  | 'trabalhista'
  | 'criminal'
  | 'tributario'
  | 'previdenciario'
  | 'administrativo'
  | 'familia'
  | 'empresarial'
  | 'outro'

export type StatusProcesso = 'ativo' | 'suspenso' | 'arquivado' | 'encerrado'

export interface Processo {
  id: string
  numero_processo: string | null
  titulo: string
  area_direito: AreaDireito
  status: StatusProcesso
  fase: string | null
  cliente_id: string
  /**
   * ID do advogado responsável.
   * Usado hoje para exibição. Em fase futura, será o critério de restrição
   * de acesso por responsável/equipe via RLS policy no Supabase.
   * Ver: supabase/rbac_migration.sql — seção "Restrição por responsável"
   */
  advogado_responsavel_id: string | null
  tribunal: string | null
  vara: string | null
  valor_causa: number | null
  data_distribuicao: string | null
  observacoes: string | null
  created_at: string
  cliente?: Cliente
  advogado?: Profile
}

export type TipoParte = 'autor' | 'reu' | 'terceiro' | 'outro'

/**
 * Pessoa física ou jurídica que aparece como parte em processos.
 * Separada de `Cliente` (que possui dados de contato completos).
 * Deduplicada por nome normalizado (case-insensitive, trim).
 */
export interface Pessoa {
  id: string
  nome: string
  cpf_cnpj: string | null
  created_at: string
}

export interface ParteProcesso {
  id: string
  processo_id: string
  /** Referência normalizada à tabela pessoas. Null em registros anteriores à migração. */
  pessoa_id: string | null
  /** Texto livre — mantido para exibição e retrocompatibilidade. */
  pessoa_nome: string
  tipo_parte: TipoParte
  documento: string | null
  observacoes: string | null
}

// ─── Prazos ───────────────────────────────────────────────────────────────────

export type PrioridadePrazo = 'baixa' | 'media' | 'alta' | 'urgente'
export type StatusPrazo     = 'pendente' | 'concluido' | 'cancelado'
export type TipoPrazo       = 'audiencia' | 'prazo_processual' | 'reuniao' | 'diligencia' | 'outro'

export interface Prazo {
  id: string
  processo_id: string | null
  tipo: TipoPrazo
  titulo: string
  descricao: string | null
  data_inicio: string | null
  data_final: string
  prioridade: PrioridadePrazo
  status: StatusPrazo
  responsavel_id: string | null
  created_at: string
  processo?: Processo
  responsavel?: Profile
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

export type TipoLancamento   = 'receita' | 'despesa'
export type StatusLancamento = 'pendente' | 'pago' | 'vencido' | 'cancelado'

export interface FinanceiroLancamento {
  id: string
  tipo: TipoLancamento
  categoria: string
  cliente_id: string | null
  processo_id: string | null
  descricao: string
  valor: number
  vencimento: string
  pagamento_em: string | null
  status: StatusLancamento
  centro_custo: string | null
  created_at: string
  cliente?: Cliente
  processo?: Processo
}

// ─── Documentos ───────────────────────────────────────────────────────────────

export interface Documento {
  id: string
  processo_id: string | null
  cliente_id: string | null
  nome_arquivo: string
  tipo_documento: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
}
