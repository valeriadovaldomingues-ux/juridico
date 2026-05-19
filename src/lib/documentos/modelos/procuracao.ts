import type { DadosDocumento } from '../schema'

export function modeloProcuracao(dados: DadosDocumento): string[] {
  const poderesEspeciais = dados.poderesProcuracao.length
    ? dados.poderesProcuracao.join('; ')
    : '[selecionar poderes especiais, se necessarios]'

  return [
    'PROCURACAO AD JUDICIA ET EXTRA',
    `Outorgante: ${dados.nomeRazaoSocial || '[informar outorgante]'}`,
    `Qualificacao: ${dados.clienteTipo === 'pj' ? 'Pessoa juridica' : dados.clienteTipo === 'pf' ? 'Pessoa fisica' : '[informar PF/PJ]'}`,
    `CPF/CNPJ: ${dados.cpfCnpj || '[informar CPF/CNPJ]'}`,
    `Endereco: ${dados.endereco || '[informar endereco]'}`,
    `Representante legal: ${dados.representanteLegal || '[se aplicavel]'}`,
    '',
    'Poderes',
    'O outorgante nomeia e constitui seus procuradores para o foro em geral, com poderes da clausula ad judicia, podendo propor acoes, defender direitos, acompanhar processos, receber intimacoes, firmar requerimentos e praticar os atos necessarios a defesa de seus interesses.',
    '',
    'Poderes ad extra e especiais',
    poderesEspeciais,
    '',
    'Observacao de revisao',
    'Minuta gerada para revisao humana obrigatoria antes de assinatura.',
  ]
}
