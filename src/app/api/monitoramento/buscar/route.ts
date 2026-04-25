// ─── API Route: POST /api/monitoramento/buscar ────────────────────────────────
//
// Executa a rotina de busca de publicações para todos os advogados monitorados.
// Pode ser chamada manualmente pela UI ou por um cron job externo.
//
// Automação via cron:
//   POST /api/monitoramento/buscar
//   Authorization: Bearer {CRON_SECRET}
//
// ARQUITETURA:
//   1. TJMG DJe real  — busca no Diário do Judiciário Eletrônico (www8.tjmg.jus.br)
//                        insere em `publicacoes`. Roda sempre.
//   2. DataJud (stub) — ponto de integração para outros tribunais. Roda sempre
//                        e insere em `publicacoes_monitoradas`.
//   3. Mock           — apenas em NODE_ENV !== 'production' e somente se o DJe
//                        real não retornou nenhuma publicação nova (fallback).

import { createClient } from '@/lib/supabase/server'
import {
  detectarPrazosEAudiencias,
  detectarTipoResultado,
} from '@/lib/monitoramento/prazo-detector'
import {
  buscarPublicacoesTJMG,
  gerarHashDJE,
} from '@/lib/monitoramento/tjmg-dje'
import { analisarPublicacao } from '@/lib/monitoramento/prazo-detector'

export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvogadoMonitorado {
  id: string
  nome_completo: string
  oab_numero: string
  oab_uf: string
  ativo: boolean
}

interface CapturaResult {
  numero_processo: string
  tribunal: string
  data_ref: string       // ISO datetime
  texto: string
  orgao?: string
  criterio_usado: string // 'oab' | 'nome_completo' | 'processo' | 'combinado'
  origem: 'datajud_oab' | 'datajud_nome' | 'datajud_processo' | 'datajud_combinado' | 'manual'
}

interface LogDetail {
  advogado: string
  oab: string
  encontrados: number
  novos: number
  duplicados: number
  erro?: string
}

// ─── Hash (djb2) ──────────────────────────────────────────────────────────────

