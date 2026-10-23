// ─── Fonte consolidada: DJEN — Diário de Justiça Eletrônico Nacional ─────────
//
// Uma única fonte que cobre TODOS os tribunais integrados ao DJEN em poucas
// consultas: a API pública do CNJ aceita busca por OAB sem sigla de tribunal,
// retornando as comunicações de todos os tribunais com paginação por `count`.
// Substitui, para efeito de captura, o fan-out de dezenas de consultas por
// tribunal (que permanece disponível para execução individual).

import { criarProviderDJEN } from '../djen/provider'
import { montarConsultasDJEN, type AdvogadoMonitoradoDJEN } from '../djen/consultas'
import { DJEN_FONTE_CODIGO, DJEN_FONTE_NOME } from '../djen/types'
import { normalizarOAB, chaveOAB } from '../oab'
import type {
  ContextoFonteMonitoramento,
  FonteMonitoramento,
  PublicacaoCapturada,
  ResultadoMonitoramento,
} from './types'

import type { ItemEncontradoDJEN, PublicacaoDJENNormalizada } from '../djen/types'

const RETROATIVO_PADRAO_DIAS = 3

/** Converte uma publicação normalizada do provider no formato de captura do pipeline. */
export function mapearNormalizadaParaCapturada(
  normalizada: PublicacaoDJENNormalizada,
  encontrado: ItemEncontradoDJEN,
  dataFallback: string,
): PublicacaoCapturada {
  return {
    fonte_id: DJEN_FONTE_CODIGO,
    fonte_codigo: DJEN_FONTE_CODIGO,
    numero_processo: normalizada.numero_processo,
    tribunal: normalizada.tribunal ?? 'DJEN',
    orgao: normalizada.orgao,
    diario: 'DJEN',
    data_publicacao: normalizada.data_disponibilizacao ?? dataFallback,
    data_disponibilizacao: normalizada.data_disponibilizacao,
    nome_pesquisado: normalizada.nome_pesquisado,
    texto_publicacao: normalizada.texto,
    origem: 'djen',
    termo_encontrado: normalizada.termo_encontrado,
    id_externo: normalizada.id_externo,
    url_oficial: normalizada.url_oficial,
    tipo_comunicacao: normalizada.tipo_comunicacao,
    partes: normalizada.partes,
    advogados_publicacao: normalizada.advogados,
    advogado_monitorado_id: normalizada.advogado_monitorado_id || null,
    oab_pesquisada: encontrado.consulta.tipo === 'oab' ? encontrado.consulta.termo : null,
    hash_precomputado: normalizada.hash,
    dados_brutos: normalizada.dados_brutos,
  }
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function subtrairDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  data.setUTCDate(data.getUTCDate() - dias)
  return data.toISOString().slice(0, 10)
}

function retroativoConfigurado(): number {
  const valor = Number(process.env.DJEN_RETROATIVO_DIAS)
  return Number.isFinite(valor) && valor >= 0 && valor <= 30 ? valor : RETROATIVO_PADRAO_DIAS
}

/** Reconstrói advogados a partir das strings de OAB quando o cadastro completo não veio no contexto. */
function advogadosDoContexto(contexto: ContextoFonteMonitoramento): AdvogadoMonitoradoDJEN[] {
  if (contexto.advogados?.length) {
    return contexto.advogados.map(adv => ({ ...adv }))
  }

  const vistos = new Set<string>()
  const advogados: AdvogadoMonitoradoDJEN[] = []
  for (const oabRaw of contexto.oabs ?? []) {
    const oab = normalizarOAB(oabRaw, 'MG')
    if (!oab) continue
    const chave = chaveOAB(oab)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    advogados.push({
      id: '',
      nome_completo: chave,
      oab_numero: oab.numero,
      oab_uf: oab.uf,
    })
  }
  return advogados
}

async function executarDJEN(contexto: ContextoFonteMonitoramento): Promise<ResultadoMonitoramento> {
  const base: Omit<ResultadoMonitoramento, 'status' | 'publicacoes'> = {
    fonte_id: DJEN_FONTE_CODIGO,
    fonte_nome: DJEN_FONTE_NOME,
    tribunal: 'Todos (CNJ)',
    ramo: 'nacional',
    encontradas: 0,
    inseridas: 0,
    duplicadas: 0,
    ignoradas: 0,
    falhas: 0,
  }

  const fim = contexto.data?.trim() || hojeSaoPaulo()
  const retro = contexto.retroativoDias ?? retroativoConfigurado()
  const inicio = subtrairDias(fim, retro)
  const advogados = advogadosDoContexto(contexto)

  const consultas = montarConsultasDJEN({
    advogados,
    processos: contexto.processos,
    periodo: { inicio, fim },
  })

  if (consultas.length === 0) {
    return {
      ...base,
      status: 'ativo',
      publicacoes: [],
      mensagem: 'Nenhum critério de busca (OAB, nome ou processo) para consultar no DJEN.',
    }
  }

  const provider = criarProviderDJEN()
  const busca = await provider.searchPublications(consultas, { inicio, fim })

  const vistos = new Set<string>()
  const publicacoes: PublicacaoCapturada[] = []
  for (const encontrado of busca.encontrados) {
    const normalizada = provider.normalizePublication(encontrado)
    if (!normalizada) continue
    if (vistos.has(normalizada.hash)) continue
    vistos.add(normalizada.hash)

    publicacoes.push(mapearNormalizadaParaCapturada(normalizada, encontrado, fim))
  }

  const bloqueado = busca.erros.some(erro => erro.status_http === 403)
  const soFalhas = publicacoes.length === 0 && busca.erros.length > 0

  return {
    ...base,
    status: soFalhas ? 'erro' : 'ativo',
    encontradas: publicacoes.length,
    falhas: busca.erros.length,
    publicacoes,
    mensagem: bloqueado
      ? 'O WAF do CNJ recusou requisições deste servidor (HTTP 403). Use "Consultar DJEN agora" na tela de Monitoramento — a consulta pelo navegador usa a mesma API oficial.'
      : busca.incompleto
        ? `Busca parcial: ${busca.paginas_consultadas} página(s) consultada(s), houve interrupção em parte das consultas.`
        : `Período ${inicio} a ${fim}: ${busca.consultas_realizadas} consulta(s), ${busca.paginas_consultadas} página(s).`,
    erro: soFalhas ? busca.erros.map(item => `${item.consulta}: ${item.mensagem}`).slice(0, 3).join(' | ') : undefined,
  }
}

export const FONTE_DJEN: FonteMonitoramento = {
  id: DJEN_FONTE_CODIGO,
  nome: DJEN_FONTE_NOME,
  tribunal: 'Todos (CNJ)',
  ramo: 'nacional',
  status: 'ativo',
  descricao:
    'Fonte oficial consolidada DJEN/CNJ: uma consulta por OAB cobre todos os tribunais integrados, com paginação e busca retroativa. Canal de publicidade processual — o Domicílio Judicial Eletrônico (citações/intimações pessoais) não está incluído.',
  executar: executarDJEN,
}
