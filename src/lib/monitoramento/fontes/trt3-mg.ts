import type { FonteMonitoramento, StatusFonteMonitoramento } from './types'
import { buscarPublicacoesTRT3DEJT } from '@/lib/monitoramento/trt3-dejt'
import { buscarPublicacoesTRT3DJEN } from '@/lib/monitoramento/trt3-djen'

export type CanalMonitoramentoTRT3 = {
  id: 'dejt' | 'djen' | 'pje-jt'
  nome: string
  status: StatusFonteMonitoramento
  observacao: string
}

export const CANAIS_TRT3_MG: CanalMonitoramentoTRT3[] = [
  {
    id: 'dejt',
    nome: 'DEJT',
    status: 'ativo',
    observacao: 'Diário Eletrônico da Justiça do Trabalho. Captura inicial real pelo caderno público do TRT3, filtrada por nomes, OABs e processos monitorados.',
  },
  {
    id: 'djen',
    nome: 'DJEN',
    status: 'ativo',
    observacao: 'Diário de Justiça Eletrônico Nacional. Captura real pela API pública de comunicações processuais do CNJ, limitada ao TRT3 e aos termos monitorados.',
  },
  {
    id: 'pje-jt',
    nome: 'PJe-JT',
    status: 'requer_credencial',
    observacao: 'Consulta processual pode exigir sessão, login, captcha, certificado ou perfil autorizado; não deve ser automatizada sem credencial e validação jurídica/técnica.',
  },
]

export const FONTE_TRT3_MG: FonteMonitoramento = {
  id: 'trt3',
  nome: 'TRT3/MG',
  tribunal: 'TRT3',
  ramo: 'trabalhista',
  status: 'ativo',
  descricao: 'Piloto trabalhista de Minas Gerais. Ativo parcial pelo DEJT público e pela API pública DJEN/CNJ; PJe-JT requer credencial.',
  executar: async contexto => {
    try {
      const [dejt, djen] = await Promise.all([
        buscarPublicacoesTRT3DEJT({
          nomes: contexto.nomes,
          processos: contexto.processos,
          oabs: contexto.oabs,
          data: contexto.data,
        }),
        buscarPublicacoesTRT3DJEN({
          nomes: contexto.nomes,
          processos: contexto.processos,
          oabs: contexto.oabs,
          data: contexto.data,
        }),
      ])
      const publicacoes = [...dejt, ...djen]

      return {
        fonte_id: 'trt3',
        fonte_nome: 'TRT3/MG',
        tribunal: 'TRT3',
        ramo: 'trabalhista',
        status: 'ativo',
        encontradas: publicacoes.length,
        inseridas: 0,
        duplicadas: 0,
        ignoradas: 0,
        falhas: 0,
        publicacoes: publicacoes.map(pub => ({
          fonte_id: 'trt3',
          numero_processo: pub.numero_processo,
          tribunal: pub.tribunal,
          orgao: pub.orgao,
          diario: pub.origem === 'trt3_djen' ? 'DJEN' : 'DEJT',
          data_publicacao: pub.data_publicacao,
          nome_pesquisado: pub.nome_pesquisado,
          texto_publicacao: pub.texto_publicacao,
          origem: pub.origem,
          termo_encontrado: pub.termo_encontrado,
        })),
        mensagem: 'TRT3/MG ativo parcial: captura real pelo DEJT e DJEN/CNJ. PJe-JT requer credencial.',
      }
    } catch (error) {
      return {
        fonte_id: 'trt3',
        fonte_nome: 'TRT3/MG',
        tribunal: 'TRT3',
        ramo: 'trabalhista',
        status: 'erro',
        encontradas: 0,
        inseridas: 0,
        duplicadas: 0,
        ignoradas: 0,
        falhas: 1,
        publicacoes: [],
        erro: error instanceof Error ? error.message : String(error),
        mensagem: 'Falha na captura pública do TRT3. DEJT e DJEN/CNJ são fontes públicas; PJe-JT requer credencial.',
      }
    }
  },
}

export const FONTE_TRT3_DJEN: FonteMonitoramento = {
  id: 'trt3-djen',
  nome: 'TRT3/MG DJEN',
  tribunal: 'TRT3',
  ramo: 'trabalhista',
  status: 'ativo',
  descricao: 'DJEN do TRT3 pela API pública de comunicações processuais do CNJ, filtrado por data, OAB, processo e nomes monitorados.',
  executar: async contexto => {
    try {
      const publicacoes = await buscarPublicacoesTRT3DJEN({
        nomes: contexto.nomes,
        processos: contexto.processos,
        oabs: contexto.oabs,
        data: contexto.data,
      })

      return {
        fonte_id: 'trt3-djen',
        fonte_nome: 'TRT3/MG DJEN',
        tribunal: 'TRT3',
        ramo: 'trabalhista',
        status: 'ativo',
        encontradas: publicacoes.length,
        inseridas: 0,
        duplicadas: 0,
        ignoradas: 0,
        falhas: 0,
        publicacoes: publicacoes.map(pub => ({
          fonte_id: 'trt3-djen',
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
        mensagem: 'TRT3/MG DJEN ativo pela API pública de comunicações processuais do CNJ.',
      }
    } catch (error) {
      return {
        fonte_id: 'trt3-djen',
        fonte_nome: 'TRT3/MG DJEN',
        tribunal: 'TRT3',
        ramo: 'trabalhista',
        status: 'erro',
        encontradas: 0,
        inseridas: 0,
        duplicadas: 0,
        ignoradas: 0,
        falhas: 1,
        publicacoes: [],
        erro: error instanceof Error ? error.message : String(error),
        mensagem: 'Falha na captura pública do DJEN/CNJ para TRT3.',
      }
    }
  },
}
