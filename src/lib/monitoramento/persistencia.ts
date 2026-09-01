// ─── Persistência de publicações capturadas ──────────────────────────────────
//
// Regras de deduplicação (nesta ordem):
//   1. hash estável (precomputado pela fonte DJEN, ou legado por fonte);
//   2. identificador oficial (id_externo) quando a fonte é o DJEN.
// Regras de vinculação a processo (por número CNJ normalizado):
//   - exatamente 1 processo com o número → vincula (grau 'exata');
//   - mais de 1 processo compatível     → NÃO vincula (grau 'multipla', triagem);
//   - nenhum processo                   → NÃO vincula (grau 'nenhuma', triagem);
// Nunca vincula por semelhança de nomes.

import { gerarHashDJE } from '@/lib/monitoramento/tjmg-dje'
import {
  analisarPublicacao,
  detectarPrazosEAudiencias,
  detectarTipoResultado,
} from '@/lib/monitoramento/prazo-detector'
import { somenteDigitos } from '@/lib/monitoramento/cnj'
import { derivarTrabalhoDaPublicacao } from '@/lib/monitoramento/publicacao-para-trabalho'
import type { PublicacaoCapturada } from '@/lib/monitoramento/fontes'

/** Client mínimo aceito (compatível com o client SSR, service role e fakes de teste). */
export type DbClient = { from: (table: string) => any }

export function gerarHashGenerico(pub: PublicacaoCapturada): string {
  const raw = [
    pub.fonte_id,
    pub.tribunal,
    pub.data_publicacao,
    pub.nome_pesquisado,
    pub.numero_processo ?? '',
    pub.texto_publicacao.slice(0, 120),
  ].join('|')

  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i), h = h >>> 0
  return `${pub.fonte_id}_${h.toString(16).padStart(8, '0')}`
}

export function gerarHashPublicacao(pub: PublicacaoCapturada): string {
  if (pub.hash_precomputado) return pub.hash_precomputado

  if (pub.fonte_id === 'tjmg-dje') {
    return gerarHashDJE(
      pub.data_publicacao,
      pub.nome_pesquisado,
      pub.numero_processo ?? '',
      pub.texto_publicacao,
    )
  }

  return gerarHashGenerico(pub)
}

/** Mapa nº CNJ (dígitos) → ids de processos. Suporta números repetidos. */
export function construirMapaProcessos(
  processos: Array<{ id: string; numero_processo: string | null }>,
): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const processo of processos) {
    const digits = somenteDigitos(processo.numero_processo ?? '')
    if (!digits) continue
    const ids = mapa.get(digits) ?? []
    ids.push(processo.id)
    mapa.set(digits, ids)
  }
  return mapa
}

export interface VinculoProcesso {
  processo_id: string | null
  grau: 'exata' | 'multipla' | 'nenhuma' | null
}

export function vincularProcesso(
  numeroProcesso: string | null | undefined,
  mapa: Map<string, string[]>,
): VinculoProcesso {
  const digits = somenteDigitos(numeroProcesso ?? '')
  if (!digits) return { processo_id: null, grau: null }

  const ids = mapa.get(digits) ?? []
  if (ids.length === 1) return { processo_id: ids[0], grau: 'exata' }
  if (ids.length > 1) return { processo_id: null, grau: 'multipla' }
  return { processo_id: null, grau: 'nenhuma' }
}

export type ResultadoInsercao = 'inserida' | 'duplicada' | 'falha'

