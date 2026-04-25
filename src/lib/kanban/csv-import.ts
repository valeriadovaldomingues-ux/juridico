/**
 * src/lib/kanban/csv-import.ts
 *
 * Parser de CSV do Trello → modelo kanban_tasks.
 * Sem side-effects — funciona em browser e servidor.
 *
 * Regras obrigatórias:
 *  - Ignorar cards com Last Activity Date anterior a IMPORT_CUTOFF (23/03/2026)
 *  - Capturar: título, descrição, status, prazo, responsável, número do processo,
 *    partes, área jurídica, labels, Trello card ID, last activity date
 */

import Papa from 'papaparse'
import type { KanbanStatus } from '@/types/kanban'

// ── Constantes ─────────────────────────────────────────────────────────────────

/** Cards com Last Activity Date anterior a esta data são rejeitados. */
export const IMPORT_CUTOFF = '2026-03-23'

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface ParsedCsvRow {
  trello_card_id:   string | null   // ID do card no Trello (para dedup por origem)
  titulo:           string
  descricao:        string | null
  status:           KanbanStatus
  prazo:            string | null   // yyyy-mm-dd
  last_activity:    string | null   // yyyy-mm-dd
  member_nome:      string | null   // nome bruto do responsável
  numero_processo:  string | null   // extraído do título ou campo dedicado
  partes_resumidas: string | null   // cliente / parte contrária
  area_juridica:    string | null   // mapeado dos labels
  labels:           string | null   // labels originais, comma-joined
}

export interface ParsedRejected {
  titulo:        string
  last_activity: string | null
  motivo:        string
}

export interface CsvParseResult {
  rows:     ParsedCsvRow[]     // linhas válidas (passaram cutoff)
  rejected: ParsedRejected[]   // linhas rejeitadas (antes do cutoff)
  errors:   string[]           // erros de parsing (sem bloquear o resto)
}

// ── Regex de número de processo (CNJ) ─────────────────────────────────────────

const PROCESS_NUMBER_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/

// ── Normalização de cabeçalhos ─────────────────────────────────────────────────

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const COLUMN_ALIASES: Record<string, string> = {
  // ID do card
  card_id:              'card_id',
  id:                   'card_id',
  card_number:          'card_id',

  // título / nome
  name:                 'name',
  card_name:            'name',
  titulo:               'name',
  nome:                 'name',
  title:                'name',
  tarefa:               'name',
  task:                 'name',

  // descrição / observações / último andamento
  description:          'description',
  descricao:            'description',
  desc:                 'description',
  nota:                 'description',
  notes:                'description',
  observacao:           'description',
  observacoes:          'description',
  ultimo_andamento:     'description',
  last_note:            'description',

  // coluna / lista / status
  list_name:            'list_name',
  list:                 'list_name',
  coluna:               'list_name',
  column:               'list_name',
  status:               'list_name',
  fase:                 'list_name',
  etapa:                'list_name',
  board_name:           'list_name',

  // responsável
  members:              'members',
  member:               'members',
  member_names:         'members',
  responsavel:          'members',
  responsavel_principal:'members',
  responsible:          'members',
  assignee:             'members',
  assignees:            'members',
  atribuido:            'members',
  assigned_to:          'members',

  // prazo
  due_date:             'due',
  due:                  'due',
  prazo:                'due',
  vencimento:           'due',
  deadline:             'due',
  data:                 'due',
  data_vencimento:      'due',
  data_prazo:           'due',

  // last activity
  last_activity_date:   'last_activity',
  last_activity:        'last_activity',
  ultima_atividade:     'last_activity',
  updated_at:           'last_activity',

  // labels / área
  label_names:          'labels',
  labels:               'labels',
  label:                'labels',
  etiquetas:            'labels',
  area:                 'labels',
  area_juridica:        'labels',

  // número do processo
  numero_processo:      'numero_processo',
  num_processo:         'numero_processo',
  process_number:       'numero_processo',
  processo:             'numero_processo',
  numero:               'numero_processo',
  nup:                  'numero_processo',

  // partes
  partes:               'partes',
  partes_resumidas:     'partes',
  cliente:              'partes',
  parte_contraria:      'partes',
  partes_do_processo:   'partes',
}

function buildColumnMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {}
  headers.forEach((h, i) => {
    const canonical = COLUMN_ALIASES[normalizeKey(h)]
    if (canonical) map[i] = canonical
  })
  return map
}

// ── Mapeamento de status ───────────────────────────────────────────────────────

function mapListToStatus(listName: string): KanbanStatus {
  const n = listName
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .trim()

  if (/^(a[\s_]?fazer|to[\s_]?do|todo|pendente|novo|new|aberto|backlog|inicio|inicio\.*|comecar)/.test(n))
    return 'a_fazer'

  if (/^(fazendo|em[\s_]?andamento|in[\s_]?progress|doing|wip|em[\s_]?execucao|em[\s_]?curso)/.test(n))
    return 'fazendo'

  if (/^(com[\s_]?pendencia|pendencia|blocked|bloqueado|impedido|aguardando|on[\s_]?hold|hold|travado)/.test(n))
    return 'com_pendencia'

  if (/^(concluido|done|finished|finalizado|arquivado|encerrado|completo|completed|pronto|ready|encerrada|arquivada)/.test(n))
    return 'concluido'

  return 'a_fazer'
}

