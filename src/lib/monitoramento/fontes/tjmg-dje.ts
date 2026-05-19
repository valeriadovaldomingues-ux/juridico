import {
  buscarPublicacoesTJMG,
} from '@/lib/monitoramento/tjmg-dje'
import type {
  ContextoFonteMonitoramento,
  FonteMonitoramento,
  ResultadoMonitoramento,
} from './types'

export async function executarMonitoramentoTJMGDJe(
  contexto: ContextoFonteMonitoramento,
): Promise<ResultadoMonitoramento> {
  try {
    const publicacoes = await buscarPublicacoesTJMG(contexto.nomes)

    return {
      fonte_id: 'tjmg-dje',
      fonte_nome: 'TJMG DJe',
      tribunal: 'TJMG',
      ramo: 'estadual',
      status: 'ativo',
      encontradas: publicacoes.length,
      inseridas: 0,
      duplicadas: 0,
      ignoradas: 0,
      falhas: 0,
      publicacoes: publicacoes.map(pub => ({
        fonte_id: 'tjmg-dje',
        numero_processo: pub.numero_processo || null,
        tribunal: pub.tribunal,
        orgao: pub.orgao || null,
        diario: 'TJMG DJe',
        data_publicacao: pub.data_publicacao,
        nome_pesquisado: pub.nome_pesquisado,
        texto_publicacao: pub.texto_publicacao,
        origem: 'datajud_nome',
        termo_encontrado: pub.nome_pesquisado,
      })),
    }
  } catch (error) {
    return {
      fonte_id: 'tjmg-dje',
      fonte_nome: 'TJMG DJe',
      tribunal: 'TJMG',
      ramo: 'estadual',
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
}

export const FONTE_TJMG_DJE: FonteMonitoramento = {
  id: 'tjmg-dje',
  nome: 'TJMG DJe',
  tribunal: 'TJMG',
  ramo: 'estadual',
  status: 'ativo',
  descricao: 'Diário do Judiciário Eletrônico do TJMG por nome dos advogados monitorados.',
  executar: executarMonitoramentoTJMGDJe,
}
