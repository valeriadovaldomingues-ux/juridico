import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import PublicacoesPage from './PublicacoesPage'

const SETUP_SQL = `supabase/publicacoes_migration.sql`

export default async function PublicacoesRoute() {
  // comercial e administrativo não acessam publicações jurídicas
  await requireRole(['estagiario', 'advogado', 'gerente', 'socio'])
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
      <div className="internal-page max-w-3xl">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)] mb-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
              Inteligência processual
            </p>
            <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">Publicações</h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">Publicações, intimações e prazos do escritório</p>
          </div>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] p-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-gold-light)] border border-[#E7CBA8] flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-copper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)] mb-2">Ative o módulo de Publicações</h2>
          <p className="text-[13px] text-[var(--color-ink-2)] leading-relaxed mb-4">
            Execute os arquivos SQL no <strong>SQL Editor</strong> do Supabase, nesta ordem:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[13px] text-[var(--color-ink-2)] mb-6">
            <li><code className="font-mono text-[12px] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">supabase/monitoramento_migration.sql</code></li>
            <li><code className="font-mono text-[12px] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">supabase/publicacoes_migration.sql</code></li>
          </ol>
          <p className="text-[12px] text-[var(--color-ink-3)]">Após executar, recarregue a página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="internal-page">
      <PublicacoesPage
        initialPublicacoes={publicacoes ?? []}
        processos={processos ?? []}
        advogados={advogados ?? []}
      />
    </div>
  )
}
