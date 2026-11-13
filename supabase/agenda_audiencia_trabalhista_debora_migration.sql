-- Audiência trabalhista: a Débora Brito entra sempre como segunda responsável (pedido da Valéria, 12/11/2026).
-- Vale para qualquer caminho que grave a agenda (tela, conector do Claude/ChatGPT, importação), por isso fica no banco.
-- Regra: só quando a audiência está ligada a um processo da área "trabalhista", tem UM responsável e ele não é a Débora.
-- Quem já tem dois responsáveis, ou a Débora sozinha, não é alterado. Reversível: drop trigger + drop function.
create or replace function public.agenda_audiencia_trabalhista_debora()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  area text;
begin
  if new.tipo = 'audiencia'
     and new.processo_id is not null
     and btrim(coalesce(new.responsavel, '')) <> ''
     and position(' / ' in new.responsavel) = 0
     and new.responsavel !~* 'd[eé]bora' then
    select area_direito into area from processos where id = new.processo_id;
    if area = 'trabalhista' then
      new.responsavel := btrim(new.responsavel) || ' / Débora Brito';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agenda_audiencia_trabalhista_debora on public.agenda_items;
create trigger trg_agenda_audiencia_trabalhista_debora
  before insert or update of responsavel, processo_id, tipo on public.agenda_items
  for each row execute function public.agenda_audiencia_trabalhista_debora();
