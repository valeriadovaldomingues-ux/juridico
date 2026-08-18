// ─── API Route: POST /api/monitoramento/djen/importar ────────────────────────
//
// Recebe comunicações BRUTAS do DJEN capturadas pelo navegador do usuário
// autenticado ("Consultar DJEN agora"). O WAF do CNJ recusa IPs de datacenter,
// mas a API pública tem CORS aberto — a consulta client-side usa o endpoint
// oficial e envia o resultado para cá, onde acontece toda a validação,
// normalização, deduplicação, vinculação e auditoria (server-side).
//
// O payload do cliente é tratado como não confiável: limites de tamanho,
// validação de forma e sanitização de HTML antes de persistir.

import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { criarProviderDJEN } from '@/lib/monitoramento/djen/provider'
import { mapearNormalizadaParaCapturada } from '@/lib/monitoramento/fontes/djen'
import {
  construirMapaProcessos,
  inserirPublicacao,
} from '@/lib/monitoramento/persistencia'
import {
  atualizarEstatisticasAdvogados,
  notificarResultadoExecucao,
  type AdvogadoMonitoradoRow,
} from '@/lib/monitoramento/executar-busca'
import { vincularProcesso } from '@/lib/monitoramento/persistencia'
import type { ConsultaDJEN, TipoConsultaDJEN } from '@/lib/monitoramento/djen/types'
import type { PublicacaoCapturada } from '@/lib/monitoramento/fontes'
import type { UserRole } from '@/types'

export const maxDuration = 120

const ROLES_MONITORAMENTO: UserRole[] = ['advogado', 'gerente', 'socio']
const MAX_RESULTADOS = 60
const MAX_ITENS_TOTAL = 5_000
const MAX_ITEM_BYTES = 200_000
const TIPOS_CONSULTA: TipoConsultaDJEN[] = ['oab', 'nome', 'processo', 'nome_parte']

interface ResultadoConsultaPayload {
  consulta: {
    tipo: TipoConsultaDJEN
    termo: string
    advogado_monitorado_id?: string
    siglaTribunal?: string
  }
  items: unknown[]
}

interface ImportarPayload {
  periodo?: { inicio?: string; fim?: string }
  resultados: ResultadoConsultaPayload[]
  erros?: Array<{ consulta?: string; mensagem?: string }>
}

function dataISOValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

function validarPayload(body: unknown): { payload: ImportarPayload } | { erro: string } {
  if (!body || typeof body !== 'object') return { erro: 'Payload inválido.' }
  const dados = body as Record<string, unknown>

  if (!Array.isArray(dados.resultados) || dados.resultados.length === 0) {
    return { erro: 'Nenhum resultado de consulta informado.' }
  }
  if (dados.resultados.length > MAX_RESULTADOS) {
    return { erro: `Máximo de ${MAX_RESULTADOS} consultas por importação.` }
  }

  let totalItens = 0
  const resultados: ResultadoConsultaPayload[] = []
  for (const entrada of dados.resultados) {
    if (!entrada || typeof entrada !== 'object') return { erro: 'Resultado de consulta inválido.' }
    const item = entrada as Record<string, unknown>
    const consulta = item.consulta as Record<string, unknown> | undefined

    if (!consulta || typeof consulta.termo !== 'string' || !consulta.termo.trim()) {
      return { erro: 'Consulta sem termo identificador.' }
    }
    if (!TIPOS_CONSULTA.includes(consulta.tipo as TipoConsultaDJEN)) {
      return { erro: `Tipo de consulta inválido: ${String(consulta.tipo)}.` }
    }
    if (!Array.isArray(item.items)) return { erro: 'Lista de itens ausente na consulta.' }

    totalItens += item.items.length
    if (totalItens > MAX_ITENS_TOTAL) {
      return { erro: `Máximo de ${MAX_ITENS_TOTAL} comunicações por importação.` }
    }

    resultados.push({
      consulta: {
        tipo: consulta.tipo as TipoConsultaDJEN,
        termo: consulta.termo.trim().slice(0, 200),
        advogado_monitorado_id: typeof consulta.advogado_monitorado_id === 'string'
          ? consulta.advogado_monitorado_id
          : undefined,
        siglaTribunal: typeof consulta.siglaTribunal === 'string'
          ? consulta.siglaTribunal.slice(0, 10)
          : undefined,
      },
      items: item.items,
    })
  }

  const periodoBruto = dados.periodo as Record<string, unknown> | undefined
  const periodo = periodoBruto && dataISOValida(periodoBruto.inicio) && dataISOValida(periodoBruto.fim)
    ? { inicio: periodoBruto.inicio, fim: periodoBruto.fim }
    : undefined

  const erros = Array.isArray(dados.erros)
    ? (dados.erros as Array<Record<string, unknown>>).slice(0, 20).map(erro => ({
      consulta: typeof erro?.consulta === 'string' ? erro.consulta.slice(0, 200) : undefined,
      mensagem: typeof erro?.mensagem === 'string' ? erro.mensagem.slice(0, 300) : undefined,
    }))
    : undefined

  return { payload: { periodo, resultados, erros } }
}

