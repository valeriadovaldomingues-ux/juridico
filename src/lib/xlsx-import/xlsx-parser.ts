// ─────────────────────────────────────────────────────────────────────────────
// src/lib/xlsx-import/xlsx-parser.ts
//
// Leitura e validação do arquivo .xlsx exportado pelo EasyJur.
//
// O EasyJur exporta 111 colunas em posições fixas, com cabeçalho na linha 1
// e dados a partir da linha 2. O mapeamento é feito por ÍNDICE de coluna,
// não pelo nome do cabeçalho, para robustez contra variações de tradução.
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx'
import type { XlsxRawObject } from '@/types/xlsx-import'

// ─── Mapeamento de colunas por índice ─────────────────────────────────────────

/**
 * Mapa definitivo das colunas do EasyJur (verificado contra agenda14424.xlsx).
 * Cada valor é o nome do campo interno correspondente.
 *
 * Colunas com comentário "—" são ignoradas (financeiro, flags internas, etc.)
 */
export const EASYJUR_COL = {
  SOURCE_EVENT_ID:     0,   // id (numérico: 821527, 820772…)
  WORKFLOW_NAME:       1,   // Evento (ex: "Workflow Principal")
  EVENT_TYPE:          2,   // Tipo   (AUDIENCIA | PRAZO | TAREFA | PERICIA | CONSULTORIA)
  // col 3: Workflow (detalhe — geralmente vazio)
  OWNER_NAME:          4,   // Responsável 1 (advogada titular)
  ASSIGNED_NAME:       5,   // Responsável 2
  CLIENT_NAME:         6,   // Cliente
  OPPOSING_PARTY:      7,   // Contrario (parte contrária)
  EVENT_DATE:          8,   // Data interna  (dd/mm/yyyy — data do evento)
  DEADLINE_DATE:       9,   // Data fatal    (dd/mm/yyyy — prazo)
  // cols 10-13: Contrato, Local, Grupos, Data conclusão — ignorados
  PUBLICATION_DATE_AG: 14,  // Data publicação (agenda)
  // col 15: Data cancelamento — ignorado
  CREATED_DATE:        16,  // Data cadastro (no EasyJur)
  START_TIME:          17,  // Hora início (HH:mm:ss)
  END_TIME:            18,  // Hora fim    (HH:mm:ss)
  // cols 19-23: Timesheet, Custo, Receita, Receita Hora Media, Resultado — ignorados
  STATUS:              24,  // Status  (ABERTO | CONCLUIDO | CANCELADO)
  DESCRIPTION:         25,  // Descrição (texto longo da publicação)
  RESOLUTION:          26,  // Resolução
  // cols 27-43: Desdobramento e bloco de negócios — ignorados
  PROCESS_ID_EXT:      44,  // Id do Processo no EasyJur
  COURT_RITE:          45,  // Rito (ordinario, sumario…)
  PROCESS_LAWYER:      46,  // Advogado responsável pelo processo
  CLIENT_ID_EXT:       47,  // Id do Cliente no EasyJur
  CLIENT_NAME_PROC:    48,  // Nome do Cliente (processo — confirma col 6)
  CLIENT_DATA:         49,  // Dados completos do cliente (texto)
  OPPOSING_PARTY_PROC: 50,  // Contrário (processo — confirma col 7)
  OPPOSING_DATA:       51,  // Dados completos do contrário
  JUDGE:               52,  // Juiz
  PROCESS_NUMBER:      53,  // Número do Processo CNJ (entre aspas: "0001310-55.2024…")
  COURT:               54,  // Tribunal (ex: "TRT03 - Tribunal Regional…")
  COUNTY:              55,  // Comarca
  STATE:               56,  // UF (2 letras)
  COURT_BRANCH:        57,  // Vara
  MATTER:              58,  // Tipo da Ação
  PROCEDURAL_ROLE:     59,  // Qualificação do Cliente (Reclamada, Reu…)
  CASE_CLASS:          60,  // Título da Ação (RECLAMATÓRIA TRABALHISTA)
  CASE_VALUE:          61,  // Valor da Causa (numérico brasileiro: 151836,80)
  FOLDER_NUMBER:       62,  // Número da Pasta (interno EasyJur)
  // cols 63-65: Detalhes da Pasta, Outro Número, Instância — ignorados
  PROCESS_TYPE:        66,  // Tipo do Processo (judicial | extrajudicial)
  // col 67: Push (Nao/Sim) — ignorado
  DISTRIBUTION_DATE:   68,  // Data da Distribuição
  // cols 69-71: Data Cadastro Proc, Data Encerramento, Observações — ignorados
  PROCESS_STATUS:      72,  // Status do processo (Ativo, Encerrado…)
  PRACTICE_AREA:       73,  // Área (Trabalhista, Cível…)
  // cols 74-75: Processos Apensos, Risco — ignorados
  CURRENT_PHASE:       76,  // Fase Atual (Conhecimento…)
  // cols 77-81: Resultado, Grupo, Valor Provisionado, Tipo Desdobramento, Valor Possivel
  PARTIES_INFO:        82,  // Partes do processo (texto completo)
  // cols 83-104: financeiro, projeto — ignorados
} as const

