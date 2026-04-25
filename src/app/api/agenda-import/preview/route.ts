// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agenda-import/preview
//
// Recebe um arquivo CSV via multipart/form-data, parseia e classifica
// cada linha (new / update / duplicate / error) SEM gravar no banco.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { previewImport } from '@/lib/agenda-import/importer'
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

  // ── Validação de tipo ─────────────────────────────────────────────────────
  const filename = (file as File).name
  if (!filename.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Apenas arquivos .csv são aceitos' }, { status: 400 })
  }

  // ── Decodificação ─────────────────────────────────────────────────────────
  // Tenta UTF-8; se falhar, cai em windows-1252 (common em exportações EasyJur)
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

  // ── Preview ───────────────────────────────────────────────────────────────
  try {
    const supabase = await createClient()
    const result   = await previewImport(fileText, filename, supabase)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[agenda-import/preview]', err)
    return NextResponse.json(
      { error: 'Erro ao processar o arquivo: ' + (err?.message ?? 'erro desconhecido') },
      { status: 500 },
    )
  }
}
