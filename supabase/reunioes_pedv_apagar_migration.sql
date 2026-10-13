-- 13/10/2026: a sócia pode apagar uma ata de reunião (lixeirinha). Continua valendo a regra de que
-- ata não se edita; apagar só pela função abaixo (só sócio) e fica registrado quem apagou.
create table if not exists public.reunioes_pedv_apagadas (
  id            uuid primary key,
  titulo        text not null,
  data_reuniao  date not null,
  tinha_arquivo boolean not null default false,
  apagado_por   uuid references public.profiles(id) on delete set null,
  apagado_em    timestamptz not null default now()
);
alter table public.reunioes_pedv_apagadas enable row level security;
create policy reunioes_pedv_apagadas_select_socio on public.reunioes_pedv_apagadas
  for select to authenticated using (public.current_user_role() = 'socio');

create or replace function public.reunioes_pedv_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.apagar_ata', true), '') = 'on' then
      return old;
    end if;
    raise exception 'Atas de reunião não podem ser apagadas.';
  end if;
  if (new.id, new.titulo, new.data_reuniao, new.participantes, new.ata, new.created_at, new.arquivo_path, new.arquivo_nome)
     is distinct from
     (old.id, old.titulo, old.data_reuniao, old.participantes, old.ata, old.created_at, old.arquivo_path, old.arquivo_nome) then
    raise exception 'Atas de reunião não podem ser alteradas depois de salvas.';
  end if;
  return new;
end;
$$;

-- Devolve o caminho do arquivo guardado (para a API apagar do armazenamento) ou null.
create or replace function public.apagar_reuniao_pedv(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reunioes_pedv%rowtype;
begin
  if public.current_user_role() is distinct from 'socio' then
    raise exception 'Só sócio pode apagar ata de reunião.';
  end if;
  select * into r from public.reunioes_pedv where id = p_id;
  if not found then
    raise exception 'Ata não encontrada.';
  end if;
  insert into public.reunioes_pedv_apagadas (id, titulo, data_reuniao, tinha_arquivo, apagado_por)
    values (r.id, r.titulo, r.data_reuniao, r.arquivo_path is not null, auth.uid());
  perform set_config('app.apagar_ata', 'on', true);
  delete from public.reunioes_pedv where id = p_id;
  return r.arquivo_path;
end;
$$;
revoke all on function public.apagar_reuniao_pedv(uuid) from public, anon;
grant execute on function public.apagar_reuniao_pedv(uuid) to authenticated;
