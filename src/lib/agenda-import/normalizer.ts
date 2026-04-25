// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/normalizer.ts
//
// Mapeamento automático de colunas e normalização de dados do EasyJur.
// Converte datas brasileiras, mapeia tipos/status e limpa strings.
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedAgendaRow, RawCsvRow } from '@/types/agenda-import'

// ─── Normalização de chaves ───────────────────────────────────────────────────

/**
 * Normaliza uma string para comparação de cabeçalhos:
 * minúsculas, sem acentos, sem caracteres especiais, espaços reduzidos.
 */
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s]/g, '')    // remove não-alfanuméricos
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Tabela de mapeamento de cabeçalhos ──────────────────────────────────────

/**
 * Mapeia cabeçalhos do EasyJur (normalizados) para campos internos.
 *
 * Campos com sufixo _raw são valores brutos que precisam de parsing adicional
 * (datas, horas, status, tipo).
 */
const EASYJUR_HEADER_MAP: Record<string, string> = {
  // ── Identificador do evento ─────────────────────────────────────────────────
  'id':                          'source_event_id',
  'agendamento':                 'source_event_id',
  'id agendamento':              'source_event_id',
  'cod':                         'source_event_id',
  'codigo':                      'source_event_id',

  // ── Responsável (EasyJur usa "Responsável 1" e "Responsável 2") ───────────
  'responsavel':                 'responsible_name',
  'responsavel 1':               'responsible_name',
  'responsavel principal':       'responsible_name',
  'advogado responsavel':        'responsible_name',
  'advogado':                    'responsible_name',
  'responsavel pelo evento':     'responsible_name',
  'responsavel 2':               '_responsible_2',   // secundário, ignorado
  'assigned':                    'responsible_name',

  // ── Processo ────────────────────────────────────────────────────────────────
  'processo':                    'process_number',
  'numero do processo':          'process_number',
  'num processo':                'process_number',
  'no processo':                 'process_number',
  'n processo':                  'process_number',
  'numero cnj':                  'process_number',
  'numero':                      'process_number',

  // ── Tribunal / Comarca ──────────────────────────────────────────────────────
  'tribunal':                    'court',
  'orgao julgador':              'court',
  'vara':                        'court',
  'comarca':                     'county',
  'foro':                        'county',

  // ── Cliente ─────────────────────────────────────────────────────────────────
  'cliente':                     'client_name',
  'nome do cliente':             'client_name',
  'parte':                       'client_name',
  'reclamada':                   'client_name',

  // ── Parte contrária ─────────────────────────────────────────────────────────
  'contrario':                   'opposing_party_name',
  'parte contraria':             'opposing_party_name',
  'parte adversa':               'opposing_party_name',
  'adversario':                  'opposing_party_name',
  'reu':                         'opposing_party_name',
  'reclamante':                  'opposing_party_name',

  // ── Tipo e subtipo ──────────────────────────────────────────────────────────
  'tipo':                        'tipo_raw',
  'tipo do evento':              'tipo_raw',
  'subtipo':                     'subtype',
  'subtipo do evento':           'subtype',
  'categoria':                   'subtype',
  // "Evento" no EasyJur = nome do workflow (não o tipo de evento)
  'evento':                      '_ignored',

  // ── Descrição / conteúdo ────────────────────────────────────────────────────
  'descricao':                   'descricao',
  'descricao do evento':         'descricao',
  'observacoes':                 'descricao',
  'obs':                         'descricao',
  'titulo':                      'titulo_raw',
  'assunto':                     'titulo_raw',

  // ── Resolução (anexada à descrição) ─────────────────────────────────────────
  'resolucao':                   'resolucao_raw',
  'resultado':                   'resolucao_raw',

  // ── Datas ───────────────────────────────────────────────────────────────────
  // "Data Interna" = data real do evento no EasyJur (prioridade #1 para data_inicio)
  'data interna':                'data_inicio_raw',
  'data do evento':              'data_inicio_raw',
  'data evento':                 'data_inicio_raw',
  'data de realizacao':          'data_inicio_raw',
  'data realizacao':             'data_inicio_raw',
  'data agenda':                 'data_inicio_raw',
  'data prevista':               'data_inicio_raw',

  // "Data fatal" = prazo; também fallback #2 para data_inicio quando não há data interna
  'data fatal':                  'data_fatal_raw',
  'data limite':                 'data_fatal_raw',
  'prazo':                       'prazo_final_raw',
  'prazo fatal':                 'prazo_final_raw',

  // "Data da audiência" = fallback #3 para data_inicio
  'data da audiencia':           'data_audiencia_raw',
  'data audiencia':              'data_audiencia_raw',

  // Publicação / cadastro
  'data de publicacao':          'published_at_raw',
  'data publicacao':             'published_at_raw',
  'publicacao':                  'published_at_raw',
  'data de cadastro':            '_ignored',   // preservado no raw_payload
  'data cadastro':               '_ignored',
  'data conclusao':              '_ignored',
  'data cancelamento':           '_ignored',
  'data distribuicao':           '_ignored',

  // ── Hora ────────────────────────────────────────────────────────────────────
  'hora de inicio':              'hora_inicio_raw',
  'hora inicio':                 'hora_inicio_raw',
  'hora':                        'hora_inicio_raw',
  'horario':                     'hora_inicio_raw',
  'hora fim':                    '_ignored',   // hora de término, não usada
  'hora termino':                '_ignored',

  // ── Status ──────────────────────────────────────────────────────────────────
  'status':                      'status_raw',
  'situacao':                    'status_raw',
}

