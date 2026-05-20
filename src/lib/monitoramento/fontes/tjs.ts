import type { FonteMonitoramento } from './types'
import { buscarPublicacoesTJDJEN } from '@/lib/monitoramento/tjs-djen'

const TJS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ',
  'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]

export const TJS_DJEN_ATIVOS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ',
  'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]

export const TJS_DJEN_PENDENTES_RATE_LIMIT: string[] = []

function fonteTJDJEN(tribunal: string): FonteMonitoramento {
  const isTJSP = tribunal === 'TJSP'
  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'estadual',
    status: 'ativo',
    descricao: isTJSP
      ? 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada sem credencial. e-SAJ direto permanece pendente por depender de fluxo HTML com sessão.'
      : 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada com HTTP 200 e JSON válido por siglaTribunal e data.',
    executar: async contexto => {
      try {
        const publicacoes = await buscarPublicacoesTJDJEN({
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
          ramo: 'estadual',
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
          mensagem: isTJSP
            ? 'TJSP ativo via DJEN/CNJ. e-SAJ direto permanece pendente.'
            : `${tribunal} ativo via DJEN/CNJ.`,
        }
      } catch (error) {
        return {
          fonte_id: tribunal.toLowerCase(),
          fonte_nome: tribunal,
          tribunal,
          ramo: 'estadual',
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

export const FONTES_TJS: FonteMonitoramento[] = TJS.map(tribunal => {
  if (TJS_DJEN_ATIVOS.includes(tribunal)) return fonteTJDJEN(tribunal)

  return {
    id: tribunal.toLowerCase(),
    nome: tribunal,
    tribunal,
    ramo: 'estadual',
    status: 'pendente',
    descricao: 'Pendente de integração por diário oficial, DataJud ou API oficial do tribunal.',
  }
})
