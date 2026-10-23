-- 23/10/2026 (pedido da Valéria): prazos e audiências do PEDV vão para o Google Agenda (pedvprazos@gmail.com), mão única.
-- RODAR NO BANCO ANTES de ligar GOOGLE_AGENDA_SYNC_DESDE na Vercel.
alter table public.agenda_items
  add column if not exists google_event_id   text,
  add column if not exists google_hash       text,
  add column if not exists google_synced_at  timestamptz,
  add column if not exists google_sync_erro  text;
create index if not exists agenda_items_google_event_idx on public.agenda_items (google_event_id) where google_event_id is not null;

-- Fila de exclusões: quando um compromisso que está no Google é apagado no PEDV, o gatilho guarda o id do evento para a
-- sincronização apagá-lo lá também.
create table if not exists public.agenda_google_exclusoes (
  id              uuid primary key default gen_random_uuid(),
  google_event_id text not null,
  created_at      timestamptz not null default now()
);
alter table public.agenda_google_exclusoes enable row level security; -- sem políticas: só o serviço (servidor) acessa

create or replace function public.agenda_google_registrar_exclusao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.google_event_id is not null then
    insert into public.agenda_google_exclusoes (google_event_id) values (old.google_event_id);
  end if;
  return old;
end $$;

drop trigger if exists agenda_items_google_exclusao on public.agenda_items;
create trigger agenda_items_google_exclusao after delete on public.agenda_items
  for each row execute function public.agenda_google_registrar_exclusao();