/**
 * Constrói o mapeamento { "Cabeçalho Original CSV": "campo_interno" }
 * comparando os cabeçalhos normalizados com a tabela acima.
 */
export function buildColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  // LOG TEMPORÁRIO — remover após validação do EasyJur
  console.log('[normalizer] headers brutos:', headers)
  console.log('[normalizer] headers normalizados:', headers.map(h => `"${h}" → "${normalizeKey(h)}"`))

  for (const h of headers) {
    const normalized = normalizeKey(h)
    const internal   = EASYJUR_HEADER_MAP[normalized]
    if (internal && internal !== '_ignored') {
      mapping[h] = internal
    }
  }

  console.log('[normalizer] columnMapping final:', mapping)
  return mapping
}

// ─── Helpers de conversão ─────────────────────────────────────────────────────

/**
 * Parseia data no formato brasileiro dd/mm/yyyy → yyyy-mm-dd (ISO).
 * Aceita também dd-mm-yyyy e variações com 2 dígitos no ano.
 * Retorna null se a entrada for inválida ou vazia.
 */
export function parseDateBR(s: string): string | null {
  if (!s?.trim()) return null

  const clean = s.trim()

  // ISO: YYYY-MM-DD (com ou sem hora)
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const year = parseInt(iso[1], 10)
    const month = parseInt(iso[2], 10)
    const day = parseInt(iso[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900)
      return `${iso[1]}-${iso[2]}-${iso[3]}`
    return null
  }

  // Brasileiro / europeu: DD/MM/YYYY ou DD-MM-YYYY (com hora opcional)
  const match = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!match) return null

  let [, d, m, y] = match
  if (y.length === 2) y = parseInt(y, 10) < 50 ? `20${y}` : `19${y}`

  const day   = parseInt(d, 10)
  const month = parseInt(m, 10)
  const year  = parseInt(y, 10)

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parseia horário no formato HH:mm, HH:mm:ss, HH.mm ou HHhMM → HH:mm.
 * Retorna null se inválido ou vazio.
 */
export function parseTime(s: string): string | null {
  if (!s?.trim()) return null

  const v = s.trim()
  // Aceita HH:mm:ss, HH:mm, HH.mm, HHhMM
  const match = v.match(/^(\d{1,2})[h:.\s](\d{2})(?:[:\.]?\d{2})?/)
  if (!match) return null

  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)

  if (h > 23 || m > 59) return null

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Mapeamento de valores ────────────────────────────────────────────────────

/** Mapeia tipo do EasyJur → tipo interno da agenda */
const TIPO_MAP: Record<string, 'tarefa' | 'evento' | 'prazo' | 'audiencia'> = {
  'audiencia':          'audiencia',
  'audiencia de conciliacao': 'audiencia',
  'audiencia de instrucao':   'audiencia',
  'audiencia preliminar':     'audiencia',
  'prazo':              'prazo',
  'prazo processual':   'prazo',
  'prazo fatal':        'prazo',
  'peticao':            'prazo',
  'recurso':            'prazo',
  'tarefa':             'tarefa',
  'diligencia':         'tarefa',
  'providencia':        'tarefa',
  'reuniao':            'evento',
  'evento':             'evento',
  'publicacao':         'evento',
}

export function normalizeEventType(raw: string): 'tarefa' | 'evento' | 'prazo' | 'audiencia' {
  if (!raw?.trim()) return 'evento'
  const key = normalizeKey(raw)
  return TIPO_MAP[key] ?? 'evento'
}

