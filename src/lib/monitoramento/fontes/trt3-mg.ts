import type { FonteMonitoramento, StatusFonteMonitoramento } from './types'
import { buscarPublicacoesTRT3DEJT } from '@/lib/monitoramento/trt3-dejt'

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
    status: 'pendente',
    observacao: 'Diário de Justiça Eletrônico Nacional. Requer validação da cobertura trabalhista e formato de consulta disponível.',
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
  descricao: 'Piloto trabalhista de Minas Gerais. Ativo parcial pelo DEJT público; DJEN permanece pendente de endpoint público validado; PJe-JT requer credencial.',
  executar: async contexto => {
    try {
      const publicacoes = await buscarPublicacoesTRT3DEJT({
        nomes: contexto.nomes,
        processos: contexto.processos,
        oabs: contexto.oabs,
        data: contexto.data,
      })

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
          diario: 'DEJT',
          data_publicacao: pub.data_publicacao,
          nome_pesquisado: pub.nome_pesquisado,
          texto_publicacao: pub.texto_publicacao,
          origem: pub.origem,
          termo_encontrado: pub.termo_encontrado,
        })),
        mensagem: 'TRT3/MG ativo parcial: captura real pelo DEJT. DJEN pendente e PJe-JT requer credencial.',
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
        mensagem: 'Falha na captura pública do DEJT TRT3. DJEN segue pendente e PJe-JT requer credencial.',
      }
    }
  },
}
