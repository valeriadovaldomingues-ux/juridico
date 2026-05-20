import type { DadosDocumento } from '../schema'

function endereco(dados: DadosDocumento) {
  if (dados.enderecamentoPeticao.trim()) return dados.enderecamentoPeticao.trim().toUpperCase()
  const vara = dados.vara || '___'
  const comarca = dados.comarca || '___'
  const uf = dados.uf || 'UF'
  return `EXMO. SR. JUIZ DE DIREITO DA ${vara} VARA ${dados.foro || '___'} DA COMARCA DE ${comarca}/${uf}.`
}

function qualificarParte(dados: DadosDocumento) {
  const cliente = dados.nomeRazaoSocial || '[informar requerente]'
  const documento = dados.cpfCnpj ? `, inscrito(a) no CPF/CNPJ sob o nº ${dados.cpfCnpj}` : ''
  const enderecoParte = dados.endereco ? `, com endereço em ${dados.endereco}` : ''
  return `${cliente}${documento}${enderecoParte}, por seus advogados que esta subscrevem, vem, respeitosamente, à presença de Vossa Excelência, propor a presente`
}

export function modeloPeticaoComum(dados: DadosDocumento): string[] {
  const nomeAcao = (dados.tipoPeticao || dados.objeto || 'PETIÇÃO COMUM').toUpperCase()
  const localData = dados.localData || 'Belo Horizonte, data.'

  return [
    endereco(dados),
    '',
    dados.urgencia ? 'URGENTE' : '',
    '',
    qualificarParte(dados),
    '',
    nomeAcao,
    '',
    `em face de ${dados.parteContraria || '[informar parte contrária]'}, pelos fatos e fundamentos a seguir expostos.`,
    '',
    dados.gratuidadeJustica ? 'DA GRATUIDADE DA JUSTIÇA' : '',
    dados.gratuidadeJustica
      ? 'A parte requerente declara não possuir condições de arcar com custas e despesas processuais sem prejuízo de seu sustento, razão pela qual requer a concessão dos benefícios da gratuidade da justiça, nos termos da legislação aplicável.'
      : '',
    '',
    'DOS FATOS',
    dados.fatosResumidos || '[informar fatos resumidos]',
    '',
    'DO DIREITO',
    dados.direito || '[desenvolver fundamentos jurídicos aplicáveis]',
    '',
    'DOS PEDIDOS',
    dados.pedidos || '[informar pedidos]',
    '',
    'Protesta provar o alegado por todos os meios de prova em direito admitidos, especialmente prova documental, testemunhal, pericial e demais meios que se fizerem necessários.',
    '',
    `Dá-se à causa o valor de R$ ${dados.valorCausa || '___'} para efeitos fiscais.`,
    '',
    'Nestes Termos,',
    'Pede Deferimento.',
    localData,
    '',
    'Cristiano Pessoa Sousa — OAB/MG 88.465',
    'Valéria F. do Val Domingues Pessoa — OAB/MG 98.185',
  ]
}
