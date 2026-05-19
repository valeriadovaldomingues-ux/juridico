import type { DadosDocumento } from '../schema'

function valorOuCampo(valor: string, campo: string) {
  return valor.trim() || `[informar ${campo}]`
}

function qualificacao(dados: DadosDocumento) {
  const tipo = dados.clienteTipo === 'pj' ? 'pessoa jurídica' : dados.clienteTipo === 'pf' ? 'pessoa física' : '[informar PF/PJ]'
  const representante = dados.representanteLegal
    ? `, neste ato representada por ${dados.representanteLegal}`
    : ''

  return `${valorOuCampo(dados.nomeRazaoSocial, 'cliente')}, ${tipo}, inscrita no CPF/CNPJ sob o nº ${valorOuCampo(dados.cpfCnpj, 'CPF/CNPJ')}, com endereço em ${valorOuCampo(dados.endereco, 'endereço')}${representante}, doravante denominada CONTRATANTE.`
}

export function modeloContratoAcaoIsolada(dados: DadosDocumento): string[] {
  return [
    'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS — AÇÃO ISOLADA',
    'CONTRATANTE',
    qualificacao(dados),
    '',
    'CONTRATADO',
    'Pessoa e do Val Advocacia, por seus advogados responsáveis, doravante denominado CONTRATADO.',
    '',
    'Cláusula primeira – DO OBJETO',
    `O presente contrato tem por objeto a prestação de serviços advocatícios para atuação específica em ${valorOuCampo(dados.objeto, 'objetivo do contrato')}, envolvendo ${valorOuCampo(dados.parteContraria, 'parte contrária')}${dados.processo ? `, processo nº ${dados.processo}` : ''}.`,
    '',
    'Cláusula segunda – DA VIGÊNCIA',
    'A vigência deste contrato inicia-se na data de sua assinatura e permanece até a conclusão dos serviços contratados, ressalvadas as hipóteses de revogação, renúncia, desistência ou rescisão previstas neste instrumento.',
    '',
    'Cláusula terceira – DO PAGAMENTO',
    `Pelos serviços contratados, a CONTRATANTE pagará ao CONTRATADO os honorários descritos a seguir: ${valorOuCampo(dados.honorarios, 'honorários fixos, parcelados e/ou êxito')}.`,
    `O vencimento pactuado é ${valorOuCampo(dados.vencimento, 'vencimento')}${dados.primeiraParcela ? `, com primeira parcela em ${dados.primeiraParcela}` : ''}.`,
    dados.percentualExito ? `Também fica ajustado percentual de êxito de ${dados.percentualExito}, quando aplicável ao resultado econômico obtido.` : '',
    '',
    'Cláusula quarta – DA SUCUMBÊNCIA',
    'Os honorários sucumbenciais eventualmente fixados em favor dos advogados pertencem exclusivamente aos patronos, nos termos da legislação aplicável, e não se confundem com os honorários contratuais pactuados neste instrumento.',
    '',
    'Cláusula quinta – DAS CUSTAS JUDICIAIS',
    'Custas judiciais, taxas, emolumentos, preparo, depósitos, diligências, despesas cartorárias e demais encargos necessários à condução da demanda serão de responsabilidade exclusiva da CONTRATANTE, salvo ajuste expresso em sentido diverso.',
    '',
    'Cláusula sexta – DAS DESPESAS DIVERSAS',
    'Despesas extraordinárias, deslocamentos, cópias, autenticações, correspondências, diligências externas, contratação de correspondentes e demais gastos necessários à execução dos serviços deverão ser previamente aprovados e reembolsados pela CONTRATANTE.',
    '',
    'Cláusula sétima – DA DESISTÊNCIA',
    'A desistência, revogação de mandato, composição, acordo, substituição de patronos ou encerramento antecipado da demanda não afasta a obrigação de pagamento dos honorários vencidos e dos valores proporcionais aos serviços já prestados.',
    '',
    'Cláusula oitava – DO FORO',
    `Fica eleito o foro de ${valorOuCampo(dados.foro, 'foro')} para dirimir quaisquer controvérsias decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
    '',
    'E, por estarem justas e contratadas, as partes assinam o presente instrumento.',
    '',
    dados.localData || 'Belo Horizonte, ____ de ____________________ de 2026.',
    '',
    'CONTRATANTE',
    '',
    'PESSOA E DO VAL ADVOCACIA',
    '',
    `Revisão obrigatória antes da geração: ${dados.nomeRevisor || '[informar responsável pela revisão]'}.`,
  ].filter(linha => linha !== '')
}
