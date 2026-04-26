/**
 * POST /api/publicacoes/importar-fonte
 *
 * Importa uma ou mais publicações manualmente de uma fonte configurada.
 * Aplica deduplicação por 5 critérios antes de inserir.
 *
 * Body: { fonte_codigo, publicacoes: PublicacaoImport[] }
 *
 * Deduplicação:
 *  1. message_id   — se igual, descarta
 *  2. hash do texto — se igual, descarta
 *  3. (numero_processo + data_publicacao + fonte_codigo) — se igual, descarta
 *  Qualquer um dos critérios positivos → duplicata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

interface PublicacaoImport {
  // Identificação
  numero_processo?:       string | null
  tribunal?:              string | null
  comarca?:               string | null
  vara?:                  string | null
  orgao?:                 string | null

  // Datas
  data_publicacao?:       string | null   // YYYY-MM-DD
  data_disponibilizacao?: string | null

  // Conteúdo
  texto_publicacao?:      string | null
  resumo?:                string | null
  tipo_publicacao?:       string | null

  // Partes
  cliente?:               string | null
  parte_contraria?:       string | null
  nome_pesquisado?:       string | null

  // E-mail origem
  email_remetente?:       string | null
  email_assunto?:         string | null
  message_id?:            string | null

  // Prazo SUGERIDO (nunca automático)
  prazo_sugerido?:        string | null   // YYYY-MM-DD

  // Urgência
  urgencia?:              'critica' | 'alta' | 'media' | 'baixa' | null

  // Detecção
  prazo_detectado?:       boolean
  prazo_dias?:            number | null
  prazo_data?:            string | null
  prazo_descricao?:       string | null
  audiencia_detectada?:   boolean
  audiencia_data?:        string | null
  audiencia_descricao?:   string | null

  // Anexo
  anexo_nome?:            string | null
  anexo_url?:             string | null
}

function gerarHashTexto(texto: string, fonteCode: string, numero?: string | null, data?: string | null): string {
  const raw = `${fonteCode}|${numero ?? ''}|${data ?? ''}|${(texto ?? '').slice(0, 200)}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i), h = h >>> 0
  return h.toString(16).padStart(8, '0')
}

const TIPO_VALIDOS = ['intimacao', 'publicacao', 'despacho', 'sentenca', 'acordao', 'outro']
const URGENCIA_VALIDOS = ['critica', 'alta', 'media', 'baixa']

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { fonte_codigo, publicacoes: pubs } = body as {
    fonte_codigo: string
    publicacoes: PublicacaoImport[]
  }

  if (!fonte_codigo || !Array.isArray(pubs) || pubs.length === 0) {
    return NextResponse.json({ error: 'fonte_codigo e publicacoes são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  // Carrega dados da fonte
  const { data: fonte, error: fonteErr } = await supabase
    .from('publicacao_fontes')
    .select('id, codigo, nome, tipo')
    .eq('codigo', fonte_codigo)
    .eq('ativo', true)
    .single()

  if (fonteErr || !fonte) {
    return NextResponse.json({ error: `Fonte "${fonte_codigo}" não encontrada ou inativa.` }, { status: 404 })
  }

  // Prepara hashes para deduplicação em lote
  const hashes   = pubs.map(p => gerarHashTexto(p.texto_publicacao ?? '', fonte_codigo, p.numero_processo, p.data_publicacao))
  const msgIds   = pubs.map(p => p.message_id).filter(Boolean) as string[]
  const processoPairs = pubs
    .filter(p => p.numero_processo && p.data_publicacao)
    .map(p => `${p.numero_processo!.trim()}|${p.data_publicacao}|${fonte_codigo}`)

  // Carrega existentes para dedup
  const [{ data: existByHash }, { data: existByMsg }] = await Promise.all([
    supabase.from('publicacoes').select('hash').in('hash', hashes),
    msgIds.length > 0
      ? supabase.from('publicacoes').select('message_id').in('message_id', msgIds)
      : Promise.resolve({ data: [] }),
  ])

  const hashSet  = new Set((existByHash  ?? []).map(r => r.hash))
  const msgIdSet = new Set((existByMsg   ?? []).map(r => r.message_id).filter(Boolean))

  // Para a dedup composta (numero+data+fonte) fazemos via DB unique index ao inserir
  const toInsert: object[] = []
  const duplicatas: string[] = []
  const erros:      string[] = []

  for (let i = 0; i < pubs.length; i++) {
    const p = pubs[i]
    const hash = hashes[i]

    // Dedup por hash
    if (hashSet.has(hash)) { duplicatas.push(p.message_id ?? p.numero_processo ?? `item ${i + 1}`); continue }

    // Dedup por message_id
    if (p.message_id && msgIdSet.has(p.message_id)) { duplicatas.push(p.message_id); continue }

    hashSet.add(hash)
    if (p.message_id) msgIdSet.add(p.message_id)

    const tipo = TIPO_VALIDOS.includes(p.tipo_publicacao ?? '') ? p.tipo_publicacao : 'publicacao'
    const urg  = URGENCIA_VALIDOS.includes(p.urgencia ?? '') ? p.urgencia : null

    toInsert.push({
      // Identificação
      numero_processo:        p.numero_processo ?? null,
      tribunal:               p.tribunal ?? null,
      orgao:                  p.orgao ?? null,
      comarca:                p.comarca ?? null,
      vara:                   p.vara ?? null,

      // Datas
      data_publicacao:        p.data_publicacao ?? null,
      data_disponibilizacao:  p.data_disponibilizacao ?? null,

      // Conteúdo
      texto_publicacao:       p.texto_publicacao ?? null,
      resumo:                 p.resumo ?? null,
      tipo_publicacao:        tipo,
      nome_pesquisado:        p.nome_pesquisado ?? '',

      // Partes
      cliente:                p.cliente ?? null,
      parte_contraria:        p.parte_contraria ?? null,

      // E-mail
      email_remetente:        p.email_remetente ?? null,
      email_assunto:          p.email_assunto ?? null,
      message_id:             p.message_id ?? null,

      // Prazo sugerido (NUNCA automático — aguarda revisão)
      prazo_sugerido:         p.prazo_sugerido ?? null,
      urgencia:               urg,

      // Detecção automática
      prazo_detectado:        p.prazo_detectado ?? false,
      prazo_dias:             p.prazo_dias ?? null,
      prazo_data:             p.prazo_data ?? null,
      prazo_descricao:        p.prazo_descricao ?? null,
      audiencia_detectada:    p.audiencia_detectada ?? false,
      audiencia_data:         p.audiencia_data ?? null,
      audiencia_descricao:    p.audiencia_descricao ?? null,

      // Anexo
      anexo_nome:             p.anexo_nome ?? null,
      anexo_url:              p.anexo_url ?? null,

      // Fonte
      fonte_id:               fonte.id,
      fonte_codigo:           fonte.codigo,

      // Deduplicação
      hash,

      // Fluxo de revisão — TODAS entram como pendente
      status_revisao:         'pendente',
      status:                 'nao_tratada',
      origem:                 'importacao',
    })
  }

  let importadas = 0
  const errosInsert: string[] = []

  if (toInsert.length > 0) {
    // Insere em lotes de 50, usando ON CONFLICT para tratar dedup composta pelo índice único
    const CHUNK = 50
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      const { data: ins, error: insErr } = await supabase
        .from('publicacoes')
        .insert(chunk)
        .select('id')

      if (insErr) {
        // Índice único disparou = duplicata composta, tenta uma a uma
        for (const item of chunk) {
          const { error: e2 } = await supabase.from('publicacoes').insert(item).select('id')
          if (!e2) importadas++
          else if (e2.code === '23505') duplicatas.push('duplicata composta')
          else errosInsert.push(e2.message)
        }
      } else {
        importadas += ins?.length ?? 0
      }
    }
  }

  return NextResponse.json({
    importadas,
    duplicatas:    duplicatas.length,
    erros:         errosInsert.length,
    fonte:         fonte.nome,
    detalhes:      errosInsert,
    duplicatas_ids: duplicatas,
  })
}
