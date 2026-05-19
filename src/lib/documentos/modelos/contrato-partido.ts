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

export function modeloContratoPartido(dados: DadosDocumento): string[] {
  const abrangencia = dados.todasAreas === false
    ? `A contratação não abrange as seguintes áreas, matérias ou providências: ${valorOuCampo(dados.areasExcluidas, 'áreas excluídas')}.`
    : 'A contratação abrange as áreas jurídicas ordinárias indicadas pela CONTRATANTE e aceitas pelo escritório, observados os limites deste instrumento e as providências que exigirem contratação específica.'

  const vigencia = dados.vigenciaFim
    ? `O presente contrato vigorará de ${valorOuCampo(dados.vigenciaInicio, 'início da vigência')} até ${dados.vigenciaFim}.`
    : `O presente contrato vigorará a partir de ${valorOuCampo(dados.vigenciaInicio, 'início da vigência')}, por prazo indeterminado, até rescisão formal por qualquer das partes.`

  const parcelaAdicional = dados.parcelaAdicionalDezembro
    ? 'Parcela adicional anual em dezembro: sim — parcela extra equivalente aos honorários mensais.'
    : ''

  return [
    'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS — ADVOCACIA DE PARTIDO',
    'CONTRATANTE',
    qualificacao(dados),
    '',
    'CONTRATADO',
    'Pessoa e do Val Advocacia, por seus advogados responsáveis, doravante denominado CONTRATADO.',
    '',
    'Cláusula primeira – DO OBJETO',
    `O presente contrato tem por objeto a prestação de serviços advocatícios de partido, de natureza consultiva, preventiva e contenciosa, conforme demandas apresentadas pela CONTRATANTE e aceitas pelo CONTRATADO. ${abrangencia}`,
    dados.objeto ? `Objeto específico informado para esta contratação: ${dados.objeto}.` : '',
    '',
    'Cláusula segunda – DA VIGÊNCIA',
    vigencia,
    '',
    'Cláusula terceira – DO PAGAMENTO',
    `Pelos serviços contratados, a CONTRATANTE pagará ao CONTRATADO honorários mensais no valor de ${valorOuCampo(dados.honorarios, 'valor dos honorários')}, com vencimento todo dia ${valorOuCampo(dados.vencimento, 'dia de vencimento')}. A primeira parcela vencerá em ${valorOuCampo(dados.primeiraParcela, 'primeira parcela')}.`,
    dados.cnpjBoletos ? `Para emissão dos boletos, deverá ser utilizado o CNPJ ${dados.cnpjBoletos}.` : '',
    parcelaAdicional,
    dados.percentualExito ? `Além dos honorários mensais, fica ajustado percentual de êxito de ${dados.percentualExito}, quando aplicável ao resultado econômico obtido.` : '',
    '',
    'Cláusula quarta – DA SUCUMBÊNCIA',
    'Os honorários sucumbenciais eventualmente fixados em favor dos advogados pertencem exclusivamente aos patronos, nos termos da legislação aplicável, e não se confundem com os honorários contratuais pactuados neste instrumento.',
    '',
    'Cláusula quinta – DAS CUSTAS JUDICIAIS',
    'Custas judiciais, taxas, emolumentos, preparo, depósitos, diligências, despesas cartorárias e demais encargos necessários à condução das demandas serão de responsabilidade exclusiva da CONTRATANTE, salvo ajuste expresso em sentido diverso.',
    '',
    'Cláusula sexta – DAS DESPESAS DIVERSAS',
    'Despesas extraordinárias, deslocamentos, cópias, autenticações, correspondências, diligências externas, contratação de correspondentes e demais gastos necessários à execução dos serviços deverão ser previamente aprovados e reembolsados pela CONTRATANTE.',
    '',
    'Cláusula sétima – DA DESISTÊNCIA',
    'A desistência, revogação de mandato, composição, acordo, substituição de patronos ou encerramento antecipado da demanda não afasta a obrigação de pagamento dos honorários vencidos e dos valores proporcionais aos serviços já prestados.',
    '',
    'Cláusula oitava – DO FORO',
    `Fica eleito o foro de ${dados.foro || 'Belo Horizonte/MG'} para dirimir quaisquer controvérsias decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
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
