import {
  TRIBUNAIS_POR_UF,
  TRIBUNAIS_SUPERIORES,
} from '@/lib/monitoramento/datajud'
import type {
  ContextoFonteMonitoramento,
  FonteMonitoramento,
  ResultadoMonitoramento,
  StatusFonteMonitoramento,
} from './types'

export const ALIASES_DATAJUD = [
  ...new Set([
    ...Object.values(TRIBUNAIS_POR_UF).flat().map(tribunal => tribunal.sigla),
    ...TRIBUNAIS_SUPERIORES.map(tribunal => tribunal.sigla),
  ]),
].sort()

function statusDataJud(): StatusFonteMonitoramento {
  return process.env.DATAJUD_API_KEY ? 'preparado' : 'requer_credencial'
}

export async function executarMonitoramentoDataJud(
  _contexto: ContextoFonteMonitoramento,
): Promise<ResultadoMonitoramento> {
  const status = statusDataJud()

  return {
    fonte_id: 'datajud-cnj',
    fonte_nome: 'DataJud CNJ',
    tribunal: 'CNJ',
    ramo: 'datajud',
    status,
    encontradas: 0,
    inseridas: 0,
    duplicadas: 0,
    ignoradas: 0,
    falhas: status === 'requer_credencial' ? 1 : 0,
    publicacoes: [],
    mensagem: status === 'requer_credencial'
      ? 'DataJud CNJ requer DATAJUD_API_KEY. A fonte não foi executada.'
      : 'DataJud CNJ está preparado para metadados e movimentações, mas ainda não grava publicações de diário nesta fase.',
  }
}

export function fonteDataJud(): FonteMonitoramento {
  const status = statusDataJud()

  return {
    id: 'datajud-cnj',
    nome: 'DataJud CNJ',
    tribunal: 'CNJ',
    ramo: 'datajud',
    status,
    requerCredencial: status === 'requer_credencial',
    descricao: `Fonte oficial para metadados e movimentações processuais. Aliases preparados: ${ALIASES_DATAJUD.join(', ')}. Não substitui publicação integral de diário.`,
    executar: executarMonitoramentoDataJud,
  }
}
