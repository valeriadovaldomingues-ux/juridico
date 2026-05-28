import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { listarProvidersProcessuais } from '@/lib/integracoes-processuais/provider'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('integracoes_processuais_configuracoes')
    .select('provider, ativo, nome_exibicao, configuracoes_publicas, atualizado_em')
    .order('provider', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const configs = new Map((data ?? []).map(config => [config.provider, config]))
  const providers = listarProvidersProcessuais().map(provider => {
    const config = configs.get(provider.id)
    return {
      ...provider,
      ativo: config?.ativo ?? provider.ativo,
      nome: config?.nome_exibicao ?? provider.nome,
      configuracoesPublicas: config?.configuracoes_publicas ?? {},
      atualizadoEm: config?.atualizado_em ?? null,
    }
  })

  return NextResponse.json({ providers })
}
