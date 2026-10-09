// ─── Execução de busca de monitoramento (compartilhada) ──────────────────────
//
// Usada por:
//   POST /api/monitoramento/buscar          (manual, sessão autenticada)
//   GET  /api/cron/djen                     (agendada, CRON_SECRET)
//   POST /api/monitoramento/djen/importar   (captura via navegador)
//
// Idempotente: reexecutar a mesma consulta não cria publicações duplicadas
// (dedup por hash estável + id oficial do DJEN, com índice único no banco).

import {
  fontePodeExecutar,
  selecionarFontesMonitoramento,
  type FiltroFontesMonitoramento,
  type FonteMonitoramento,
  type PublicacaoCapturada,
  type ResultadoMonitoramento,
} from '@/lib/monitoramento/fontes'
import {
  executarFontesComFila,
  resumirExecucaoFontes,
  type ErroFonteDetalhado,
} from '@/lib/monitoramento/executor-fontes'
import {
  construirMapaProcessos,
  inserirPublicacao,
  vincularProcesso,
  type DbClient,
} from '@/lib/monitoramento/persistencia'
import { notificarRoles } from '@/lib/notificacoes'
import type { UserRole } from '@/types'

const ROLES_NOTIFICACAO: UserRole[] = ['advogado', 'gerente', 'socio']

export interface AdvogadoMonitoradoRow {
  id: string
  nome_completo: string
  oab_numero: string
  oab_uf: string
  ativo: boolean
  termos_adicionais?: string[] | null
  variacoes_nome?: string[] | null
  tribunais_interesse?: string[] | null
  publicacoes_encontradas?: number | null
}

interface ProcessoRow {
  id: string
  numero_processo: string
}

export interface LogFonte {
  fonte_id: string
  fonte_nome: string
  tribunal: string
  ramo: string
  status: string
  encontradas: number
  inseridas: number
  duplicadas: number
  ignoradas: number
  falhas: number
  erro?: string
  mensagem?: string
  erro_detalhado?: ErroFonteDetalhado
}

export interface ResultadoExecucaoBusca {
  status: number
  body: Record<string, unknown>
}

function resultadoFonteNaoExecutada(fonte: FonteMonitoramento): ResultadoMonitoramento {
  const mensagem = fonte.status === 'requer_credencial'
    ? 'Fonte requer credencial antes de executar.'
    : fonte.status === 'preparado'
      ? 'Fonte preparada, mas ainda não ativada para captura nesta fase.'
      : 'Fonte ainda não implementada.'

  return {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    tribunal: fonte.tribunal,
    ramo: fonte.ramo,
    status: fonte.status,
    encontradas: 0,
    inseridas: 0,
    duplicadas: 0,
    ignoradas: 0,
    falhas: fonte.status === 'erro' || fonte.status === 'requer_credencial' ? 1 : 0,
    publicacoes: [],
    mensagem,
  }
}

async function persistirResultado(
  supabase: DbClient,
  resultado: ResultadoMonitoramento,
  mapaProcessos: Map<string, string[]>,
  onInserida?: (pub: PublicacaoCapturada) => void,
): Promise<void> {
  for (const pub of resultado.publicacoes) {
    const status = await inserirPublicacao(supabase, pub, mapaProcessos).catch(error => {
      console.warn('[monitoramento] Erro inesperado ao inserir publicação:', {
        fonte: pub.fonte_id,
        tribunal: pub.tribunal,
        erro: error instanceof Error ? error.message : String(error),
      })
      return 'falha' as const
    })
    if (status === 'inserida') {
      resultado.inseridas++
      onInserida?.(pub)
    }
    if (status === 'duplicada') resultado.duplicadas++
    if (status === 'falha') resultado.falhas++
  }
}

async function executarFonte(
  fonte: FonteMonitoramento,
  contexto: {
    nomes: string[]
    processos: string[]
    oabs: string[]
    data: string | undefined
    advogados?: AdvogadoMonitoradoRow[]
    retroativoDias?: number
  },
  supabase: DbClient,
  mapaProcessos: Map<string, string[]>,
  onInserida?: (pub: PublicacaoCapturada) => void,
): Promise<ResultadoMonitoramento> {
  if (!fontePodeExecutar(fonte) || !fonte.executar) {
    return resultadoFonteNaoExecutada(fonte)
  }

  let resultado: ResultadoMonitoramento
  try {
    resultado = await fonte.executar(contexto)
  } catch (error) {
    return {
      fonte_id: fonte.id,
      fonte_nome: fonte.nome,
      tribunal: fonte.tribunal,
      ramo: fonte.ramo,
      status: 'erro',
      encontradas: 0,
      inseridas: 0,
      duplicadas: 0,
      ignoradas: 0,
      falhas: 1,
      publicacoes: [],
      erro: error instanceof Error ? error.message : String(error),
    }
  }

  await persistirResultado(supabase, resultado, mapaProcessos, onInserida)
  return resultado
}

