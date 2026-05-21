// ─── API Route: POST /api/monitoramento/buscar ────────────────────────────────
//
// Executa fontes formais de monitoramento. Fontes sem captura pública validada
// ficam catalogadas com status explícito e não inserem publicações.

import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  detectarPrazosEAudiencias,
  detectarTipoResultado,
  analisarPublicacao,
} from '@/lib/monitoramento/prazo-detector'
import { gerarHashDJE } from '@/lib/monitoramento/tjmg-dje'
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
import type { UserRole } from '@/types'

export const maxDuration = 300

const ROLES_MONITORAMENTO: UserRole[] = ['advogado', 'gerente', 'socio']

interface AdvogadoMonitorado {
  id: string
  nome_completo: string
  oab_numero: string
  oab_uf: string
  ativo: boolean
}

interface ProcessoDB {
  id: string
  numero_processo: string
}

interface LogFonte {
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

function gerarHashGenerico(pub: PublicacaoCapturada): string {
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

function gerarHashPublicacao(pub: PublicacaoCapturada): string {
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

async function lerFiltro(request: Request): Promise<FiltroFontesMonitoramento> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return {}

  try {
    const body = await request.json()
    return {
      fonte: typeof body?.fonte === 'string' ? body.fonte : undefined,
      fontes: Array.isArray(body?.fontes)
        ? body.fontes.filter((item: unknown) => typeof item === 'string')
        : undefined,
      tribunal: typeof body?.tribunal === 'string' ? body.tribunal : undefined,
      ramo: typeof body?.ramo === 'string' ? body.ramo : undefined,
      data: typeof body?.data === 'string'
        ? body.data
        : typeof body?.data_publicacao === 'string'
          ? body.data_publicacao
          : undefined,
    }
  } catch {
    return {}
  }
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

async function inserirPublicacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pub: PublicacaoCapturada,
  processoMap: Map<string, string>,
): Promise<'inserida' | 'duplicada' | 'falha'> {
  const hash = gerarHashPublicacao(pub)

  const { data: existente } = await supabase
    .from('publicacoes')
    .select('id')
    .eq('hash', hash)
    .maybeSingle()

  if (existente) return 'duplicada'

  const deteccao = detectarPrazosEAudiencias(pub.texto_publicacao)
  const tipo = detectarTipoResultado(pub.texto_publicacao)
  const analise = analisarPublicacao(pub.texto_publicacao)
  const processoId = pub.numero_processo
    ? processoMap.get(pub.numero_processo.replace(/\D/g, '')) ?? null
    : null

  const { error } = await supabase.from('publicacoes').insert({
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
    processo_id: processoId,
    hash,
  })

  if (error) {
    console.warn('[monitoramento] Falha ao inserir publicação:', {
      fonte: pub.fonte_id,
      tribunal: pub.tribunal,
      erro: error.message,
    })
    return 'falha'
  }

  return 'inserida'
}

async function executarFonte(
  fonte: FonteMonitoramento,
  nomes: string[],
  processos: string[],
  oabs: string[],
  data: string | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoMap: Map<string, string>,
): Promise<ResultadoMonitoramento> {
  if (!fontePodeExecutar(fonte) || !fonte.executar) {
    return resultadoFonteNaoExecutada(fonte)
  }

  let resultado: ResultadoMonitoramento
  try {
    resultado = await fonte.executar({ nomes, processos, oabs, data })
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

  for (const pub of resultado.publicacoes) {
    const status = await inserirPublicacao(supabase, pub, processoMap).catch(error => {
      console.warn('[monitoramento] Erro inesperado ao inserir publicação:', {
        fonte: pub.fonte_id,
        tribunal: pub.tribunal,
        erro: error instanceof Error ? error.message : String(error),
      })
      return 'falha' as const
    })
    if (status === 'inserida') resultado.inseridas++
    if (status === 'duplicada') resultado.duplicadas++
    if (status === 'falha') resultado.falhas++
  }

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

export async function POST(request: Request) {
  const inicio = Date.now()

  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isCronCall = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!isCronCall) {
    const auth = await apiGuard(ROLES_MONITORAMENTO)
    if (auth instanceof Response) {
      return Response.json(
        { erro: auth.status === 401 ? 'Não autorizado' : 'Sem permissão para acionar o monitoramento' },
        { status: auth.status },
      )
    }
  }

  const filtro = await lerFiltro(request)
  const fontes = selecionarFontesMonitoramento(filtro)

  if (fontes.length === 0) {
    return Response.json(
      { sucesso: false, erro: 'Nenhuma fonte de monitoramento encontrada para o filtro informado.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  const { data: advogados, error: advError } = await supabase
    .from('advogados_monitorados')
    .select('*')
    .eq('ativo', true)

  if (advError || !advogados || advogados.length === 0) {
    return Response.json({ erro: 'Nenhum advogado ativo para monitorar' }, { status: 400 })
  }

  const { data: processosDB } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .not('numero_processo', 'is', null)

  const processoMap = new Map<string, string>(
    ((processosDB ?? []) as ProcessoDB[]).map(p => [
      p.numero_processo.replace(/\D/g, ''),
      p.id,
    ]),
  )
  const processoNums = [...processoMap.keys()]
  const nomes = (advogados as AdvogadoMonitorado[]).map(a => a.nome_completo)
  const oabs = (advogados as AdvogadoMonitorado[])
    .flatMap(a => [
      `${a.oab_uf}${a.oab_numero}`,
      `${a.oab_numero}/${a.oab_uf}`,
    ])

  const resultadosFila = await executarFontesComFila({
    fontes,
    executarFonte: fonte => executarFonte(fonte, nomes, processoNums, oabs, filtro.data, supabase, processoMap),
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

  await supabase.from('monitoramento_logs').insert({
    total_advogados: advogados.length,
    total_pesquisas: fontes.length,
    total_encontradas: totalEncontradas,
    total_novas: totalNovas,
    total_duplicadas: totalDuplicadas,
    duracao_ms: duracao,
    disparado_por: isCronCall ? 'cron' : 'manual',
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
    return Response.json({
      sucesso: false,
      erro: resultados.some(item => item.status === 'requer_credencial')
        ? 'Fonte requer credencial antes de executar.'
        : 'Fonte ainda não implementada.',
      fontes: fontesLog,
      resumo_execucao: resumoExecucao,
      duracao_ms: duracao,
    })
  }

  return Response.json({
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
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  const { data: lastLog } = await supabase
    .from('monitoramento_logs')
    .select('*')
    .order('executado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json({ ultimo_log: lastLog ?? null })
}