// ── Mapeamento de área jurídica a partir de labels ────────────────────────────

const AREA_MAP: Array<[RegExp, string]> = [
  [/trabalhista|clt|empregado|trabalhador/i,       'Trabalhista'],
  [/civil|indeniza|contrato|familia|divorcio/i,    'Cível'],
  [/criminal|penal|crime|delito/i,                 'Criminal'],
  [/tributar|fiscal|imposto|tax/i,                 'Tributário'],
  [/empresarial|societario|empresa|comercial/i,    'Empresarial'],
  [/previdenciario|inss|beneficio|aposentadoria/i, 'Previdenciário'],
  [/administrativo|publico|licitacao/i,            'Administrativo'],
  [/consumidor|cdc|fornecedor/i,                   'Consumidor'],
  [/ambiental|meio[\s_]?ambiente/i,                'Ambiental'],
  [/imobiliario|imovel|condominio/i,               'Imobiliário'],
]

function labelsToArea(labels: string): string | null {
  if (!labels.trim()) return null
  for (const [re, area] of AREA_MAP) {
    if (re.test(labels)) return area
  }
  return null
}

// ── Parsing de data ────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // ISO timestamp → só a data
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]

  // MM/DD/YYYY (Trello padrão)
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    // heurística: se primeiro > 12 → DD/MM (BR)
    if (parseInt(m, 10) > 12) {
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

// ── Parsing de membro ─────────────────────────────────────────────────────────

function parseMember(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const parts = s.split(/[,;]|\s+e\s+/i).map(p => p.trim()).filter(Boolean)
  return parts[0] ?? null
}

// ── Extração de número do processo ────────────────────────────────────────────

function extractNumeroProcesso(text: string): string | null {
  const match = text.match(PROCESS_NUMBER_RE)
  return match ? match[0] : null
}

// ── Filtro de cutoff ──────────────────────────────────────────────────────────

function isBeforeCutoff(dateStr: string | null): boolean {
  if (!dateStr) return false   // sem data = não rejeita
  return dateStr < IMPORT_CUTOFF
}

// ── Parser principal ───────────────────────────────────────────────────────────

export function parseTrelloCsv(csvText: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header:          true,
    skipEmptyLines:  true,
    transformHeader: h => h.trim(),
  })

  const rows:     ParsedCsvRow[]    = []
  const rejected: ParsedRejected[]  = []
  const errors:   string[]          = []

  if (!result.data.length) {
    return { rows: [], rejected: [], errors: ['CSV vazio ou sem linhas válidas.'] }
  }

  const rawHeaders = result.meta.fields ?? []
  const colMap     = buildColumnMap(rawHeaders)
  const hasTitle   = Object.values(colMap).includes('name')

  if (!hasTitle) {
    return {
      rows:     [],
      rejected: [],
      errors: [
        `Coluna de título não encontrada. Colunas detectadas: ${rawHeaders.join(', ')}. ` +
        `Esperado: "Name", "Card Name", "Título" ou equivalente.`,
      ],
    }
  }

  result.data.forEach((rawRow, idx) => {
    const row: Record<string, string> = {}
    rawHeaders.forEach((h, i) => {
      const canonical = colMap[i]
      if (canonical) {
        // Para campos com múltiplos aliases (ex: partes), concatenar se já existir
        if (row[canonical] && row[canonical] !== rawRow[h]) {
          row[canonical] = `${row[canonical]} | ${rawRow[h] ?? ''}`
        } else {
          row[canonical] = rawRow[h] ?? ''
        }
      }
    })

    const titulo = (row['name'] ?? '').trim()
    if (!titulo) {
      errors.push(`Linha ${idx + 2}: título vazio — ignorada.`)
      return
    }

    const last_activity = parseDate(row['last_activity'] ?? '')

    // Regra: ignorar cards com atividade anterior ao cutoff
    if (isBeforeCutoff(last_activity)) {
      rejected.push({
        titulo,
        last_activity,
        motivo: `Última atividade ${last_activity} é anterior ao corte de ${IMPORT_CUTOFF}`,
      })
      return
    }

    const labels         = (row['labels'] ?? '').trim() || null
    const rawDescricao   = (row['description'] ?? '').trim() || null
    const rawNumProcesso = (row['numero_processo'] ?? '').trim() || null
    const rawPartes      = (row['partes'] ?? '').trim() || null

    // Tenta extrair número do processo do campo dedicado, título ou descrição
    const numero_processo =
      rawNumProcesso
        ? (PROCESS_NUMBER_RE.test(rawNumProcesso) ? rawNumProcesso : extractNumeroProcesso(rawNumProcesso))
        : extractNumeroProcesso(titulo) ?? (rawDescricao ? extractNumeroProcesso(rawDescricao) : null)

    rows.push({
      trello_card_id:   (row['card_id'] ?? '').trim() || null,
      titulo,
      descricao:        rawDescricao,
      status:           mapListToStatus(row['list_name'] ?? ''),
      prazo:            parseDate(row['due'] ?? ''),
      last_activity,
      member_nome:      parseMember(row['members'] ?? ''),
      numero_processo,
      partes_resumidas: rawPartes,
      area_juridica:    labels ? labelsToArea(labels) : null,
      labels,
    })
  })

  return { rows, rejected, errors }
}
