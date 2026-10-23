import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { CENTRAL_ARQUIVOS_BUCKET } from '@/lib/central-arquivos/types'

// Planilhas do contador guardadas como subsídio do relatório de despesas — SÓ para os sócios.
// GET            → lista os arquivos
// GET ?arquivo=  → baixa (link temporário)
// POST (file)    → guarda uma nova planilha;  DELETE ?arquivo= → remove
const PASTA = 'financeiro/referencia-contador'
const LIMITE = 25 * 1024 * 1024
const EXTENSOES = ['xls', 'xlsx', 'csv', 'pdf']

const nomeSeguro = (n: string) => n.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'planilha'
const nomeAmigavel = (armazenado: string) => armazenado.replace(/^\d{13}__/, '')
const armazenadoValido = (n: string) => /^\d{13}__[a-zA-Z0-9._-]+$/.test(n)

export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const storage = createServiceClient().storage.from(CENTRAL_ARQUIVOS_BUCKET)

  const arquivo = req.nextUrl.searchParams.get('arquivo')
  if (arquivo) {
    if (!armazenadoValido(arquivo)) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
    const { data, error } = await storage.createSignedUrl(`${PASTA}/${arquivo}`, 900, { download: nomeAmigavel(arquivo) })
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    return NextResponse.redirect(new URL(data.signedUrl))
  }

  const { data, error } = await storage.list(PASTA, { limit: 100, sortBy: { column: 'name', order: 'desc' } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const arquivos = (data ?? [])
    .filter(f => armazenadoValido(f.name))
    .map(f => ({ arquivo: f.name, nome: nomeAmigavel(f.name), enviado_em: f.created_at ?? null }))
  return NextResponse.json({ arquivos })
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Escolha um arquivo.' }, { status: 400 })
  if (file.size > LIMITE) return NextResponse.json({ error: 'O arquivo passa de 25 MB.' }, { status: 400 })
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!EXTENSOES.includes(ext)) return NextResponse.json({ error: 'Use uma planilha (xls, xlsx, csv) ou PDF.' }, { status: 400 })

  const armazenado = `${Date.now()}__${nomeSeguro(file.name.replace(/\.[^.]+$/, ''))}.${ext}`
  const { error } = await createServiceClient().storage
    .from(CENTRAL_ARQUIVOS_BUCKET)
    .upload(`${PASTA}/${armazenado}`, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ arquivo: armazenado, nome: nomeAmigavel(armazenado) }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const arquivo = req.nextUrl.searchParams.get('arquivo') ?? ''
  if (!armazenadoValido(arquivo)) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  const { error } = await createServiceClient().storage.from(CENTRAL_ARQUIVOS_BUCKET).remove([`${PASTA}/${arquivo}`])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
