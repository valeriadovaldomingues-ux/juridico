-- Busca geral de processos: título, número, nome do cliente (razão social, fantasia,
-- sócio representante), nome das partes, e CPF/CNPJ (do cliente e das partes) — com ou
-- sem pontuação, sem diferenciar acento/maiúscula. Retorna só os ids (máx. 300).
-- Aplicada em produção em 08/10/2026 (migration processos_busca_geral).

create or replace function public.sem_acento(t text)
returns text language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn')
$$;

create or replace function public.processos_ids_busca(q text)
returns setof uuid
language sql stable security invoker
set search_path = public
as $$
  with t as (
    select
      public.sem_acento(trim(q)) as txt,
      regexp_replace(coalesce(q, ''), '\D', '', 'g') as dig
  ),
  achados as (
    select p.id
    from processos p, t
    where t.txt <> '' and (
         strpos(public.sem_acento(p.titulo), t.txt) > 0
      or strpos(public.sem_acento(p.numero_processo), t.txt) > 0
      or (length(t.dig) >= 4 and strpos(regexp_replace(coalesce(p.numero_processo, ''), '\D', '', 'g'), t.dig) > 0)
    )
    union
    select p.id
    from processos p
    join clientes c on c.id = p.cliente_id, t
    where t.txt <> '' and (
         strpos(public.sem_acento(c.nome), t.txt) > 0
      or strpos(public.sem_acento(c.nome_fantasia), t.txt) > 0
      or strpos(public.sem_acento(c.socio_representante), t.txt) > 0
      or (length(t.dig) >= 4 and strpos(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g'), t.dig) > 0)
    )
    union
    select pp.processo_id
    from partes_processo pp, t
    where t.txt <> '' and pp.processo_id is not null and (
         strpos(public.sem_acento(pp.pessoa_nome), t.txt) > 0
      or (length(t.dig) >= 4 and strpos(regexp_replace(coalesce(pp.documento, ''), '\D', '', 'g'), t.dig) > 0)
    )
  )
  select id from achados limit 300
$$;

grant execute on function public.sem_acento(text) to authenticated;
grant execute on function public.processos_ids_busca(text) to authenticated;