// ─── Resultado do parser ───────────────────────────────────────────────────────

export interface ParsedXlsx {
  headers:    string[]         // Cabeçalhos da linha 1
  dataRows:   XlsxRawObject[]  // Linhas de dados como objetos chave→valor
  rawArrays:  string[][]       // Linhas de dados como arrays (col[idx] = valor)
  totalRows:  number
  detectedType: string
}

// ─── Funções auxiliares ────────────────────────────────────────────────────────

/**
 * Detecta o tipo de exportação com base nos cabeçalhos e primeiros valores.
 * Retorna uma string descritiva para exibição no preview.
 */
function detectExportType(headers: string[], firstDataRow: string[]): string {
  const hasId     = headers[0]?.toLowerCase() === 'id'
  const hasTipo   = ['AUDIENCIA', 'PRAZO', 'TAREFA'].includes(firstDataRow[2] ?? '')
  const hasTRT    = (firstDataRow[54] ?? '').startsWith('TRT')

  if (hasId && hasTipo && hasTRT) return 'EasyJur — Exportação de Agenda'
  if (hasId && hasTipo)           return 'EasyJur — Agenda (sem processo)'
  return 'Planilha desconhecida'
}

/**
 * Converte uma linha bruta (array de célula) em objeto chave→valor
 * usando os cabeçalhos como chave.
 */
function rowToObject(headers: string[], row: string[]): XlsxRawObject {
  const obj: XlsxRawObject = {}
  headers.forEach((h, i) => {
    obj[h || `col_${i}`] = (row[i] ?? '').trim()
  })
  return obj
}

// ─── Parser principal ──────────────────────────────────────────────────────────

/**
 * Lê um buffer de arquivo .xlsx e retorna a estrutura de dados normalizada.
 *
 * @param buffer  - ArrayBuffer do arquivo .xlsx
 * @param filename - Nome original do arquivo (para metadados)
 */
export function parseXlsx(buffer: ArrayBuffer, filename: string): ParsedXlsx {
  const workbook = XLSX.read(Buffer.from(buffer), {
    type:   'buffer',
    raw:    false,        // formata como string
    dateNF: 'dd/mm/yyyy', // garante formato brasileiro nas datas
  })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Arquivo .xlsx não contém nenhuma planilha')
  }

  const worksheet = workbook.Sheets[sheetName]
  const allRows   = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header:  1,
    defval:  '',
    raw:     false,
  }) as string[][]

  if (allRows.length < 2) {
    throw new Error('A planilha está vazia ou tem apenas cabeçalho')
  }

  // Linha 1 = cabeçalhos
  const headers = allRows[0].map(h => String(h).trim())

  // Linhas 2+ = dados (filtra linhas completamente vazias)
  const dataArrays = allRows
    .slice(1)
    .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
    .map(row => row.map(cell => String(cell ?? '').trim()))

  const dataRows = dataArrays.map(row => rowToObject(headers, row))

  return {
    headers,
    dataRows,
    rawArrays: dataArrays,
    totalRows: dataArrays.length,
    detectedType: detectExportType(headers, dataArrays[0] ?? []),
  }
}
