// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/csv-parser.ts
//
// Parser CSV robusto usando PapaParse com header:true.
// Suporta: separadores vírgula e ponto-e-vírgula, campos entre aspas com
// vírgulas/quebras de linha internas, encodings UTF-8 e Windows-1252.
// ─────────────────────────────────────────────────────────────────────────────

import Papa from 'papaparse'
import type { RawCsvRow } from '@/types/agenda-import'

// ─── Interface pública ────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers:       string[]    // nomes dos cabeçalhos (após limpeza)
  objects:       RawCsvRow[] // linhas como objetos { header: valor }
  separator:     ',' | ';'
  totalDataRows: number
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Parseia texto CSV usando PapaParse com header:true.
 *
 * - Auto-detecta delimitador (, ou ;)
 * - Respeita campos entre aspas com separadores ou quebras de linha internas
 * - Remove BOM antes de parsear
 * - Loga headers e primeira linha no console (dev/staging)
 */
export function parseCsv(raw: string): ParsedCsv {
  // Remove apenas o BOM; deixar PapaParse normalizar o resto
  const text = raw.replace(/^\uFEFF/, '')

  if (!text.trim()) {
    return { headers: [], objects: [], separator: ';', totalDataRows: 0 }
  }

  const result = Papa.parse<RawCsvRow>(text, {
    header:         true,    // retorna objetos { header: valor }
    skipEmptyLines: true,
    delimiter:      '',      // '' = auto-detect (PapaParse escolhe , ou ;)
    quoteChar:      '"',
    escapeChar:     '"',
    dynamicTyping:  false,   // tudo como string
    // Limpa cada cabeçalho: remove aspas residuais e espaços
    transformHeader: (h: string) => h.trim().replace(/^"|"$/g, '').trim(),
  })

  if (result.errors.length > 0) {
    // PapaParse recupera erros por linha — registrar mas não abortar
    console.warn('[csv-parser] avisos PapaParse:', result.errors.slice(0, 5))
  }

  const headers = (result.meta.fields ?? []) as string[]
  const objects = (result.data ?? []) as RawCsvRow[]
  const sep     = result.meta.delimiter === ';' ? ';' : ','

  // ── Debug ────────────────────────────────────────────────────────────────────
  console.log('[csv-parser] delimitador detectado:', JSON.stringify(result.meta.delimiter))
  console.log('[csv-parser] headers:', headers)
  if (objects.length > 0) {
    console.log('[csv-parser] primeira linha parseada:', JSON.stringify(objects[0], null, 2))
  }

  return { headers, objects, separator: sep, totalDataRows: objects.length }
}

/**
 * Tenta decodificar um ArrayBuffer como UTF-8; se falhar, usa Windows-1252.
 */
export function decodeFileBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}
