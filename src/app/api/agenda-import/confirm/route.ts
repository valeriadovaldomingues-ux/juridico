// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agenda-import/confirm
//
// Re-recebe o arquivo CSV e executa a importação real:
// - upsert em agenda_items (INSERT ou UPDATE conforme dedup)
// - registra agenda_import_jobs + agenda_import_rows
// - retorna relatório final com contagens e linhas com erro
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { confirmImport } from '@/lib/agenda-import/importer'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  // ── Leitura do arquivo ────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Arquivo CSV não enviado' }, { status: 400 })
  }

  const filename = (file as File).name
  if (!filename.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Apenas arquivos .csv são aceitos' }, { status: 400 })
  }

  // ── Decodificação ─────────────────────────────────────────────────────────
  const buffer = await (file as File).arrayBuffer()
  let fileText: string
  try {
    fileText = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    fileText = new TextDecoder('windows-1252').decode(buffer)
  }

  if (!fileText.trim()) {
    return NextResponse.json({ error: 'O arquivo CSV está vazio' }, { status: 400 })
  }

  // ── Importação ────────────────────────────────────────────────────────────
  try {
    const supabase = await createClient()
    const result   = await confirmImport(fileText, filename, auth.userId, supabase)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    console.error('[agenda-import/confirm]', err)
    return NextResponse.json(
      { error: 'Erro durante a importação: ' + (err?.message ?? 'erro desconhecido') },
      { status: 500 },
    )
  }
}