export async function inserirPublicacao(
  supabase: DbClient,
  pub: PublicacaoCapturada,
  mapaProcessos: Map<string, string[]>,
): Promise<ResultadoInsercao> {
  const hash = gerarHashPublicacao(pub)

  const { data: existente } = await supabase
    .from('publicacoes')
    .select('id')
    .eq('hash', hash)
    .maybeSingle()

  if (existente) return 'duplicada'

  // Dedup complementar pelo identificador oficial do DJEN (cobre registros
  // importados antes da padronização do hash).
  if (pub.fonte_codigo === 'djen' && pub.id_externo) {
    const { data: porIdExterno } = await supabase
      .from('publicacoes')
      .select('id')
      .eq('fonte_codigo', 'djen')
      .eq('id_externo', pub.id_externo)
      .maybeSingle()

    if (porIdExterno) return 'duplicada'
  }

  const deteccao = detectarPrazosEAudiencias(pub.texto_publicacao)
  const tipo = detectarTipoResultado(pub.texto_publicacao)
  const analise = analisarPublicacao(pub.texto_publicacao)
  const vinculo = vincularProcesso(pub.numero_processo, mapaProcessos)

  const payload: Record<string, unknown> = {
    numero_processo: pub.numero_processo || null,
    tribunal: pub.tribunal,
    orgao: pub.orgao,
    diario: pub.diario,
    data_publicacao: pub.data_publicacao,
    nome_pesquisado: pub.nome_pesquisado,
    titulo: pub.texto_publicacao.slice(0, 5_000),
    resumo: analise.resumo.length ? analise.resumo.join(' · ') : null,
    tipo_publicacao: tipo,
    prazo_detectado: deteccao.prazo_detectado,
    prazo_dias: deteccao.prazo_dias ?? null,
    prazo_data: deteccao.prazo_data ?? null,
    prazo_descricao: deteccao.prazo_descricao ?? null,
    audiencia_detectada: deteccao.audiencia_detectada,
    audiencia_data: deteccao.audiencia_data ?? null,
    audiencia_descricao: deteccao.audiencia_descricao ?? null,
    status: 'nao_tratada',
    origem: pub.origem,
    termo_encontrado: pub.termo_encontrado ?? pub.nome_pesquisado,
    processo_id: vinculo.processo_id,
    hash,
  }

  if (vinculo.grau) payload.grau_confianca_vinculo = vinculo.grau
  if (pub.fonte_codigo) payload.fonte_codigo = pub.fonte_codigo
  if (pub.id_externo !== undefined) payload.id_externo = pub.id_externo
  if (pub.url_oficial !== undefined) payload.url_oficial = pub.url_oficial
  if (pub.tipo_comunicacao !== undefined) payload.tipo_comunicacao = pub.tipo_comunicacao
  if (pub.data_disponibilizacao !== undefined) payload.data_disponibilizacao = pub.data_disponibilizacao
  if (pub.partes !== undefined) payload.partes = pub.partes
  if (pub.advogados_publicacao !== undefined) payload.advogados_publicacao = pub.advogados_publicacao
  if (pub.advogado_monitorado_id) payload.advogado_monitorado_id = pub.advogado_monitorado_id
  if (pub.oab_pesquisada !== undefined) payload.oab_pesquisada = pub.oab_pesquisada
  if (pub.dados_brutos !== undefined) payload.dados_brutos = pub.dados_brutos

  const { data: inserida, error } = await supabase
    .from('publicacoes')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    // Corrida entre execuções: o índice único transforma o conflito em duplicada
    const mensagem = String(error.message ?? '')
    if (/duplicate key|unique/i.test(mensagem)) return 'duplicada'

    console.warn('[monitoramento] Falha ao inserir publicação:', {
      fonte: pub.fonte_id,
      tribunal: pub.tribunal,
      erro: mensagem,
    })
    return 'falha'
  }

  // A publicação está gravada. Daqui para baixo é derivação — andamento no
  // processo e tarefa no Kanban. Se falhar, a publicação NÃO é perdida: ela é o
  // registro que importa juridicamente, e o trabalho pode ser recriado depois.
  if (inserida?.id) {
    const resultado = await derivarTrabalhoDaPublicacao(supabase, inserida.id, {
      numero_processo: pub.numero_processo,
      processo_id: vinculo.processo_id,
      tribunal: pub.tribunal,
      orgao: pub.orgao,
      // As fontes DJEN colocam a data de DISPONIBILIZAÇÃO dentro de
      // `data_publicacao` (ver trt3-djen.ts). Preferimos o campo explícito
      // quando ele vem, e caímos nesse por ser o mesmo valor na prática.
      data_disponibilizacao:
        (payload.data_disponibilizacao as string | undefined) ?? pub.data_publicacao ?? null,
      tipo_comunicacao: (payload.tipo_comunicacao as string | undefined) ?? null,
      tipo_publicacao: tipo,
      texto: pub.texto_publicacao,
      url_oficial: (payload.url_oficial as string | undefined) ?? null,
      partes: payload.partes ?? null,
      prazo_detectado: deteccao.prazo_detectado,
      prazo_data: deteccao.prazo_data ?? null,
      prazo_dias: deteccao.prazo_dias ?? null,
      prazo_descricao: deteccao.prazo_descricao ?? null,
      audiencia_detectada: deteccao.audiencia_detectada,
      audiencia_data: deteccao.audiencia_data ?? null,
    })

    if (resultado.erros.length > 0) {
      console.warn('[monitoramento] Publicação gravada, mas a derivação teve problema:', {
        publicacao_id: inserida.id,
        andamento: resultado.andamento,
        tarefa: resultado.tarefa,
        erros: resultado.erros,
      })
    }
  }

  return 'inserida'
}
