import type { FonteMonitoramento } from './types'
import { buscarPublicacoesSuperiorDJEN } from '@/lib/monitoramento/superiores-djen'

export const TRIBUNAIS_SUPERIORES_DJEN_ATIVOS = ['STF', 'STJ', 'TST']

function fonteSuperiorDJEN(tribunal: string): FonteMonitoramento {
  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'superior',
    status: 'ativo',
    descricao: 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada com HTTP 200 e JSON válido por siglaTribunal e data.',
    executar: async contexto => {
      try {
        const publicacoes = await buscarPublicacoesSuperiorDJEN({
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
          ramo: 'superior',
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
          ramo: 'superior',
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

export const FONTES_SUPERIORES: FonteMonitoramento[] = TRIBUNAIS_SUPERIORES_DJEN_ATIVOS
  .map(fonteSuperiorDJEN)
