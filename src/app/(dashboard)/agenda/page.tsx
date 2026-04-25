import { createClient } from '@/lib/supabase/server'
import AgendaPage from './AgendaPage'

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

  const [
    { data: items, error: itemsError },
    { data: processos },
    { data: clientes },
  ] = await Promise.all([
    supabase
      .from('agenda_items')
      .select('*, processo:processos(titulo), cliente:clientes(nome)')
      .order('data_inicio', { ascending: true }),
    supabase.from('processos').select('id, titulo').order('titulo'),
    supabase.from('clientes').select('id, nome').order('nome'),
  ])

  if (itemsError) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Agenda Jurídica</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Compromissos, prazos e eventos do escritório</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b8903a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[#0f1923] mb-2">Ative o módulo Agenda</h2>
          <p className="text-[13px] text-[#7a8899] leading-relaxed mb-6">
            Execute o SQL abaixo no <strong>SQL Editor</strong> do Supabase Dashboard
            e recarregue esta página.
          </p>
          <pre className="bg-[#F7F9F9] border border-[#E8F0F0] rounded-xl p-5 text-[11px] text-[#4a5a6a] overflow-x-auto whitespace-pre font-mono leading-relaxed">
            {SETUP_SQL}
          </pre>
          <p className="text-[12px] text-[#9aabb8] mt-4">
            Após executar, recarregue a página. O módulo estará disponível.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AgendaPage
      initialItems={items ?? []}
      processos={processos ?? []}
      clientes={clientes ?? []}
    />
  )
}
