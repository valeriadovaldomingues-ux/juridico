import type { DadosDocumento } from '../schema'

export function modeloContratoAcaoIsolada(dados: DadosDocumento): string[] {
  return [
    'CONTRATO DE PRESTACAO DE SERVICOS ADVOCATICIOS - ACAO ISOLADA',
    `Contratante: ${dados.nomeRazaoSocial || '[informar cliente]'}`,
    `CPF/CNPJ: ${dados.cpfCnpj || '[informar CPF/CNPJ]'}`,
    `Endereco: ${dados.endereco || '[informar endereco]'}`,
    `Parte contraria: ${dados.parteContraria || '[informar parte contraria]'}`,
    `Processo: ${dados.processo || '[informar se houver]'}`,
    '',
    'Objetivo do contrato',
    dados.objeto || '[informar objetivo da contratacao]',
    '',
    'Honorarios',
    dados.honorarios || '[informar honorarios fixos, parcelados e/ou percentual de exito]',
    `Vencimento: ${dados.vencimento || '[informar vencimento]'}`,
    `Primeira parcela: ${dados.primeiraParcela || '[informar primeira parcela]'}`,
    `Foro: ${dados.foro || '[informar foro]'}`,
    '',
    'Observacao de revisao',
    'Minuta gerada para revisao humana obrigatoria antes de assinatura.',
  ]
}
