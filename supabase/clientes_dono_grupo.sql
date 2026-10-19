-- 15/10/2026 (pedido da Valéria): "Dono / grupo" no cadastro do cliente. Aplicada em produção.
alter table public.clientes add column if not exists dono_id uuid references public.clientes(id) on delete set null;
alter table public.clientes drop constraint if exists clientes_dono_nao_e_ele_mesmo;
alter table public.clientes add constraint clientes_dono_nao_e_ele_mesmo check (dono_id is null or dono_id <> id);
create index if not exists clientes_dono_id_idx on public.clientes (dono_id) where dono_id is not null;
-- Primeiro grupo: Josias é o dono da RF Rezende e da VS Móveis.
update public.clientes set dono_id = (select id from public.clientes where nome = 'JOSIAS AUGUSTO DA SILVA' limit 1)
where replace(replace(replace(coalesce(cpf_cnpj,''),'.',''),'/',''),'-','') in ('47854165000194', '48221728000170') and dono_id is null;
