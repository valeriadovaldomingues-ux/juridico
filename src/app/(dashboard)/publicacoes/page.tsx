import { createClient } from '@/lib/supabase/server'
import PublicacoesPage from './PublicacoesPage'

const SETUP_SQL = `supabase/publicacoes_migration.sql`

export default async function PublicacoesRoute() {
  const supabase = await createClient()

  const [
    { data: publicacoes, error },
    { data: processos },
    { data: advogados },
  ] = await Promise.all([
    supabase
      .from('publicacoes')
      .select('*, processo:processos(id, titulo, numero_processo)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('processos').select('id, titulo, numero_processo').order('titulo'),
    supabase.from('advogados_monitorados').select('id, nome_completo, oab_numero, oab_uf').eq('ativo', true).order('nome_completo'),
  ])

  if (error) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Publicações</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Publicações, intimações e prazos do escritório</p>
        </div>
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm p-8">
          <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b8903a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[#0f1923] mb-2">Ative o módulo de Publicações</h2>
          <p className="text-[13px] text-[#7a8899] leading-relaxed mb-4">
            Execute os arquivos SQL no <strong>SQL Editor</strong> do Supabase, nesta ordem:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[13px] text-[#4a5a6a] mb-6">
            <li><code className="font-mono text-[12px] bg-[#F3F1EE] px-1.5 py-0.5 rounded">supabase/monitoramento_migration.sql</code></li>
            <li><code className="font-mono text-[12px] bg-[#F3F1EE] px-1.5 py-0.5 rounded">supabase/publicacoes_migration.sql</code></li>
          </ol>
          <p className="text-[12px] text-[#9aabb8]">Após executar, recarregue a página.</p>
        </div>
      </div>
    )
  }

  return (
    <PublicacoesPage
      initialPublicacoes={publicacoes ?? []}
      processos={processos ?? []}
      advogados={advogados ?? []}
    />
  )
}
