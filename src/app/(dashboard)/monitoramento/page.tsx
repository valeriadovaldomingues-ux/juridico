import { createClient } from '@/lib/supabase/server'
import MonitoramentoPage from './MonitoramentoPage'

export default async function MonitoramentoRoute() {
  const supabase = await createClient()

  const [
    { data: advogados,   error: advError },
    { data: publicacoes, error: pubError },
    { data: logs },
  ] = await Promise.all([
    supabase
      .from('advogados_monitorados')
      .select('*')
      .order('nome_completo'),
    supabase
      .from('publicacoes_monitoradas')
      .select('*, advogado:advogados_monitorados(id,nome_completo,oab_numero,oab_uf)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('monitoramento_logs')
      .select('*')
      .order('executado_em', { ascending: false })
      .limit(10),
  ])

  // Show setup screen if tables don't exist yet
  if (advError || pubError) {
    const missingTable = advError ? 'advogados_monitorados' : 'publicacoes_monitoradas'
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Monitoramento</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Busca automática de publicações e prazos</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b8903a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[#0f1923] mb-2">Ative o módulo de Monitoramento</h2>
          <p className="text-[13px] text-[#7a8899] leading-relaxed mb-2">
            Tabela <code className="font-mono text-[12px] bg-[#F7F9F9] px-1.5 py-0.5 rounded">{missingTable}</code> não encontrada.
            Execute os arquivos SQL no <strong>SQL Editor</strong> do Supabase, nesta ordem:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[13px] text-[#4a5a6a] mb-4">
            <li><code className="font-mono text-[12px] bg-[#F7F9F9] px-1.5 py-0.5 rounded">supabase/monitoramento_migration.sql</code></li>
          </ol>
          <p className="text-[12px] text-[#9aabb8]">Após executar, recarregue a página.</p>
        </div>
      </div>
    )
  }

  return (
    <MonitoramentoPage
      advogados={advogados ?? []}
      publicacoes={(publicacoes as any[]) ?? []}
      logs={(logs as any[]) ?? []}
    />
  )
}
