/**
 * src/types/easyjur.ts
 *
 * Tipos para o importador do Relatório Analítico do EasyJur (HTML).
 */

// ── Blocos extraídos do HTML ───────────────────────────────────────────────────

export interface EasyJurAndamento {
  data:     string | null   // DD/MM/YYYY
  tipo:     string | null
  descricao: string
}

export interface EasyJurPrazo {
  titulo:    string
  data:      string | null   // DD/MM/YYYY
  tipo:      'prazo' | 'audiencia' | 'tarefa' | 'outro'
  status:    string | null
  prioridade: string | null
  local?:    string | null   // para audiências
}

export interface EasyJurHonorario {
  descricao: string
  valor:     number | null
  data:      string | null
  status:    string | null
}

// ── Processo extraído do relatório ────────────────────────────────────────────

export interface EasyJurProcesso {
  // Identificação
  numero_processo:     string | null
  titulo:             string | null
  area_direito:       string | null
  status:             string | null
  tribunal:           string | null
  vara:               string | null

  // Partes
  cliente:            string | null
  cpf_cnpj_cliente:   string | null
  parte_contraria:    string | null
  partes_vinculadas:  string[]         // outros réus, terceiros, litisconsortes…

  // Responsabilidade
  responsavel:        string | null

  // Histórico processual
  andamentos:         EasyJurAndamento[]
  ultimo_andamento:   string | null    // texto bruto do último andamento real

  // Agenda
  prazos:             EasyJurPrazo[]
  audiencias:         EasyJurPrazo[]
  tarefas:            EasyJurPrazo[]

  // Financeiro
  honorarios:         EasyJurHonorario[]
  custas:             EasyJurHonorario[]
  alvaras:            EasyJurHonorario[]

  // Dados complementares (armazenados como texto livre)
  incidentes:         string[]
  processos_apensados: string[]
  pedidos:            string[]
  documentos:         string[]

  // Diagnóstico do parser
  campos_nao_encontrados: string[]
  avisos:              string[]
}

// ── Resultado do parse de um arquivo ─────────────────────────────────────────

export interface EasyJurParseResult {
  processos:        EasyJurProcesso[]
  arquivo_nome:     string
  total_encontrados: number
  erros_parse:      string[]          // erros que afetaram o arquivo todo
}

// ── Resultado da importação no banco ─────────────────────────────────────────

export interface EasyJurImportLog {
  numero_processo: string | null
  acao:            'criado' | 'atualizado' | 'ignorado' | 'erro'
  mensagem:        string
  campos_atualizados?: string[]
}

export interface EasyJurImportResult {
  import_batch_id:    string
  arquivo_nome:       string
  criados:            number
  atualizados:        number
  ignorados:          number
  erros:              number
  prazos_inseridos:   number
  partes_inseridas:   number
  log:                EasyJurImportLog[]
}
