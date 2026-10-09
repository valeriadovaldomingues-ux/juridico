import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { completarJSON } from '@/lib/ai/service'
import { normalizarExtracaoAta, promptSistemaAta } from '@/lib/atas/extrair-ata'

const MAX_ATA = 30_000
const ISO = /^\d{4}-\d{2}-\d{2}$/

// POST { texto, data_audiencia } → o que a IA separou da ata (nada é gravado aqui: a pessoa revisa antes).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const texto = String(body?.texto ?? '').trim()
  const dataAudiencia = String(body?.data_audiencia ?? '')
  if (!ISO.test(dataAudiencia)) return NextResponse.json({ error: 'Informe a data da audiência.' }, { status: 400 })
  if (texto.length < 30) return NextResponse.json({ error: 'Cole ou envie a ata da audiência.' }, { status: 400 })
  if (texto.length > MAX_ATA) return NextResponse.json({ error: 'A ata é grande demais (máx. 30 mil caracteres).' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase.rpc('perfis_equipe')
  const equipe = ((data ?? []) as { id: string; nome: string }[]).map(p => ({ id: p.id, nome: p.nome }))

  try {
    const resposta = await completarJSON(
      [
        { role: 'system', content: promptSistemaAta(equipe, dataAudiencia) },
        { role: 'user', content: `ATA DA AUDIÊNCIA:\n\n${texto}` },
      ],
      { temperature: 0.1 },
    )
    return NextResponse.json({ ...normalizarExtracaoAta(resposta, equipe), equipe })
  } catch (err) {
    console.error('[atas/extrair]', err)
    return NextResponse.json({ error: 'A IA não conseguiu ler a ata agora. Tente de novo ou preencha as providências manualmente.' }, { status: 502 })
  }
}
