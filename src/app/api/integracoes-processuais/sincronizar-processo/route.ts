import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { contemCampoSensivel, registrarLogIntegracaoProcessual } from '@/lib/integracoes-processuais/audit'
import { getProcessualProvider } from '@/lib/integracoes-processuais/provider'

export const runtime = 'nodejs'

interface SincronizarProcessoBody {
  provider?: string
  numeroCnj?: string
}

export async function POST(request: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  let body: SincronizarProcessoBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  if (contemCampoSensivel(body)) {
    return NextResponse.json(
      { error: 'Nao envie tokens, senhas, certificados, cookies ou segredos para esta API.' },
      { status: 400 },
    )
  }

  const numeroCnj = body.numeroCnj?.trim()
  if (!numeroCnj) {
    return NextResponse.json({ error: 'numeroCnj e obrigatorio' }, { status: 400 })
  }

  const provider = getProcessualProvider(body.provider)
  const supabase = await createClient()
  const iniciadoEm = new Date().toISOString()

  try {
    const resultado = await provider.sincronizarProcesso(numeroCnj)
    const finalizadoEm = new Date().toISOString()

    await registrarLogIntegracaoProcessual(supabase, {
      provider: provider.id,
      tipoOperacao: 'sincronizar_processo',
      status: 'sucesso',
      referencia: numeroCnj,
      mensagem: 'Sincronizacao processual concluida.',
      detalhes: {
        processoEncontrado: Boolean(resultado.processo),
        movimentacoes: resultado.movimentacoes.length,
        publicacoes: resultado.publicacoes.length,
      },
      iniciadoEm,
      finalizadoEm,
      criadoPor: auth.userId,
    })

    return NextResponse.json({ resultado })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar processo'
    const finalizadoEm = new Date().toISOString()

    await registrarLogIntegracaoProcessual(supabase, {
      provider: provider.id,
      tipoOperacao: 'sincronizar_processo',
      status: 'erro',
      referencia: numeroCnj,
      mensagem: message,
      detalhes: { provider: provider.id },
      iniciadoEm,
      finalizadoEm,
      criadoPor: auth.userId,
    })

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