/** Mapeia status do EasyJur → status interno da agenda */
const STATUS_MAP: Record<string, 'pendente' | 'concluido' | 'cancelado'> = {
  'concluido':    'concluido',
  'realizado':    'concluido',
  'resolvido':    'concluido',
  'feito':        'concluido',
  'executado':    'concluido',
  'cancelado':    'cancelado',
  'arquivado':    'cancelado',
  'desativado':   'cancelado',
  'cancelada':    'cancelado',
  'pendente':     'pendente',
  'aberto':       'pendente',
  'aberta':       'pendente',
  'em andamento': 'pendente',
  'ativo':        'pendente',
  'ativa':        'pendente',
}

export function normalizeStatus(raw: string): 'pendente' | 'concluido' | 'cancelado' {
  if (!raw?.trim()) return 'pendente'
  const key = normalizeKey(raw)
  return STATUS_MAP[key] ?? 'pendente'
}

// ─── Construção de título ─────────────────────────────────────────────────────

/**
 * Gera título automático do evento conforme regras do spec:
 *   - Audiência: "Audiência - [cliente|parte] - [processo]"
 *   - Prazo:     "Prazo - [cliente|parte] - [processo]"
 *   - Outros:    tipo + processo ou nome principal
 */
function buildTitle(
  tipo:           'tarefa' | 'evento' | 'prazo' | 'audiencia',
  clientName:     string | null,
  opposingParty:  string | null,
  processNumber:  string | null,
  rawTipo:        string,
  rawDesc:        string,
): string {
  const mainName = clientName ?? opposingParty

  if (tipo === 'audiencia' || tipo === 'prazo') {
    const label = tipo === 'audiencia' ? 'Audiência' : 'Prazo'
    const parts = [label, mainName, processNumber].filter(Boolean)
    return parts.join(' - ')
  }

  // Tarefa / Evento
  if (mainName && processNumber) return `${mainName} - ${processNumber}`
  if (processNumber) return processNumber
  if (mainName) return mainName
  if (rawTipo) return `${rawTipo}${processNumber ? ` — ${processNumber}` : ''}`
  return clean(rawDesc) ?? 'Evento importado do EasyJur'
}

// ─── Normalização de linha ────────────────────────────────────────────────────

function clean(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  return t || null
}

/**
 * Retorna o valor bruto da primeira coluna CSV que mapeia para `internalField`
 * e que tenha conteúdo não-vazio.
 *
 * Uso correto de columnMapping = { csvHeader → internalField }:
 *   - itera as CHAVES (headers do CSV)
 *   - verifica se o VALOR é o campo interno buscado
 *   - retorna raw[csvHeader] do primeiro que tiver valor
 *
 * Isso evita o bug de `find()` retornar o primeiro match independente de estar
 * vazio — quando múltiplos headers mapeiam para o mesmo campo interno.
 */
function getMappedValue(
  raw: RawCsvRow,
  columnMapping: Record<string, string>,
  internalField: string,
): string {
  for (const csvHeader of Object.keys(columnMapping)) {
    if (columnMapping[csvHeader] === internalField) {
      const val = (raw[csvHeader] ?? '').trim()
      if (val) return val
    }
  }
  return ''
}

/**
 * Converte uma linha bruta do CSV em uma NormalizedAgendaRow.
 *
 * @param raw           - Objeto com os valores originais (chave = header do CSV)
 * @param columnMapping - Mapa { "Header Original": "campo_interno" }
 * @returns             - { row, error } onde error é null se válido
 */
