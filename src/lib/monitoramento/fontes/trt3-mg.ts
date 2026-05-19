import type { FonteMonitoramento, StatusFonteMonitoramento } from './types'

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
    status: 'pendente',
    observacao: 'Diário Eletrônico da Justiça do Trabalho. Requer validação de consulta pública estável e estratégia de busca por nome/OAB.',
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
  status: 'pendente',
  descricao: 'Piloto trabalhista de Minas Gerais. Fontes mapeadas: DEJT, DJEN e PJe-JT. Captura ainda pendente de implementação real, validação de acesso público e regras de limite por fonte.',
}
