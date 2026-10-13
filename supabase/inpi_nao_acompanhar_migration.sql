-- 13/10/2026 (pedido da Valéria): marcador "não acompanhar" nos processos INPI.
-- Fica fora dos alertas de decênio e da leitura automática da RPI, mas o registro e o decênio continuam guardados.
alter table public.inpi_processos
  add column if not exists nao_acompanhar boolean not null default false,
  add column if not exists nao_acompanhar_motivo text,
  add column if not exists nao_acompanhar_em timestamptz;

-- Meu Buffet (840768451): cliente não vai renovar o decênio.
update public.inpi_processos
   set nao_acompanhar = true,
       nao_acompanhar_motivo = 'Cliente não vai renovar o decênio (achou o valor caro).',
       nao_acompanhar_em = now()
 where numero_processo = '840768451';
