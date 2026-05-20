import type { FonteMonitoramento } from './types'
import { FONTE_TRT3_MG } from './trt3-mg'
import { buscarPublicacoesTRTDJEN } from '@/lib/monitoramento/trt3-djen'

export const TRTS_DJEN_VALIDADOS = Array.from({ length: 24 }, (_, i) => i + 1)

function fonteTRTDJEN(numero: number): FonteMonitoramento {
  const tribunal = `TRT${numero}`

  return {
    id: `trt${numero}`,
    nome: tribunal,
    tribunal,
    ramo: 'trabalhista',
    status: 'ativo',
    descricao: 'Ativo via DJEN/CNJ: API pública de comunicações processuais validada sem credencial, filtrada por data, OAB, processo e nomes monitorados.',
    executar: async contexto => {
      try {
        const publicacoes = await buscarPublicacoesTRTDJEN({
          tribunal,
          nomes: contexto.nomes,
          processos: contexto.processos,
          oabs: contexto.oabs,
          data: contexto.data,
        })

        return {
          fonte_id: `trt${numero}`,
          fonte_nome: tribunal,
          tribunal,
          ramo: 'trabalhista',
          status: 'ativo',
          encontradas: publicacoes.length,
          inseridas: 0,
          duplicadas: 0,
          ignoradas: 0,
          falhas: 0,
          publicacoes: publicacoes.map(pub => ({
            fonte_id: `trt${numero}`,
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
          mensagem: `${tribunal} ativo via DJEN/CNJ. DEJT específico permanece pendente de validação por tribunal.`,
        }
      } catch (error) {
        return {
          fonte_id: `trt${numero}`,
          fonte_nome: tribunal,
          tribunal,
          ramo: 'trabalhista',
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

export const FONTES_TRTS: FonteMonitoramento[] = Array.from({ length: 24 }, (_, i) => {
  const numero = i + 1
  if (numero === 3) return FONTE_TRT3_MG
  if (TRTS_DJEN_VALIDADOS.includes(numero)) return fonteTRTDJEN(numero)

  return {
    id: `trt${numero}`,
    nome: `TRT${numero}`,
    tribunal: `TRT${numero}`,
    ramo: 'trabalhista',
    status: 'pendente',
    descricao: 'Pendente de validação operacional. DJEN/CNJ retornou limite de requisições na validação inicial; DEJT, PJe, DataJud ou API específica exigem análise posterior.',
  }
})
