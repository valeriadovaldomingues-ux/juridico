import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { completarJSON } from '@/lib/ai/service'
import { mensagemFalhaIA } from '@/lib/ai/erros'
import { normalizarTarefasIA, promptSistemaExtracao } from '@/lib/reunioes/extrair-tarefas'

const MAX_ATA = 30_000

// POST { ata, data_reuniao } → tarefas sugeridas pela IA (nada é gravado aqui: o usuário revisa antes).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const ata = String(body?.ata ?? '').trim()
  const dataReuniao = String(body?.data_reuniao ?? '')
  if (ata.length < 30) return NextResponse.json({ error: 'Cole ou envie a ata da reunião.' }, { status: 400 })
  if (ata.length > MAX_ATA) return NextResponse.json({ error: 'A ata é grande demais (máx. 30 mil caracteres).' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase.rpc('perfis_equipe')
  const equipe = ((data ?? []) as { id: string; nome: string }[]).map(p => ({ id: p.id, nome: p.nome }))

  try {
    const resposta = await completarJSON(
      [
        { role: 'system', content: promptSistemaExtracao(equipe, dataReuniao) },
        { role: 'user', content: `ATA DA REUNIÃO:\n\n${ata}` },
      ],
      { temperature: 0.1 },
    )
    return NextResponse.json({ tarefas: normalizarTarefasIA(resposta, equipe), equipe })
  } catch (err) {
    console.error('[reunioes/extrair]', err)
    return NextResponse.json({ error: mensagemFalhaIA(err, 'A IA não conseguiu ler a ata agora. Tente de novo ou cadastre as tarefas manualmente.') }, { status: 502 })
  }
}
