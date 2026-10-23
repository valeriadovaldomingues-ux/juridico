-- Busca de clientes sem acento/ç, palavras em qualquer ordem; o que começa com o texto vem primeiro.
-- (A de processos já usa processos_ids_busca + sem_acento.) Aplicada em produção em 09/10/2026.
drop function if exists public.clientes_ids_busca(text, int, text);
create or replace function public.clientes_ids_busca(q text, lim int default 20, tipo text default null, inativos boolean default false)
returns setof uuid
language sql
stable
set search_path to 'public'
as $$
  with t as (
    select public.sem_acento(trim(q)) as txt,
           array_remove(string_to_array(public.sem_acento(trim(q)), ' '), '') as toks
  ),
  c as (
    select cl.id, cl.nome,
           public.sem_acento(cl.nome) as n,
           public.sem_acento(coalesce(cl.nome_fantasia, '')) as f,
           public.sem_acento(coalesce(cl.socio_representante, '')) as s
    from clientes cl
    where (inativos or cl.ativo = true) and (tipo is null or cl.tipo_contato = tipo)
  )
  select c.id
  from c, t
  where t.txt <> ''
    and (
      select bool_and(strpos(c.n || ' ' || c.f || ' ' || c.s, tok) > 0) from unnest(t.toks) as tok
    )
  order by
    case when c.n like t.txt || '%' then 0
         when strpos(c.n, t.txt) > 0 then 1
         when c.f like t.txt || '%' then 2
         else 3 end,
    c.nome
  limit greatest(lim, 1)
$$;
grant execute on function public.clientes_ids_busca(text, int, text, boolean) to authenticated;
