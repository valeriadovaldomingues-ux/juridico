import { createClient } from '@/lib/supabase/server'

export interface IntencaoPublicacoes {
  temIntencao: boolean
  hoje: boolean
  pendentes: boolean
  prazo: boolean
  audiencia: boolean
  triagem: boolean
}

export interface BuscarPublicacoesAuroraOptions extends IntencaoPublicacoes {
  limit?: number
}

export interface PublicacaoAurora {
  id: string
  numero_processo: string | null
  tribunal: string | null
  orgao: string | null
  diario: string | null
  data_publicacao: string | null
  created_at?: string | null
  titulo?: string | null
  resumo: string | null
  tipo_publicacao: string
  prazo_detectado: boolean
  prazo_dias: number | null
  prazo_data: string | null
  prazo_descricao: string | null
  audiencia_detectada: boolean
  audiencia_data: string | null
  audiencia_descricao: string | null
  status: string
  origem: string
  processo_id: string | null
  processo?: {
    id: string
    titulo: string
    numero_processo: string | null
  } | {
    id: string
    titulo: string
    numero_processo: string | null
  }[] | null
}

const PUBLICACOES_LIMIT = 20

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getHojeBRT() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

function getAmanhaBRT(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resumoSeguro(text: string | null | undefined, limit = 240) {
  if (!text) return null
  return text.replace(/\s+/g, ' ').trim().slice(0, limit)
}

export function detectarIntencaoPublicacoes(mensagem: string): IntencaoPublicacoes {
  const text = normalize(mensagem)

  const prazo = /\bprazo(?:s)?\b/.test(text) || text.includes('prazo detectado')
  const audiencia = text.includes('audiencia')
  const pendentes = /\bpendente(?:s)?\b/.test(text) || text.includes('nao tratada') || text.includes('nao tratadas')
  const triagem = text.includes('triagem') || text.includes('triar')

  const temIntencao =
    text.includes('publicacao') ||
    text.includes('publicacoes') ||
    text.includes('intimacao') ||
    text.includes('intimacoes') ||
    text.includes('diario') ||
    text.includes('dje') ||
    prazo ||
    audiencia ||
    triagem

  return {
    temIntencao,
    hoje: /\bhoje\b/.test(text),
    pendentes,
    prazo,
    audiencia,
    triagem,
  }
}

export async function buscarPublicacoesParaAurora(
  opcoes: BuscarPublicacoesAuroraOptions,
): Promise<PublicacaoAurora[]> {
  const supabase = await createClient()
  const limit = Math.min(Math.max(opcoes.limit ?? PUBLICACOES_LIMIT, 1), PUBLICACOES_LIMIT)

  let query = supabase
    .from('publicacoes')
    .select(`
      id,
      numero_processo,
      tribunal,
      orgao,
      diario,
      data_publicacao,
      created_at,
      titulo,
      resumo,
      tipo_publicacao,
      prazo_detectado,
      prazo_dias,
      prazo_data,
      prazo_descricao,
      audiencia_detectada,
      audiencia_data,
      audiencia_descricao,
      status,
      origem,
      processo_id,
      processo:processos(id, titulo, numero_processo)
    `)
    .order('data_publicacao', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opcoes.hoje) {
    const hoje = getHojeBRT()
    query = query
      .gte('created_at', `${hoje}T00:00:00-03:00`)
      .lt('created_at', `${getAmanhaBRT(hoje)}T00:00:00-03:00`)
  }
  if (opcoes.pendentes || opcoes.triagem) {
    query = query.eq('status', 'nao_tratada')
  }
  if (opcoes.prazo) {
    query = query.eq('prazo_detectado', true)
  }
  if (opcoes.audiencia) {
    query = query.eq('audiencia_detectada', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as PublicacaoAurora[]).slice(0, limit)
}

export function montarContextoPublicacoesParaAurora(publicacoes: PublicacaoAurora[]) {
  if (publicacoes.length === 0) {
    return [
      'CONTEXTO DO SISTEMA - PUBLICAÇÕES',
      'Consulta realizada na tabela publicacoes.',
      'Resultado: não encontrei publicações no período/filtro consultado.',
    ].join('\n')
  }

  const totalPrazo = publicacoes.filter(pub => pub.prazo_detectado).length
  const totalAudiencia = publicacoes.filter(pub => pub.audiencia_detectada).length
  const totalPendentes = publicacoes.filter(pub => pub.status === 'nao_tratada').length

  const linhas = publicacoes.map((pub, index) => {
    const processoVinculado = Array.isArray(pub.processo) ? pub.processo[0] : pub.processo
    const processo = processoVinculado
      ? `${processoVinculado.titulo}${processoVinculado.numero_processo ? ` (${processoVinculado.numero_processo})` : ''}`
      : 'Sem vínculo de processo'

    return [
      `${index + 1}. ID: ${pub.id}`,
      `   Tipo: ${pub.tipo_publicacao}`,
      `   Status: ${pub.status}`,
      `   Data da publicação: ${pub.data_publicacao ?? 'não informada'}`,
      `   Tribunal/órgão/diário: ${[pub.tribunal, pub.orgao, pub.diario].filter(Boolean).join(' | ') || 'não informado'}`,
      `   Processo: ${processo}`,
      `   Número informado: ${pub.numero_processo ?? 'não informado'}`,
      `   Resumo cadastrado: ${resumoSeguro(pub.resumo ?? pub.titulo) ?? 'não informado'}`,
      `   Prazo detectado: ${pub.prazo_detectado ? 'sim' : 'não'}${pub.prazo_dias ? ` (${pub.prazo_dias} dias)` : ''}${pub.prazo_data ? ` - data ${pub.prazo_data}` : ''}`,
      `   Descrição do prazo: ${resumoSeguro(pub.prazo_descricao, 180) ?? 'não informada'}`,
      `   Audiência detectada: ${pub.audiencia_detectada ? 'sim' : 'não'}${pub.audiencia_data ? ` - data ${pub.audiencia_data}` : ''}`,
      `   Descrição da audiência: ${resumoSeguro(pub.audiencia_descricao, 180) ?? 'não informada'}`,
      `   Origem: ${pub.origem}`,
    ].join('\n')
  })

  return [
    'CONTEXTO DO SISTEMA - PUBLICAÇÕES',
    'Fonte: tabela publicacoes do sistema interno do Pessoa e do Val Advocacia.',
    'Campos sensíveis e texto_publicacao completo foram omitidos por segurança.',
    `Total encontrado: ${publicacoes.length}`,
    `Com prazo detectado: ${totalPrazo}`,
    `Com audiência detectada: ${totalAudiencia}`,
    `Pendentes de triagem/não tratadas: ${totalPendentes}`,
    '',
    ...linhas,
  ].join('\n')
}
