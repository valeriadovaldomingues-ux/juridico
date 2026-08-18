// ─── Montagem de consultas agrupadas ao DJEN ─────────────────────────────────
//
// Módulo puro (sem dependências de servidor) — usado tanto pela fonte
// server-side quanto pela captura via navegador ("Consultar DJEN agora").
// A API aceita consulta por OAB SEM tribunal, cobrindo todos os tribunais em
// uma única requisição paginada — sempre agrupar dessa forma.

import { chaveOAB, normalizarOAB } from '../oab'
import { normalizarNumeroCNJ } from '../cnj'
import type { ConsultaDJEN, PeriodoConsulta } from './types'

export const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
export const DJEN_ITENS_POR_PAGINA = 100
/** Teto de consultas por execução (proteção contra rate limit). */
export const DJEN_MAX_CONSULTAS = 40

export interface AdvogadoMonitoradoDJEN {
  id: string
  nome_completo: string
  oab_numero: string
  oab_uf: string
  ativo?: boolean
  termos_adicionais?: string[] | null
  variacoes_nome?: string[] | null
  tribunais_interesse?: string[] | null
}

function paramsBase(periodo: PeriodoConsulta) {
  return {
    itensPorPagina: String(DJEN_ITENS_POR_PAGINA),
    dataDisponibilizacaoInicio: periodo.inicio,
    dataDisponibilizacaoFim: periodo.fim,
  }
}

/**
 * Monta o conjunto mínimo de consultas que cobre os advogados monitorados:
 *  1 consulta por OAB distinta (todos os tribunais de uma vez) e, quando o
 *  advogado tem tribunais de interesse, uma consulta restrita por sigla.
 *  Números de processo entram como consultas individuais por numeroProcesso.
 */
export function montarConsultasDJEN(opcoes: {
  advogados: AdvogadoMonitoradoDJEN[]
  processos?: string[]
  periodo: PeriodoConsulta
}): ConsultaDJEN[] {
  const consultas: ConsultaDJEN[] = []
  const oabsVistas = new Set<string>()

  for (const advogado of opcoes.advogados) {
    if (advogado.ativo === false) continue

    const oab = normalizarOAB(`${advogado.oab_uf} ${advogado.oab_numero}`, advogado.oab_uf)
    if (!oab) continue

    const chave = chaveOAB(oab)
    if (oabsVistas.has(chave)) continue
    oabsVistas.add(chave)

    const tribunais = (advogado.tribunais_interesse ?? []).filter(Boolean)
    const base = {
      tipo: 'oab' as const,
      termo: chave,
      advogado_monitorado_id: advogado.id,
    }

    if (tribunais.length === 0) {
      consultas.push({
        ...base,
        params: {
          ...paramsBase(opcoes.periodo),
          numeroOab: oab.numero,
          ufOab: oab.uf,
        },
      })
    } else {
      for (const tribunal of tribunais) {
        consultas.push({
          ...base,
          siglaTribunal: tribunal.toUpperCase(),
          params: {
            ...paramsBase(opcoes.periodo),
            numeroOab: oab.numero,
            ufOab: oab.uf,
            siglaTribunal: tribunal.toUpperCase(),
          },
        })
      }
    }
  }

  for (const processo of opcoes.processos ?? []) {
    const digitos = normalizarNumeroCNJ(processo)
    if (!digitos) continue
    consultas.push({
      tipo: 'processo',
      termo: processo,
      params: {
        ...paramsBase(opcoes.periodo),
        numeroProcesso: digitos,
      },
    })
  }

  return consultas.slice(0, DJEN_MAX_CONSULTAS)
}

/** URL completa de uma página de consulta (pagina é 1-based na API). */
export function urlConsultaDJEN(consulta: ConsultaDJEN, pagina: number): string {
  const params = new URLSearchParams({ ...consulta.params, pagina: String(pagina) })
  return `${DJEN_API_URL}?${params.toString()}`
}
