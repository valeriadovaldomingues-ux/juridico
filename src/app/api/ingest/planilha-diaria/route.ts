import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { gravarCartoes, type ItemEntrada } from '@/lib/ingest/planilha-diaria'

// Entrada dos cartões da Planilha Diária (coleta do DJEN na VPS) no Kanban. Autenticada por segredo compartilhado
// (INGEST_DIARIA_SECRET, só no servidor e na VPS). Sem o segredo configurado, recusa tudo.
export const maxDuration = 60

const hash = (s: string) => createHash('sha256').update(s).digest()

export async function POST(req: Request) {
  const segredo = process.env.INGEST_DIARIA_SECRET
  if (!segredo) return NextResponse.json({ error: 'Entrada não configurada.' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token || !timingSafeEqual(hash(token), hash(segredo))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const corpo = await req.json().catch(() => null) as { itens?: unknown; visivel?: unknown } | null
  if (!corpo || !Array.isArray(corpo.itens) || corpo.itens.length > 200) {
    return NextResponse.json({ error: 'Envie { itens: [...] } com até 200 itens.' }, { status: 400 })
  }

  const r = await gravarCartoes(createServiceClient(), corpo.itens as ItemEntrada[], { visivel: corpo.visivel === true })
  if ('erro' in r) return NextResponse.json({ error: r.erro }, { status: 500 })
  // Só contagens nos logs (sem CNJ nem título).
  console.info('[ingest] planilha-diaria', JSON.stringify({ visivel: corpo.visivel === true, criados: r.criados, duplicados: r.duplicados, revelados: r.revelados, recusados: r.recusados, falhas: r.falhas }))
  return NextResponse.json(r)
}