function gerarHash(tribunal: string, numeroProcesso: string, dataRef: string, texto: string): string {
  const raw = `${tribunal}|${numeroProcesso}|${dataRef.slice(0, 10)}|${texto.slice(0, 100)}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i), h = h >>> 0
  return h.toString(16).padStart(8, '0')
}

// ─── Captura plugável ─────────────────────────────────────────────────────────
//
// Substitua esta função quando a fonte externa (DataJud, DJe, etc.) estiver
// disponível. Retorna uma lista de resultados para o advogado informado.
// Retorna [] enquanto não estiver configurada.

async function runCaptura(
  _adv: AdvogadoMonitorado,
  _processoNums: string[],
): Promise<CapturaResult[]> {
  // ─── PONTO DE INTEGRAÇÃO ───────────────────────────────────────────────
  //
  // Quando pronto, implementar aqui:
  //
  //   import { buscarPorAdvogado, TRIBUNAIS_POR_UF, TRIBUNAIS_SUPERIORES }
  //     from '@/lib/monitoramento/datajud'
  //
  //   const tribunais = [
  //     ...(TRIBUNAIS_POR_UF[_adv.oab_uf.toUpperCase()] ?? []),
  //     ...TRIBUNAIS_SUPERIORES,
  //   ]
  //
  //   const resultados: CapturaResult[] = []
  //   for (const tribunal of tribunais) {
  //     await new Promise(r => setTimeout(r, 400)) // rate limit
  //     const r = await buscarPorAdvogado(
  //       _adv.nome_completo, // NOME COMPLETO — nunca abreviado
  //       _adv.oab_numero,
  //       _adv.oab_uf,
  //       tribunal,
  //       _processoNums,
  //     )
  //     for (const proc of r.processos) {
  //       resultados.push({
  //         numero_processo: proc.numeroProcesso,
  //         tribunal:        tribunal.sigla,
  //         data_ref:        proc.dataAjuizamento ?? proc.movimentos?.[0]?.dataHora ?? new Date().toISOString(),
  //         texto:           extrairTextoMovimento(proc),
  //         orgao:           proc.orgaoJulgador?.nome,
  //         criterio_usado:  r.criterio_usado,
  //         origem:          r.origem,
  //       })
  //     }
  //   }
  //   return resultados
  //
  // ──────────────────────────────────────────────────────────────────────
  return []
}

// ─── Mock para testes (NODE_ENV !== 'production') ─────────────────────────────
//
// Ativo apenas fora de produção. Insere diretamente em `publicacoes` para que
// o fluxo completo da UI possa ser validado sem integração real com DJe/DataJud.

interface MockPublicacao {
  numero_processo: string
  tribunal: string
  orgao: string
  data_publicacao: string
  nome_pesquisado: string
  oab_pesquisada: string
  texto_publicacao: string
  tipo_publicacao: string
  prazo_detectado: boolean
  prazo_dias: number | null
  prazo_data: string | null
  prazo_descricao: string | null
  audiencia_detectada: boolean
  audiencia_data: string | null
  audiencia_descricao: string | null
  status: 'nao_tratada'
  origem: string
  hash: string
}

const MOCK_POOL = [
  {
    tribunal: 'TJSP',
    orgao: '1ª Vara Cível de São Paulo',
    tipo_publicacao: 'intimacao',
    texto: (adv: string, proc: string) =>
      `Intimação — Processo nº ${proc}. Fica intimada a parte autora, representada pelo(a) Dr(a). ${adv}, para apresentar contrarrazões ao recurso interposto, no prazo de 15 (quinze) dias úteis, nos termos do art. 1.010 do CPC.`,
    prazo_dias: 15,
    prazo_descricao: '15 dias úteis para contrarrazões',
    audiencia_detectada: false,
  },
  {
    tribunal: 'TJRJ',
    orgao: '3ª Vara de Família do Rio de Janeiro',
    tipo_publicacao: 'despacho',
    texto: (adv: string, proc: string) =>
      `Despacho — Autos nº ${proc}. Intime-se o(a) advogado(a) ${adv} para que, no prazo de 5 (cinco) dias, manifeste-se sobre os documentos juntados pela parte contrária. Após, conclusos.`,
    prazo_dias: 5,
    prazo_descricao: '5 dias para manifestação',
    audiencia_detectada: false,
  },
  {
    tribunal: 'STJ',
    orgao: '2ª Turma',
    tipo_publicacao: 'acordao',
    texto: (adv: string, proc: string) =>
      `Acórdão — Recurso Especial nº ${proc}. Relator: Min. Fulano de Tal. EMENTA: DIREITO CIVIL. RESPONSABILIDADE CONTRATUAL. (...) Recurso provido. Patrono: ${adv}. Unânime.`,
    prazo_dias: null,
    prazo_descricao: null,
    audiencia_detectada: false,
  },
  {
    tribunal: 'TJMG',
    orgao: '5ª Vara Cível de Belo Horizonte',
    tipo_publicacao: 'sentenca',
    texto: (adv: string, proc: string) =>
      `Sentença — Processo nº ${proc}. Vistos etc. JULGO PROCEDENTE o pedido formulado na inicial para condenar o réu ao pagamento de indenização por danos morais. Custas pelo réu. Prazo de 30 dias para apelação. Dr(a). ${adv}, OAB/MG.`,
    prazo_dias: 30,
    prazo_descricao: '30 dias para apelação',
    audiencia_detectada: false,
  },
  {
    tribunal: 'TJSP',
    orgao: '2ª Vara do Trabalho de Campinas',
    tipo_publicacao: 'publicacao',
    texto: (adv: string, proc: string) =>
      `Designação de audiência — Processo nº ${proc}. Fica designada audiência de instrução e julgamento para o dia 15/05/2026 às 14h00, na sala de audiências desta Vara. Ciência ao(à) advogado(a) ${adv}.`,
    prazo_dias: null,
    prazo_descricao: null,
    audiencia_detectada: true,
    audiencia_descricao: 'Audiência de instrução e julgamento em 15/05/2026 às 14h00',
  },
  {
    tribunal: 'TRF3',
    orgao: '6ª Turma',
    tipo_publicacao: 'despacho',
    texto: (adv: string, proc: string) =>
      `Despacho — Processo nº ${proc}. Concedo prazo de 10 (dez) dias para que o(a) patrono(a) ${adv} especifique as provas que pretende produzir, indicando sua pertinência e relevância para o deslinde da causa.`,
    prazo_dias: 10,
    prazo_descricao: '10 dias para especificação de provas',
    audiencia_detectada: false,
  },
]

function gerarNumeroProcesso(): string {
  const n   = Math.floor(Math.random() * 900000) + 100000
  const ano = 2023 + Math.floor(Math.random() * 3)
  const j   = Math.floor(Math.random() * 9) + 1
  const tr  = Math.floor(Math.random() * 26) + 1
  const org = Math.floor(Math.random() * 9000) + 1000
  return `${n}-${Math.floor(Math.random() * 90) + 10}.${ano}.${j}.${String(tr).padStart(2, '0')}.${String(org).padStart(4, '0')}`
}

async function gerarMockPublicacoes(
  advogados: AdvogadoMonitorado[],
  processoMap: Map<string, string>,
): Promise<MockPublicacao[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  // Pick 1–3 random templates, one per advogado (up to pool size)
  const qtd     = Math.min(Math.floor(Math.random() * 3) + 1, advogados.length, MOCK_POOL.length)
  const advSel  = [...advogados].sort(() => Math.random() - 0.5).slice(0, qtd)
  const tplSel  = [...MOCK_POOL].sort(() => Math.random() - 0.5).slice(0, qtd)
  const ts      = Date.now()

  return advSel.map((adv, i) => {
    const tpl  = tplSel[i]
    const proc = gerarNumeroProcesso()
    // Hash único por execução: inclui timestamp para evitar colisão entre chamadas
    const raw  = `mock|${tpl.tribunal}|${proc}|${hoje}|${ts}|${i}`
    let h = 5381
    for (let c = 0; c < raw.length; c++) h = ((h << 5) + h) ^ raw.charCodeAt(c), h = h >>> 0
    const hash = `mock_${h.toString(16).padStart(8, '0')}`

    const processoId = processoMap.get(proc.replace(/\D/g, '')) ?? null

    return {
      numero_processo:     proc,
      tribunal:            tpl.tribunal,
      orgao:               tpl.orgao,
      data_publicacao:     hoje,
      nome_pesquisado:     adv.nome_completo,
      oab_pesquisada:      `${adv.oab_uf} ${adv.oab_numero}`,
      texto_publicacao:    tpl.texto(adv.nome_completo, proc),
      tipo_publicacao:     tpl.tipo_publicacao,
      prazo_detectado:     tpl.prazo_dias != null,
      prazo_dias:          tpl.prazo_dias ?? null,
      prazo_data:          null,
      prazo_descricao:     tpl.prazo_descricao ?? null,
      audiencia_detectada: tpl.audiencia_detectada,
      audiencia_data:      null,
      audiencia_descricao: tpl.audiencia_detectada ? (tpl as typeof tpl & { audiencia_descricao?: string }).audiencia_descricao ?? null : null,
      status:              'nao_tratada' as const,
      origem:              'monitoramento_mock',
      hash,
      ...(processoId ? { processo_id: processoId } : {}),
    }
  })
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const inicio = Date.now()

  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const supabase   = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const isCronCall = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!isCronCall) {
    if (!user) {
      return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const rolesPermitidos = ['advogado', 'gerente', 'socio']
    if (!profile || !rolesPermitidos.includes(profile.role)) {
      return Response.json({ erro: 'Sem permissão para acionar o monitoramento' }, { status: 403 })
    }
  }

  // Fetch active lawyers
  const { data: advogados, error: advError } = await supabase
    .from('advogados_monitorados')
    .select('*')
    .eq('ativo', true)

  if (advError || !advogados || advogados.length === 0) {
    return Response.json({ erro: 'Nenhum advogado ativo para monitorar' }, { status: 400 })
  }

  // Fetch process numbers for auto-linking
  const { data: processosDB } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .not('numero_processo', 'is', null)

  const processoMap = new Map<string, string>(
    (processosDB ?? []).map((p: { id: string; numero_processo: string }) => [
      p.numero_processo.replace(/\D/g, ''),
      p.id,
    ])
  )
  const processoNums = [...processoMap.keys()]

  let totalPesquisas   = 0
  let totalEncontradas = 0
  let totalNovas       = 0
  let totalDuplicadas  = 0
  const detalhes: LogDetail[] = []

  // ── TJMG DJe real ─────────────────────────────────────────────────────────
  // Busca uma vez para todos os advogados monitorados, usando o DJe HTML do TJMG.
  // Insere resultados em `publicacoes` (mesma tabela da UI de Publicações).
  let tjmgEncontradas = 0
  let tjmgInseridas   = 0
  let tjmgDuplicadas  = 0
  let tjmgErro: string | undefined

  try {
    const nomes = (advogados as AdvogadoMonitorado[]).map(a => a.nome_completo)
    const publicacoesDJE = await buscarPublicacoesTJMG(nomes)

    tjmgEncontradas = publicacoesDJE.length

    for (const pub of publicacoesDJE) {
      const hash = gerarHashDJE(
        pub.data_publicacao,
        pub.nome_pesquisado,
        pub.numero_processo,
        pub.texto_publicacao,
      )

      // Deduplicação
      const { data: existente } = await supabase
        .from('publicacoes')
        .select('id')
        .eq('hash', hash)
        .maybeSingle()

      if (existente) { tjmgDuplicadas++; totalDuplicadas++; continue }

      const deteccao   = detectarPrazosEAudiencias(pub.texto_publicacao)
      const tipo       = detectarTipoResultado(pub.texto_publicacao)
      const analise    = analisarPublicacao(pub.texto_publicacao)
      const processoId = pub.numero_processo
        ? processoMap.get(pub.numero_processo.replace(/\D/g, '')) ?? null
        : null

      await supabase.from('publicacoes').insert({
        numero_processo:     pub.numero_processo || null,
        tribunal:            pub.tribunal,
        orgao:               pub.orgao,
        data_publicacao:     pub.data_publicacao,
        nome_pesquisado:     pub.nome_pesquisado,
        texto_publicacao:    pub.texto_publicacao.slice(0, 5_000),
        resumo:              analise.resumo.length ? analise.resumo.join(' · ') : null,
        tipo_publicacao:     tipo,
        prazo_detectado:     deteccao.prazo_detectado,
        prazo_dias:          deteccao.prazo_dias ?? null,
        prazo_data:          deteccao.prazo_data ?? null,
        prazo_descricao:     deteccao.prazo_descricao ?? null,
        audiencia_detectada: deteccao.audiencia_detectada,
        audiencia_data:      deteccao.audiencia_data ?? null,
        audiencia_descricao: deteccao.audiencia_descricao ?? null,
        status:              'nao_tratada',
        origem:              pub.origem,
        processo_id:         processoId,
        hash,
      })

      tjmgInseridas++
      totalNovas++
    }

    totalEncontradas += tjmgEncontradas
  } catch (err) {
    tjmgErro = err instanceof Error ? err.message : String(err)
    console.error('[TJMG-DJe] Erro geral na busca:', tjmgErro)
  }

  for (const adv of advogados as AdvogadoMonitorado[]) {
    totalPesquisas++
    const detail: LogDetail = {
      advogado: adv.nome_completo,
      oab: `${adv.oab_uf} ${adv.oab_numero}`,
      encontrados: 0, novos: 0, duplicados: 0,
    }

    try {
      const resultados = await runCaptura(adv, processoNums)
      detail.encontrados  = resultados.length
      totalEncontradas   += resultados.length

      for (const r of resultados) {
        const hash = gerarHash(r.tribunal, r.numero_processo, r.data_ref, r.texto)

        // Deduplication
        const { data: existing } = await supabase
          .from('publicacoes_monitoradas')
          .select('id')
          .eq('hash_publicacao', hash)
          .maybeSingle()

        if (existing) { totalDuplicadas++; detail.duplicados++; continue }

        const deteccao = detectarPrazosEAudiencias(r.texto)
        const tipo     = detectarTipoResultado(r.texto)

        // Auto-link to processo
        const processoId = processoMap.get(r.numero_processo.replace(/\D/g, '')) ?? null

        await supabase.from('publicacoes_monitoradas').insert({
          advogado_monitorado_id: adv.id,
          nome_pesquisado:        adv.nome_completo,
          oab_pesquisada:         `${adv.oab_uf} ${adv.oab_numero}`,
          processo_id:            processoId,
          numero_processo:        r.numero_processo,
          tribunal:               r.tribunal,
          data_publicacao:        r.data_ref.slice(0, 10),
          data_disponibilizacao:  r.data_ref.slice(0, 10),
          texto_publicacao:       r.texto.slice(0, 5000),
          termo_encontrado:       r.criterio_usado,
          tipo_resultado:         tipo,
          prazo_detectado:        deteccao.prazo_detectado,
          prazo_dias:             deteccao.prazo_dias ?? null,
          prazo_data:             deteccao.prazo_data ?? null,
          prazo_descricao:        deteccao.prazo_descricao ?? null,
          audiencia_detectada:    deteccao.audiencia_detectada,
          audiencia_data:         deteccao.audiencia_data ?? null,
          audiencia_descricao:    deteccao.audiencia_descricao ?? null,
          hash_publicacao:        hash,
          status_tratamento:      'nova',
          origem:                 r.origem,
        })

        totalNovas++
        detail.novos++
      }
    } catch (err) {
      detail.erro = err instanceof Error ? err.message : String(err)
    }

    detalhes.push(detail)
  }

  // ── Mock (fallback — apenas fora de produção e se DJe real não inseriu nada) ─
  // Garante pelo menos 1 publicação para validar o fluxo completo da UI.
  let mockInseridas = 0
  const isMockEnv    = process.env.NODE_ENV !== 'production'
  const mockAtivo    = isMockEnv && tjmgInseridas === 0

  if (mockAtivo) {
    const mocks = await gerarMockPublicacoes(advogados as AdvogadoMonitorado[], processoMap)

    for (const mock of mocks) {
      const { data: existing } = await supabase
        .from('publicacoes')
        .select('id')
        .eq('hash', mock.hash)
        .maybeSingle()

      if (existing) { totalDuplicadas++; continue }

      await supabase.from('publicacoes').insert(mock)
      mockInseridas++
      totalNovas++
    }
  }

  const duracao = Date.now() - inicio

  // Write execution log
  const notaLog = [
    `TJMG DJe: ${tjmgEncontradas} encontrada(s), ${tjmgInseridas} inserida(s), ${tjmgDuplicadas} duplicada(s)`,
    tjmgErro ? `Erro DJe: ${tjmgErro}` : null,
    mockAtivo ? `Mock fallback: ${mockInseridas} publicação(ões) fictícia(s)` : null,
    !isMockEnv && tjmgInseridas === 0 ? 'Nenhuma publicação nova encontrada no DJe' : null,
  ].filter(Boolean).join(' | ')

  await supabase.from('monitoramento_logs').insert({
    total_advogados:   advogados.length,
    total_pesquisas:   totalPesquisas,
    total_encontradas: totalEncontradas + mockInseridas,
    total_novas:       totalNovas,
    total_duplicadas:  totalDuplicadas,
    duracao_ms:        duracao,
    disparado_por:     isCronCall ? 'cron' : 'manual',
    detalhes_json:     { detalhes, nota: notaLog },
  })

  return Response.json({
    sucesso:           true,
    total_advogados:   advogados.length,
    total_pesquisas:   totalPesquisas,
    total_encontradas: totalEncontradas + mockInseridas,
    inseridas:         totalNovas,
    total_duplicadas:  totalDuplicadas,
    tjmg_encontradas:  tjmgEncontradas,
    tjmg_inseridas:    tjmgInseridas,
    mock_inseridas:    mockInseridas,
    duracao_ms:        duracao,
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
