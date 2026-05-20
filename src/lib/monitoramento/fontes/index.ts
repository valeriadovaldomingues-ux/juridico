import { fonteDataJud } from './datajud'
import { FONTE_EPROC } from './eproc'
import { FONTE_ESAJ } from './esaj'
import { FONTE_PJE } from './pje'
import { FONTES_SUPERIORES } from './superiores'
import { FONTE_TJMG_DJE } from './tjmg-dje'
import { FONTE_TRT3_DJEN } from './trt3-mg'
import { FONTES_TJS } from './tjs'
import { FONTES_TRFS } from './trfs'
import { FONTES_TRTS } from './trts'
import type {
  FiltroFontesMonitoramento,
  FonteMonitoramento,
  FonteMonitoramentoResumo,
} from './types'
export { MATRIZ_FONTES_MONITORAMENTO } from './status-pendentes'

export type {
  ContextoFonteMonitoramento,
  FiltroFontesMonitoramento,
  FonteMonitoramento,
  FonteMonitoramentoResumo,
  PublicacaoCapturada,
  ResultadoMonitoramento,
  RamoFonteMonitoramento,
  StatusFonteMonitoramento,
} from './types'

export function listarFontesMonitoramento(): FonteMonitoramento[] {
  return [
    FONTE_TJMG_DJE,
    fonteDataJud(),
    FONTE_EPROC,
    FONTE_ESAJ,
    FONTE_PJE,
    ...FONTES_TRTS,
    ...FONTES_TRFS,
    ...FONTES_SUPERIORES,
    ...FONTES_TJS,
  ]
}

export function listarResumoFontesMonitoramento(): FonteMonitoramentoResumo[] {
  return listarFontesMonitoramento().map(({ executar: _executar, ...fonte }) => ({
    ...fonte,
    ultima_execucao: null,
    total_encontrado: null,
    total_inserido: null,
    total_ignorado: null,
    erro: null,
  }))
}

export function selecionarFontesMonitoramento(
  filtro: FiltroFontesMonitoramento = {},
): FonteMonitoramento[] {
  const fontes = listarFontesMonitoramento()
  const fonte = filtro.fonte?.trim().toLowerCase()
  const tribunal = filtro.tribunal?.trim().toLowerCase()
  const ramo = filtro.ramo?.trim().toLowerCase()

  if (fonte) {
    if (fonte === 'trt3-dejt') {
      return fontes.filter(item => item.id === 'trt3')
    }
    if (fonte === 'trt3-djen') {
      return [FONTE_TRT3_DJEN]
    }
    if (fonte === 'esaj-tjsp') {
      return [{
        id: 'esaj-tjsp',
        nome: 'e-SAJ TJSP',
        tribunal: 'TJSP',
        ramo: 'estadual',
        status: 'pendente',
        descricao: 'e-SAJ/TJSP direto permanece pendente: fluxo público validado como HTML com estado de sessão; monitoramento TJSP ativo usa DJEN/CNJ.',
      }]
    }
    return fontes.filter(item => item.id.toLowerCase() === fonte)
  }

  if (tribunal) {
    return fontes.filter(item => item.tribunal.toLowerCase() === tribunal)
  }

  if (ramo) {
    return fontes.filter(item => item.ramo.toLowerCase() === ramo)
  }

  return fontes.filter(item => item.status === 'ativo')
}

export function fontePodeExecutar(fonte: FonteMonitoramento): boolean {
  return fonte.status === 'ativo' && typeof fonte.executar === 'function'
}
