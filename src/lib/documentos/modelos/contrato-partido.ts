import type { DadosDocumento } from '../schema'

export function modeloContratoPartido(dados: DadosDocumento): string[] {
  return [
    'CONTRATO DE PRESTACAO DE SERVICOS ADVOCATICIOS - ADVOCACIA DE PARTIDO',
    `Contratante: ${dados.nomeRazaoSocial || '[informar cliente]'}`,
    `Qualificacao: ${dados.clienteTipo === 'pj' ? 'Pessoa juridica' : dados.clienteTipo === 'pf' ? 'Pessoa fisica' : '[informar PF/PJ]'}`,
    `CPF/CNPJ: ${dados.cpfCnpj || '[informar CPF/CNPJ]'}`,
    `Endereco: ${dados.endereco || '[informar endereco]'}`,
    `Representante legal: ${dados.representanteLegal || '[se aplicavel]'}`,
    `CNPJ para emissao de boletos: ${dados.cnpjBoletos || '[informar se diverso]'}`,
    '',
    'Objeto',
    dados.objeto || 'Prestacao recorrente de servicos juridicos consultivos e contenciosos, observadas as areas contratadas e excluidas.',
    '',
    'Areas excluidas',
    dados.areasExcluidas || '[informar areas excluidas]',
    '',
    'Honorarios',
    `Valor dos honorarios mensais: ${dados.honorarios || '[informar valor]'}`,
    `Dia de vencimento: ${dados.vencimento || '[informar dia]'}`,
    `Primeira parcela: ${dados.primeiraParcela || '[informar primeira parcela]'}`,
    `Vigencia: ${dados.vigenciaInicio || '[inicio]'} a ${dados.vigenciaFim || '[fim/indeterminada]'}`,
    `Percentual de exito: ${dados.percentualExito || '[informar percentual]'}`,
    dados.parcelaAdicionalDezembro
      ? 'Parcela adicional anual em dezembro: Sim - parcela extra equivalente aos honorarios mensais.'
      : 'Parcela adicional anual em dezembro: Nao informado ou nao aplicavel.',
    '',
    'Observacao de revisao',
    'Minuta gerada para revisao humana obrigatoria antes de assinatura.',
  ]
}
