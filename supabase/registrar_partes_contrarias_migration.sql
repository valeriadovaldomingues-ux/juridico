-- registrar_partes_contrarias(pares jsonb): cadastra a parte contrária (tipo 'reu') nos processos
-- que ainda não têm uma. Recebe [{processo_id, nome}]; cria a pessoa (nome padronizado) se não
-- existir e liga ao processo. Idempotente; nunca altera processo que já tem parte contrária.
-- Usada pela importação da agenda do EasyJur. Aplicada em produção em 08/10/2026
-- (migration registrar_partes_contrarias); a mesma função preencheu 157 processos já importados.
create or replace function public.registrar_partes_contrarias(pares jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  qtd integer;
begin
  with entrada as (
    select distinct
      (e->>'processo_id')::uuid as pid,
      initcap(lower(btrim(e->>'nome'))) as nome
    from jsonb_array_elements(pares) e
    where btrim(coalesce(e->>'nome', '')) not in ('', '-')
      and (e->>'processo_id') is not null
  ),
  alvo as (
    select en.pid, en.nome
    from entrada en
    where not exists (
      select 1 from partes_processo pp where pp.processo_id = en.pid and pp.tipo_parte = 'reu'
    )
  ),
  novas as (
    insert into pessoas (nome)
    select distinct nome from alvo
    on conflict ((lower(btrim(nome)))) do nothing
    returning id, nome
  ),
  todas as (
    select id, nome from novas
    union all
    select id, nome from pessoas
  )
  insert into partes_processo (processo_id, pessoa_id, pessoa_nome, tipo_parte)
  select a.pid, t.id, t.nome, 'reu'
  from alvo a
  join todas t on lower(btrim(t.nome)) = lower(btrim(a.nome))
  on conflict (processo_id, pessoa_id) where pessoa_id is not null do nothing;

  get diagnostics qtd = row_count;
  return qtd;
end;
$$;

revoke all on function public.registrar_partes_contrarias(jsonb) from public, anon;
grant execute on function public.registrar_partes_contrarias(jsonb) to authenticated;
