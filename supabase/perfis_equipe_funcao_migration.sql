-- Lista da equipe (só id, nome, cor e cargo) para quem não é sócio/gerente.
-- A tabela profiles só deixa cada pessoa ver o próprio perfil (e-mail, nascimento etc.), então o
-- Kanban mostrava só a própria coluna para advogados/estagiários. Esta função expõe apenas o
-- necessário e nunca para clientes do portal.
-- Aplicada em produção em 08/10/2026 (migration perfis_equipe_funcao).
create or replace function public.perfis_equipe()
returns table (id uuid, nome text, cor_kanban text, role text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.nome, p.cor_kanban, p.role
  from profiles p
  where p.ativo
    and p.role <> 'cliente'
    and coalesce(public.current_user_role(), 'cliente') <> 'cliente'
$$;

revoke all on function public.perfis_equipe() from public, anon;
grant execute on function public.perfis_equipe() to authenticated;
