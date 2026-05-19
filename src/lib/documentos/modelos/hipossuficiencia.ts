import type { DadosDocumento } from '../schema'

export function modeloHipossuficiencia(dados: DadosDocumento): string[] {
  return [
    'DECLARAÇÃO DE HIPOSSUFICIÊNCIA',
    `Declarante: ${dados.nomeRazaoSocial || '[informar declarante]'}`,
    `CPF: ${dados.cpfCnpj || '[informar CPF]'}`,
    `Endereço: ${dados.endereco || '[informar endereço]'}`,
    `Processo: ${dados.processo || '[informar se houver]'}`,
    '',
    'Declaração',
    `Para fins de ${dados.finalidadeHipossuficiencia || '[informar finalidade]'}, o declarante afirma não possuir condições de arcar com custas, despesas processuais e honorários sem prejuízo de seu sustento ou de sua família, requerendo os benefícios cabíveis, sob as penas da lei.`,
    '',
    'Revisão obrigatória antes da geração',
    `Documento conferido por: ${dados.nomeRevisor || '[informar responsável pela revisão]'}.`,
  ]
}