function logFonte(resultado: ResultadoMonitoramento, erro_detalhado?: ErroFonteDetalhado): LogFonte {
  return {
    fonte_id: resultado.fonte_id,
    fonte_nome: resultado.fonte_nome,
    tribunal: resultado.tribunal,
    ramo: resultado.ramo,
    status: resultado.status,
    encontradas: resultado.encontradas,
    inseridas: resultado.inseridas,
    duplicadas: resultado.duplicadas,
    ignoradas: resultado.ignoradas,
    falhas: resultado.falhas,
    erro: resultado.erro,
    mensagem: resultado.mensagem,
    erro_detalhado,
  }
}

/** Atualiza estatísticas de execução dos advogados monitorados (fonte DJEN). */
export async function atualizarEstatisticasAdvogados(
  supabase: DbClient,
  advogados: AdvogadoMonitoradoRow[],
  publicacoes: PublicacaoCapturada[],
  falhaGeral: string | null,
): Promise<void> {
  try {
    const agora = new Date().toISOString()
    for (const advogado of advogados) {
      const novas = publicacoes.filter(pub => pub.advogado_monitorado_id === advogado.id).length
      const { error } = await supabase
        .from('advogados_monitorados')
        .update({
          ultima_execucao: agora,
          status_ultima_execucao: falhaGeral ? (novas > 0 ? 'parcial' : 'erro') : 'sucesso',
          erro_ultima_execucao: falhaGeral,
          publicacoes_encontradas: (advogado.publicacoes_encontradas ?? 0) + novas,
          updated_at: agora,
        })
        .eq('id', advogado.id)
      if (error) {
        console.warn('[monitoramento] Falha ao atualizar estatísticas do advogado:', error.message)
      }
    }
  } catch (error) {
    console.warn('[monitoramento] Estatísticas de advogados não atualizadas:', {
      erro: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Notificações agregadas da execução — silenciosa em ambientes sem service role. */
export async function notificarResultadoExecucao(opcoes: {
  fonte: string
  novas: number
  comPrazo: number
  semProcesso: number
  falhas: number
  erroGeral?: string | null
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return

  try {
    if (opcoes.novas > 0) {
      await notificarRoles(ROLES_NOTIFICACAO, {
        title: `Novas publicações (${opcoes.fonte})`,
        message: `${opcoes.novas} nova(s) publicação(ões) capturada(s)${opcoes.comPrazo > 0 ? `, ${opcoes.comPrazo} com possível prazo — revisão obrigatória` : ''}.`,
        type: opcoes.comPrazo > 0 ? 'warning' : 'info',
        link: '/publicacoes',
      })
    }

    if (opcoes.semProcesso > 0) {
      await notificarRoles(ROLES_NOTIFICACAO, {
        title: 'Publicações sem processo cadastrado',
        message: `${opcoes.semProcesso} publicação(ões) sem processo correspondente aguardando triagem.`,
        type: 'warning',
        link: '/publicacoes',
      })
    }

    if (opcoes.erroGeral) {
      await notificarRoles(ROLES_NOTIFICACAO, {
        title: `Falha na consulta ao ${opcoes.fonte}`,
        message: opcoes.erroGeral.slice(0, 300),
        type: 'critical',
        link: '/monitoramento',
      })
    }
  } catch (error) {
    console.warn('[monitoramento] Falha ao criar notificações:', {
      erro: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function executarBuscaMonitoramento(opcoes: {
  supabase: DbClient
  filtro: FiltroFontesMonitoramento
  disparadoPor: 'manual' | 'cron'
  usuarioId?: string | null
  retroativoDias?: number
}): Promise<ResultadoExecucaoBusca> {
  const inicio = Date.now()
  const { supabase, filtro, disparadoPor } = opcoes

  const fontes = selecionarFontesMonitoramento(filtro)
  if (fontes.length === 0) {
    return {
      status: 400,
      body: { sucesso: false, erro: 'Nenhuma fonte de monitoramento encontrada para o filtro informado.' },
    }
  }

  const { data: advogados, error: advError } = await supabase
    .from('advogados_monitorados')
    .select('*')
    .eq('ativo', true)

  if (advError || !advogados || advogados.length === 0) {
    return { status: 400, body: { erro: 'Nenhum advogado ativo para monitorar' } }
  }

  const { data: processosDB } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .not('numero_processo', 'is', null)

  const mapaProcessos = construirMapaProcessos((processosDB ?? []) as ProcessoRow[])
  const processoNums = [...mapaProcessos.keys()]
  const listaAdvogados = advogados as AdvogadoMonitoradoRow[]
  const nomes = listaAdvogados.flatMap(a => [a.nome_completo, ...(a.variacoes_nome ?? [])]).filter(Boolean)
  const oabs = listaAdvogados.flatMap(a => [
    `${a.oab_uf}${a.oab_numero}`,
    `${a.oab_numero}/${a.oab_uf}`,
  ])

  const contexto = {
    nomes,
    processos: processoNums,
    oabs,
    data: filtro.data,
    advogados: listaAdvogados,
    retroativoDias: opcoes.retroativoDias,
  }

  const inseridas: PublicacaoCapturada[] = []
  const resultadosFila = await executarFontesComFila({
    fontes,
    executarFonte: fonte => executarFonte(fonte, contexto, supabase, mapaProcessos, pub => inseridas.push(pub)),
  })
  const resultados = resultadosFila.map(item => item.resultado)
  const resumoExecucao = resumirExecucaoFontes(resultadosFila)

  const totalEncontradas = resultados.reduce((acc, item) => acc + item.encontradas, 0)
  const totalNovas = resultados.reduce((acc, item) => acc + item.inseridas, 0)
  const totalDuplicadas = resultados.reduce((acc, item) => acc + item.duplicadas, 0)
  const totalFalhas = resultados.reduce((acc, item) => acc + item.falhas, 0)
  const totalIgnoradas = resultados.reduce((acc, item) => acc + item.ignoradas, 0)
  const duracao = Date.now() - inicio
  const fontesLog = resultadosFila.map(item => logFonte(item.resultado, item.erro_detalhado))
  const todasPendentes = resultados.every(item => item.status !== 'ativo')

  // Estatísticas e notificações são específicas da execução DJEN consolidada
  const resultadoDJEN = resultados.find(item => item.fonte_id === 'djen')
  if (resultadoDJEN) {
    const inseridasDJEN = inseridas.filter(pub => pub.fonte_codigo === 'djen')
    await atualizarEstatisticasAdvogados(
      supabase,
      listaAdvogados,
      inseridasDJEN,
      resultadoDJEN.status === 'erro' ? resultadoDJEN.erro ?? resultadoDJEN.mensagem ?? 'Falha na consulta ao DJEN.' : null,
    )
    await notificarResultadoExecucao({
      fonte: 'DJEN',
      novas: resultadoDJEN.inseridas,
      comPrazo: inseridasDJEN.filter(pub => /prazo|intime|manifest|contesta|recurso/i.test(pub.texto_publicacao)).length,
      semProcesso: inseridasDJEN.filter(pub =>
        vincularProcesso(pub.numero_processo, mapaProcessos).processo_id === null,
      ).length,
      falhas: resultadoDJEN.falhas,
      erroGeral: resultadoDJEN.status === 'erro' ? resultadoDJEN.erro ?? resultadoDJEN.mensagem : null,
    })
  }

  await supabase.from('monitoramento_logs').insert({
    total_advogados: advogados.length,
    total_pesquisas: fontes.length,
    total_encontradas: totalEncontradas,
    total_novas: totalNovas,
    total_duplicadas: totalDuplicadas,
    duracao_ms: duracao,
    disparado_por: disparadoPor,
    fonte: filtro.fonte ?? (filtro.fontes?.length ? filtro.fontes.join(',') : 'todas'),
    usuario_id: opcoes.usuarioId ?? null,
    total_falhas: totalFalhas,
    detalhes_json: {
      fontes: fontesLog,
      total_falhas: totalFalhas,
      total_ignoradas: totalIgnoradas,
      resumo_execucao: resumoExecucao,
      filtro,
      nota: fontesLog.map(item =>
        `${item.fonte_nome}: ${item.status}, ${item.encontradas} encontrada(s), ${item.inseridas} inserida(s), ${item.duplicadas} duplicada(s), ${item.falhas} falha(s)`,
      ).join(' | '),
    },
  })

  if (todasPendentes) {
    return {
      status: 200,
      body: {
        sucesso: false,
        erro: resultados.some(item => item.status === 'requer_credencial')
          ? 'Fonte requer credencial antes de executar.'
          : 'Fonte ainda não implementada.',
        fontes: fontesLog,
        resumo_execucao: resumoExecucao,
        duracao_ms: duracao,
      },
    }
  }

  return {
    status: 200,
    body: {
      sucesso: true,
      total_advogados: advogados.length,
      total_pesquisas: fontes.length,
      total_encontradas: totalEncontradas,
      total_novas: totalNovas,
      inseridas: totalNovas,
      total_duplicadas: totalDuplicadas,
      total_falhas: totalFalhas,
      total_ignoradas: totalIgnoradas,
      fontes: fontesLog,
      resumo_execucao: resumoExecucao,
      duracao_ms: duracao,
    },
  }
}
