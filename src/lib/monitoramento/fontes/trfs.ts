import type { FonteMonitoramento } from './types'
import { buscarPublicacoesTRFDJEN } from '@/lib/monitoramento/trfs-djen'

export const TRFS_DJEN_ATIVOS = ['TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6']

function fonteTRFDJEN(tribunal: string): FonteMonitoramento {
  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'federal',
    status: 'ativo',
    descricao: 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada com HTTP 200 e JSON válido por siglaTribunal e data.',
    executar: async contexto => {
      try {
        const publicacoes = await buscarPublicacoesTRFDJEN({
          tribunal,
          nomes: contexto.nomes,
          processos: contexto.processos,
          oabs: contexto.oabs,
          data: contexto.data,
        })

        return {
          fonte_id: tribunal.toLowerCase(),
          fonte_nome: tribunal,
          tribunal,
          ramo: 'federal',
          status: 'ativo',
          encontradas: publicacoes.length,
          inseridas: 0,
          duplicadas: 0,
          ignoradas: 0,
          falhas: 0,
          publicacoes: publicacoes.map(pub => ({
            fonte_id: tribunal.toLowerCase(),
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
          mensagem: `${tribunal} ativo via DJEN/CNJ.`,
        }
      } catch (error) {
        return {
          fonte_id: tribunal.toLowerCase(),
          fonte_nome: tribunal,
          tribunal,
          ramo: 'federal',
          status: 'erro',
          encontradas: 0,
          inseridas: 0,
          duplicadas: 0,
          ignoradas: 0,
          falhas: 1,
          publicacoes: [],
          erro: error instanceof Error ? error.message : String(error),
          mensagem: `Falha na captura pública DJEN/CNJ para ${tribunal}.`,
        }
      }
    },
  }
}

export const FONTES_TRFS: FonteMonitoramento[] = Array.from({ length: 6 }, (_, i) => {
  const numero = i + 1
  const tribunal = `TRF${numero}`
  if (TRFS_DJEN_ATIVOS.includes(tribunal)) return fonteTRFDJEN(tribunal)

  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'federal',
    status: 'pendente',
    descricao: 'Pendente de integração por fonte oficial. Onde houver eproc, a execução exigirá análise de acesso público e credenciais.',
  }
})