export function normalizeRow(
  raw: RawCsvRow,
  columnMapping: Record<string, string>,
): { row: NormalizedAgendaRow; error: string | null } {
  // Alias local com nome explícito para evitar confusão de direção:
  // getMappedValue(raw, columnMapping, 'campo_interno') → raw[csvHeader]
  const get = (internalField: string) => getMappedValue(raw, columnMapping, internalField)

  // ── Datas ───────────────────────────────────────────────────────────────────
  // Lê cada candidata de forma independente (getMappedValue retorna '' se não encontrar)
  const _dataInicioRaw = get('data_inicio_raw')    // "Data interna"  — prioridade #1
  const _dataFatalRaw  = get('data_fatal_raw')     // "Data fatal"    — fallback   #2
  const _dataAudRaw    = get('data_audiencia_raw') // "Data audiência"— fallback   #3

  // Prioridade: data_inicio_raw → data_fatal_raw → data_audiencia_raw
  const data_inicio =
    parseDateBR(_dataInicioRaw) ??
    parseDateBR(_dataFatalRaw)  ??
    parseDateBR(_dataAudRaw)    ??
    null

  // prazo_final vem sempre de data_fatal_raw (campo independente)
  const prazo_final  = parseDateBR(_dataFatalRaw) ?? parseDateBR(get('prazo_final_raw'))
  const hora_inicio  = parseTime(get('hora_inicio_raw'))
  const pubDateStr   = parseDateBR(get('published_at_raw'))
  const published_at = pubDateStr ? `${pubDateStr}T00:00:00Z` : null

  // LOG TEMPORÁRIO — diagnóstico linha a linha
  console.log('[DEBUG normalizeRow]', {
    source_event_id:   get('source_event_id'),
    data_inicio_raw:   _dataInicioRaw,
    data_fatal_raw:    _dataFatalRaw,
    data_audiencia_raw: _dataAudRaw,
    data_inicio,
    prazo_final,
    hora_inicio,
  })

  // Data do evento é obrigatória
  if (!data_inicio) {
    // LOG TEMPORÁRIO — remover após validação do EasyJur
    console.warn('[normalizer] data_inicio vazia', {
      data_inicio_raw:  _dataInicioRaw || '(vazio)',
      data_fatal_raw:   _dataFatalRaw  || '(vazio)',
      data_audiencia_raw: _dataAudRaw  || '(vazio)',
    })
    return {
      row: buildFallbackRow(raw),
      error: `Data do evento inválida ou ausente: data_inicio_raw="${_dataInicioRaw || '(vazio)'}" data_fatal_raw="${_dataFatalRaw || '(vazio)'}"`,
    }
  }

  // ── Campos de texto ─────────────────────────────────────────────────────────
  const rawSourceId      = get('source_event_id')
  const rawTipo          = get('tipo_raw')
  const rawTitulo        = get('titulo_raw')
  const rawDesc          = get('descricao')
  const rawResolucao     = get('resolucao_raw')
  const rawProcess       = get('process_number')
  const rawClientName    = get('client_name')
  const rawOpposingParty = get('opposing_party_name')
  const rawResponsavel   = get('responsible_name')
  const rawStatus        = get('status_raw')
  const rawCourt         = get('court')
  const rawCounty        = get('county')
  const rawSubtype       = get('subtype')

  const tipo = normalizeEventType(rawTipo)

  // Título: preferir campo explícito; senão montar conforme regra por tipo
  const titulo =
    clean(rawTitulo) ??
    buildTitle(tipo, clean(rawClientName), clean(rawOpposingParty), clean(rawProcess), rawTipo, rawDesc)

  // Descrição: juntar descrição + resolução se ambas existirem
  const descParts = [clean(rawDesc), rawResolucao ? `Resolução: ${rawResolucao}` : null]
    .filter(Boolean)
  const descricao = descParts.length > 0 ? descParts.join('\n') : null

  const row: NormalizedAgendaRow = {
    titulo,
    descricao,
    tipo,
    subtype:             clean(rawSubtype),
    status:              normalizeStatus(rawStatus),
    prioridade:          'media',

    data_inicio,
    hora_inicio,
    prazo_final,
    published_at,

    process_number:      clean(rawProcess),
    processo_id:         null,   // resolvido no confirm
    client_name:         clean(rawClientName),
    opposing_party_name: clean(rawOpposingParty),
    cliente_id:          null,
    responsible_name:    clean(rawResponsavel),
    responsible_user_id: null,   // resolvido no confirm

    court:               clean(rawCourt),
    county:              clean(rawCounty),

    source:              'easyjur',
    source_event_id:     clean(rawSourceId),

    raw_payload:         raw,
  }

  return { row, error: null }
}

/** Linha de fallback quando a normalização falha parcialmente */
function buildFallbackRow(raw: RawCsvRow): NormalizedAgendaRow {
  return {
    titulo: 'Linha com erro', descricao: null,
    tipo: 'evento', subtype: null, status: 'pendente', prioridade: 'media',
    data_inicio: '', hora_inicio: null, prazo_final: null, published_at: null,
    process_number: null, processo_id: null,
    client_name: null, opposing_party_name: null, cliente_id: null,
    responsible_name: null, responsible_user_id: null,
    court: null, county: null,
    source: 'easyjur', source_event_id: null,
    raw_payload: raw,
  }
}
