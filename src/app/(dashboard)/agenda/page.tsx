import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth/guards'
import AgendaPage from './AgendaPage'
import type { UserRole } from '@/types'

const SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.agenda_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  descricao   text,
  tipo        text        NOT NULL DEFAULT 'tarefa'
                          CHECK (tipo IN ('tarefa', 'evento', 'prazo', 'audiencia')),
  status      text        NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  data_inicio date        NOT NULL,
  hora_inicio time,
  data_fim    date,
  hora_fim    time,
  prazo_final date,
  prioridade  text        NOT NULL DEFAULT 'media'
                          CHECK (prioridade IN ('baixa', 'media', 'alta')),
  processo_id uuid        REFERENCES public.processos(id)  ON DELETE SET NULL,
  cliente_id  uuid        REFERENCES public.clientes(id)   ON DELETE SET NULL,
  responsavel text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access"
  ON public.agenda_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agenda_data    ON public.agenda_items(data_inicio);
CREATE INDEX IF NOT EXISTS idx_agenda_tipo    ON public.agenda_items(tipo);
CREATE INDEX IF NOT EXISTS idx_agenda_status  ON public.agenda_items(status);
CREATE INDEX IF NOT EXISTS idx_agenda_proc    ON public.agenda_items(processo_id);
CREATE INDEX IF NOT EXISTS idx_agenda_cliente ON public.agenda_items(cliente_id);`

export default async function AgendaRoute() {
  const supabase = await createClient()
  const session = await getSessionProfile()
  const role = session?.profile.role ?? null
  const userId = session?.userId ?? ''
  const canDelete = session ? ['administrativo', 'advogado', 'gerente', 'socio'].includes(session.profile.role) : false
  const canManageTimeEntries = session ? ['administrativo', 'advogado', 'gerente', 'socio'].includes(session.profile.role) : false
  const canViewTimeReports = session ? ['gerente', 'socio'].includes(session.profile.role) : false

  const [
    { data: items, error: itemsError },
  ] = await Promise.all([
    supabase
      .from('agenda_items')
      .select(`
        *,
        processo:processos(titulo),
        cliente:clientes(nome),
        time_entries:agenda_time_entries(
          *,
          cliente:clientes(id, nome),
          processo:processos(id, titulo, numero_processo),
          criado_por_profile:profiles!criado_por(id, nome)
        )
      `)
      .order('data_inicio', { ascending: true }),
  ])

  if (itemsError) {
    return (
      <div className="internal-page max-w-3xl">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)] mb-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
              Operacional
            </p>
            <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">Agenda Jurídica</h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">Compromissos, prazos e eventos do escritório</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] p-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-gold-light)] border border-[#E7CBA8] flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-copper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)] mb-2">Ative o módulo Agenda</h2>
          <p className="text-[13px] text-[var(--color-ink-2)] leading-relaxed mb-6">
            Execute o SQL abaixo no <strong>SQL Editor</strong> do Supabase Dashboard
            e recarregue esta página.
          </p>
          <pre className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-5 text-[11px] text-[var(--color-ink-2)] overflow-x-auto whitespace-pre font-mono leading-relaxed">
            {SETUP_SQL}
          </pre>
          <p className="text-[12px] text-[var(--color-ink-3)] mt-4">
            Após executar, recarregue a página. O módulo estará disponível.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="internal-page">
      <AgendaPage
        initialItems={items ?? []}
        currentUserId={userId}
        currentUserRole={(role ?? 'cliente') as UserRole}
        canDelete={canDelete}
        canManageTimeEntries={canManageTimeEntries}
        canViewTimeReports={canViewTimeReports}
      />
    </div>
  )
}
