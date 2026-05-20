import type { FonteMonitoramento } from './types'
import { buscarPublicacoesTJSPDJEN } from '@/lib/monitoramento/tjsp-djen'

const TJS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ',
  'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]

function fonteTJSP(): FonteMonitoramento {
  return {
    id: 'tjsp',
    nome: 'TJSP',
    tribunal: 'TJSP',
    ramo: 'estadual',
    status: 'ativo',
    descricao: 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada sem credencial. e-SAJ direto permanece pendente por depender de fluxo HTML com sessão.',
    executar: async contexto => {
      try {
        const publicacoes = await buscarPublicacoesTJSPDJEN({
          nomes: contexto.nomes,
          processos: contexto.processos,
          oabs: contexto.oabs,
          data: contexto.data,
        })

        return {
          fonte_id: 'tjsp',
          fonte_nome: 'TJSP',
          tribunal: 'TJSP',
          ramo: 'estadual',
          status: 'ativo',
          encontradas: publicacoes.length,
          inseridas: 0,
          duplicadas: 0,
          ignoradas: 0,
          falhas: 0,
          publicacoes: publicacoes.map(pub => ({
            fonte_id: 'tjsp',
            numero_processo: pub.numero_processo,
            tribunal: pub.tribunal,
            orgao: pub.orgao,
            diario: 'DJEN',
            data_publicacao: pub.data_publicacao,
            nome_pesquisado: pub.nome_pesquisado,
            texto_publicacao: pub.texto_publicacao,
            origem: pub.origem,
            termo_encontrado: pub.termo_encontrado,
          })),
          mensagem: 'TJSP ativo via DJEN/CNJ. e-SAJ direto permanece pendente.',
        }
      } catch (error) {
        return {
          fonte_id: 'tjsp',
          fonte_nome: 'TJSP',
          tribunal: 'TJSP',
          ramo: 'estadual',
          status: 'erro',
          encontradas: 0,
          inseridas: 0,
          duplicadas: 0,
          ignoradas: 0,
          falhas: 1,
          publicacoes: [],
          erro: error instanceof Error ? error.message : String(error),
          mensagem: 'Falha na captura pública DJEN/CNJ para TJSP.',
        }
      }
    },
  }
}

export const FONTES_TJS: FonteMonitoramento[] = TJS.map(tribunal => {
  if (tribunal === 'TJSP') return fonteTJSP()

  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'estadual',
    status: 'pendente',
    descricao: 'Pendente de integração por diário oficial, DataJud ou API oficial do tribunal.',
  }
})