export async function POST(request: Request) {
  const inicio = Date.now()

  const auth = await apiGuard(ROLES_MONITORAMENTO)
  if (auth instanceof Response) {
    return Response.json(
      { erro: auth.status === 401 ? 'Não autorizado' : 'Sem permissão para importar publicações do DJEN' },
      { status: auth.status },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ erro: 'Payload inválido.' }, { status: 400 })
  }

  const validacao = validarPayload(body)
  if ('erro' in validacao) {
    return Response.json({ erro: validacao.erro }, { status: 400 })
  }
  const { payload } = validacao

  const supabase = await createClient()

  const { data: advogados } = await supabase
    .from('advogados_monitorados')
    .select('*')
    .eq('ativo', true)
  const listaAdvogados = (advogados ?? []) as AdvogadoMonitoradoRow[]

  const { data: processosDB } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .not('numero_processo', 'is', null)
  const mapaProcessos = construirMapaProcessos(
    (processosDB ?? []) as Array<{ id: string; numero_processo: string }>,
  )

  const provider = criarProviderDJEN()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const dataFallback = payload.periodo?.fim ?? hoje

  let encontradas = 0
  let inseridas = 0
  let duplicadas = 0
  let falhas = 0
  let ignoradas = 0
  const inseridasPubs: PublicacaoCapturada[] = []
  const vistos = new Set<string>()

  for (const resultado of payload.resultados) {
    const consulta: ConsultaDJEN = { ...resultado.consulta, params: {} }

    for (const itemBruto of resultado.items) {
      if (!itemBruto || typeof itemBruto !== 'object') {
        ignoradas++
        continue
      }
      if (JSON.stringify(itemBruto).length > MAX_ITEM_BYTES) {
        ignoradas++
        continue
      }

      encontradas++
      const normalizada = provider.normalizePublication({ consulta, item: itemBruto })
      if (!normalizada) {
        ignoradas++
        continue
      }
      if (vistos.has(normalizada.hash)) {
        duplicadas++
        continue
      }
      vistos.add(normalizada.hash)

      const capturada = mapearNormalizadaParaCapturada(
        normalizada,
        { consulta, item: itemBruto },
        dataFallback,
      )

      const status = await inserirPublicacao(supabase, capturada, mapaProcessos).catch(() => 'falha' as const)
      if (status === 'inserida') {
        inseridas++
        inseridasPubs.push(capturada)
      }
      if (status === 'duplicada') duplicadas++
      if (status === 'falha') falhas++
    }
  }

  const errosCliente = payload.erros?.filter(erro => erro.mensagem)?.length ?? 0

  await atualizarEstatisticasAdvogados(
    supabase,
    listaAdvogados,
    inseridasPubs,
    errosCliente > 0 && inseridas === 0 ? 'Falhas na consulta pelo navegador.' : null,
  )

  await notificarResultadoExecucao({
    fonte: 'DJEN',
    novas: inseridas,
    comPrazo: inseridasPubs.filter(pub => /prazo|intime|manifest|contesta|recurso/i.test(pub.texto_publicacao)).length,
    semProcesso: inseridasPubs.filter(pub =>
      vincularProcesso(pub.numero_processo, mapaProcessos).processo_id === null,
    ).length,
    falhas: falhas + errosCliente,
    erroGeral: null,
  })

  const duracao = Date.now() - inicio
  await supabase.from('monitoramento_logs').insert({
    total_advogados: listaAdvogados.length,
    total_pesquisas: payload.resultados.length,
    total_encontradas: encontradas,
    total_novas: inseridas,
    total_duplicadas: duplicadas,
    duracao_ms: duracao,
    disparado_por: 'manual',
    fonte: 'djen',
    usuario_id: auth.userId,
    total_falhas: falhas + errosCliente,
    periodo_inicio: payload.periodo?.inicio ?? null,
    periodo_fim: payload.periodo?.fim ?? null,
    detalhes_json: {
      modo: 'navegador',
      consultas: payload.resultados.map(item => ({
        tipo: item.consulta.tipo,
        termo: item.consulta.termo,
        itens: item.items.length,
      })),
      erros_cliente: payload.erros ?? [],
      total_ignoradas: ignoradas,
    },
  })

  return Response.json({
    sucesso: true,
    total_encontradas: encontradas,
    total_novas: inseridas,
    total_duplicadas: duplicadas,
    total_falhas: falhas + errosCliente,
    total_ignoradas: ignoradas,
    duracao_ms: duracao,
  })
}
