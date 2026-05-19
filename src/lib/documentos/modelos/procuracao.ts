import type { DadosDocumento } from '../schema'

export function modeloProcuracao(dados: DadosDocumento): string[] {
  const poderesEspeciais = dados.poderesProcuracao.length
    ? dados.poderesProcuracao.join('; ')
    : '[selecionar poderes especiais, se necessários]'

  return [
    'PROCURAÇÃO AD JUDICIA ET EXTRA',
    `Outorgante: ${dados.nomeRazaoSocial || '[informar outorgante]'}`,
    `Qualificação: ${dados.clienteTipo === 'pj' ? 'Pessoa jurídica' : dados.clienteTipo === 'pf' ? 'Pessoa física' : '[informar PF/PJ]'}`,
    `CPF/CNPJ: ${dados.cpfCnpj || '[informar CPF/CNPJ]'}`,
    `Endereço: ${dados.endereco || '[informar endereço]'}`,
    `Representante legal: ${dados.representanteLegal || '[se aplicável]'}`,
    '',
    'Outorgados',
    'Cristiano Pessoa Sousa — OAB/MG 88.465',
    'Valéria Ferreira do Val Domingues Pessoa — OAB/MG 98.185',
    '',
    'Poderes',
    'O outorgante nomeia e constitui seus procuradores para o foro em geral, com poderes da cláusula ad judicia, podendo propor ações, defender direitos, acompanhar processos, receber intimações, firmar requerimentos, substabelecer, receber documentos e praticar os atos necessários à defesa de seus interesses.',
    '',
    'Poderes ad extra e especiais',
    poderesEspeciais,
    '',
    'Revisão obrigatória antes da geração',
    `Documento conferido por: ${dados.nomeRevisor || '[informar responsável pela revisão]'}.`,
  ]
}
