import type { DadosDocumento } from '../schema'

export function modeloHipossuficiencia(dados: DadosDocumento): string[] {
  return [
    'DECLARACAO DE HIPOSSUFICIENCIA',
    `Declarante: ${dados.nomeRazaoSocial || '[informar declarante]'}`,
    `CPF: ${dados.cpfCnpj || '[informar CPF]'}`,
    `Endereco: ${dados.endereco || '[informar endereco]'}`,
    `Processo: ${dados.processo || '[informar se houver]'}`,
    '',
    'Declaracao',
    `Para fins de ${dados.finalidadeHipossuficiencia || '[informar finalidade]'}, o declarante afirma nao possuir condicoes de arcar com custas, despesas processuais e honorarios sem prejuizo de seu sustento ou de sua familia, requerendo os beneficios cabiveis, sob as penas da lei.`,
    '',
    'Observacao de revisao',
    'Minuta gerada para revisao humana obrigatoria antes de assinatura.',
  ]
}
