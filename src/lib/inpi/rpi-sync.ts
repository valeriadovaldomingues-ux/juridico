// ─── Sincronização automática com a RPI do INPI ───────────────────────────────
//
// Roda via cron (ver src/app/api/cron/inpi-rpi/route.ts). A cada execução:
//   1. Carrega os processos de marca rastreados (inpi_processos.tipo = 'marca').
//   2. Descobre até onde a RPI já publicou e retoma de onde parou
//      (inpi_sync_state.ultimo_rpi_numero).
//   3. Pra cada edição nova, baixa e faz parse em streaming, casando pelo
//      número do processo, e grava movimentação + atualiza status/data de
//      concessão quando aplicável (IPAS158 = concessão, IPAS161 = extinção).
//
// Decisão de escopo: se ainda não há nenhum processo rastreado, a execução
// avança o ponteiro sem baixar nada (não tem o que casar) — ou seja, não faz
// backfill histórico de movimentações anteriores ao cadastro do processo no
// sistema. O acompanhamento é dali pra frente.

import type { SupabaseClient } from '@supabase/supabase-js'
import { descobrirUltimaEdicaoDisponivel, processarEdicaoRpiMarcas } from './rpi-client'

const MAX_EDICOES_POR_EXECUCAO = 6

export interface ResultadoSincronizacaoRpi {
  ok: boolean
  edicoesProcessadas: number
  movimentacoesInseridas: number
  erro: string | null
}

export async function sincronizarRpi(supabase: SupabaseClient): Promise<ResultadoSincronizacaoRpi> {
  const { data: processos, error: errProcessos } = await supabase
    .from('inpi_processos')
    .select('id, numero_processo')
    .eq('tipo', 'marca')

  if (errProcessos) {
    return { ok: false, edicoesProcessadas: 0, movimentacoesInseridas: 0, erro: errProcessos.message }
  }

  const numeroParaId = new Map((processos ?? []).map(p => [p.numero_processo as string, p.id as string]))
  const numerosRastreados = new Set(numeroParaId.keys())

  const { data: state } = await supabase
    .from('inpi_sync_state')
    .select('ultimo_rpi_numero')
    .eq('id', true)
    .maybeSingle()

  let teto: number
  try {
    teto = await descobrirUltimaEdicaoDisponivel()
  } catch (e) {
    const erro = `Falha ao consultar índice da RPI: ${e instanceof Error ? e.message : String(e)}`
    await supabase.from('inpi_sync_state').update({ ultimo_erro: erro, ultima_execucao: new Date().toISOString() }).eq('id', true)
    return { ok: false, edicoesProcessadas: 0, movimentacoesInseridas: 0, erro }
  }

  let ultimoProcessado = state?.ultimo_rpi_numero ?? (teto - 1)
  let numeroAtual = ultimoProcessado + 1
  let edicoesProcessadas = 0
  let movimentacoesInseridas = 0
  let erro: string | null = null

  while (numeroAtual <= teto && edicoesProcessadas < MAX_EDICOES_POR_EXECUCAO) {
    try {
      if (numerosRastreados.size > 0) {
        const edicao = await processarEdicaoRpiMarcas(numeroAtual, numerosRastreados)

        for (const [numeroProcesso, despachos] of edicao.movimentacoesPorProcesso) {
          const processoId = numeroParaId.get(numeroProcesso)
          if (!processoId) continue

          for (const d of despachos) {
            const { error: insErr } = await supabase.from('inpi_movimentacoes').insert({
              inpi_processo_id: processoId,
              rpi_numero: edicao.rpiNumero,
              rpi_data: edicao.rpiData,
              codigo_despacho: d.codigo,
              descricao: d.descricao,
              origem: 'rpi_auto',
            })

            if (!insErr) {
              movimentacoesInseridas += 1
              if (d.codigo === 'IPAS158') {
                await supabase.from('inpi_processos')
                  .update({ status: 'concedido', data_concessao: edicao.rpiData })
                  .eq('id', processoId)
              } else if (d.codigo === 'IPAS161') {
                await supabase.from('inpi_processos').update({ status: 'extinto' }).eq('id', processoId)
              }
            } else if (insErr.code !== '23505') {
              // 23505 = já processamos essa movimentação antes (dedup pelo índice
              // único parcial) — qualquer outro erro interrompe a execução.
              throw new Error(`Falha ao gravar movimentação do processo ${numeroProcesso}: ${insErr.message}`)
            }
          }
        }
      }

      ultimoProcessado = numeroAtual
      await supabase.from('inpi_sync_state').update({
        ultimo_rpi_numero: ultimoProcessado,
        ultima_execucao: new Date().toISOString(),
        ultimo_erro: null,
      }).eq('id', true)

      edicoesProcessadas += 1
      numeroAtual += 1
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e)
      await supabase.from('inpi_sync_state').update({
        ultimo_erro: erro,
        ultima_execucao: new Date().toISOString(),
      }).eq('id', true)
      break
    }
  }

  return { ok: !erro, edicoesProcessadas, movimentacoesInseridas, erro }
}
