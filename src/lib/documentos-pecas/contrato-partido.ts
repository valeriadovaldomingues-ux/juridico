// Contrato de Honorários — Advocacia de Partido.
// Texto-base extraído literalmente dos contratos reais assinados (Fachi — vários CONTRATANTES,
// o caso comum — e Leite Chic/Live Viagens — 1 único CONTRATANTE). Todos com a cláusula do
// 13º/parcela extra de dezembro.
//
// Nota: o modelo real do escritório tem um erro na Cláusula 4ª de alguns contratos antigos
// ("...prazo fixado na cláusula segunda...", quando a vigência é a cláusula terceira) —
// aqui já corrigido para "terceira" (confirmado com a Valéria).

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function diaExtenso(d: Date): string {
  return d.getDate() === 1 ? '01º' : String(d.getDate())
}

function dataExtenso(d: Date): string {
  return `${diaExtenso(d)} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function addAnoMenosUmDia(inicio: Date): Date {
  const fim = new Date(inicio)
  fim.setFullYear(fim.getFullYear() + 1)
  fim.setDate(fim.getDate() - 1)
  return fim
}

const EXTENSO_INTEIRO: Record<number, string> = {
  0: 'zero', 1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
  6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  15: 'quinze', 20: 'vinte', 25: 'vinte e cinco', 30: 'trinta',
}

/** "1" -> "1 (um) salário mínimo mensal" · "0,5" -> "0,5 (zero vírgula cinco) salário(s) mínimo(s) mensal(is)" */
function extensoSalarios(qtd: number): string {
  if (Number.isInteger(qtd)) {
    const palavra = EXTENSO_INTEIRO[qtd] ?? String(qtd)
    return qtd === 1
      ? `${qtd} (${palavra}) salário mínimo mensal`
      : `${qtd} (${palavra}) salários mínimos mensais`
  }
  const numFmt = qtd.toFixed(1).replace('.', ',')
  const inteira = Math.floor(qtd)
  const decimal = Math.round((qtd - inteira) * 10)
  const palavraInteira = EXTENSO_INTEIRO[inteira] ?? String(inteira)
  const palavraDecimal = EXTENSO_INTEIRO[decimal] ?? String(decimal)
  return `${numFmt} (${palavraInteira} vírgula ${palavraDecimal}) salário(s) mínimo(s) mensal(is)`
}

function extensoPercentual(pct: number): string {
  const palavra = EXTENSO_INTEIRO[pct] ?? String(pct)
  return `${pct}% (${palavra} por cento)`
}

export interface ContratanteQualificacao {
  nome:       string
  tipo_pessoa: 'pf' | 'pj' | string | null
  cpf_cnpj:   string | null
  endereco:   string | null
  numero:     string | null
  complemento: string | null
  bairro:     string | null
  cidade:     string | null
  uf:         string | null
  cep:        string | null
  rg?:        string | null
  nacionalidade?: string | null
  estado_civil?:  string | null
  profissao?: string | null
}

/** Campos indispensáveis pra qualificação de 1 contratante no contrato. */
export function camposFaltantesContratante(c: ContratanteQualificacao): string[] {
  const faltando: string[] = []
  if (!c.cpf_cnpj) faltando.push(c.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ')
  if (c.tipo_pessoa === 'pf') {
    if (!c.nacionalidade) faltando.push('nacionalidade')
  } else if (!c.endereco) {
    faltando.push('endereço')
  }
  return faltando
}

function enderecoContrato(c: ContratanteQualificacao): string {
  const logradouro = [c.endereco, c.numero ? `nº ${c.numero}` : null].filter(Boolean).join(', ')
  const partes = [logradouro, c.complemento, c.bairro ? `bairro ${c.bairro}` : null].filter(Boolean).join(', ')
  const cidadeUf = [c.cidade, c.uf].filter(Boolean).join('/')
  const cep = c.cep ? `CEP: ${c.cep}` : null
  return [partes, cidadeUf, cep].filter(Boolean).join(' – ')
}

/** Qualificação de 1 contratante dentro da lista de abertura do contrato — PJ ou PF, endereço opcional
 *  (só aparece quando difere do endereço "principal" — nos contratos reais nem toda PJ da lista repete
 *  o endereço). */
function qualificacaoContratanteItem(c: ContratanteQualificacao): string {
  if (c.tipo_pessoa === 'pf') {
    const partes = [c.nacionalidade, c.profissao].filter(Boolean).join(', ')
    return `${c.nome}${partes ? `, ${partes}` : ''}, portador(a) do CPF/MF nº ${c.cpf_cnpj ?? '[informar CPF]'}`
  }
  const endereco = enderecoContrato(c)
  return `${c.nome}, inscrita no Cadastro Nacional da Pessoa Jurídica – CNPJ/MF sob o nº ${c.cpf_cnpj ?? '[informar CNPJ]'}` +
    (endereco ? `, com endereço à ${endereco}` : '')
}

function listaContratantes(contratantes: ContratanteQualificacao[]): string {
  const itens = contratantes.map(qualificacaoContratanteItem)
  if (itens.length === 1) return itens[0]
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`
  return `${itens.slice(0, -1).join(', ')}, e ${itens[itens.length - 1]}`
}

const CONTRATADO_SINGULAR =
  'contrata o escritório PESSOA E DO VAL ADVOCACIA, inscrito no Cadastro Nacional de Pessoa Jurídica – CNPJ/MF ' +
  'sob o nº 09.020.119/0001-09, com endereço à rua Gonçalves Dias, nº 874, 8º andar, bairro Savassi – Belo ' +
  'Horizonte/MG – CEP: 30.140-091, neste ato representado por seus sócios Cristiano Pessoa Sousa e Valéria ' +
  'Ferreira do Val Domingues Pessoa, de agora em diante denominado CONTRATADO, para a realização do objeto ' +
  'infra mencionado, mediante as cláusulas e condições seguintes:'

const CONTRATADO_PLURAL =
  'contratam o escritório PESSOA E DO VAL ADVOCACIA, inscrito no Cadastro Nacional da Pessoa Jurídica – CNPJ/MF ' +
  'sob o nº 09.020.119/0001-09 e na OAB/MG sob o nº 2.422, com sede à Rua Gonçalves Dias, nº 874, 8º andar, ' +
  'bairro Savassi – Belo Horizonte/MG – CEP: 30.140-091, que tem como representantes legais os Srs. Cristiano ' +
  'Pessoa Sousa e Valéria Ferreira do Val Domingues Pessoa, de agora em diante denominado CONTRATADO, para a ' +
  'realização do objeto infra mencionado, mediante as cláusulas e condições seguintes:'

export interface DadosContrato {
  contratantes:    ContratanteQualificacao[]
  /** Nome de quem assina "Pelos Contratantes" — obrigatório quando há mais de 1 contratante
   *  (nos contratos reais, um dos próprios contratantes-PF representa todos os demais). */
  representante?:  string
  dataInicio:      Date
  salariosMinimos: number
  diaPagamento?:   number  // padrão 10
  percentualExito?: number // padrão 10
  /** Ano a partir do qual passa a valer a parcela extra de dezembro (13º).
   *  Se null/undefined, a cláusula não leva o prefixo "A partir de X," — já vale no 1º dezembro da vigência. */
  anoParcelaExtra?: number | null
}

export interface ContratoPartidoResult {
  paragrafos: import('./pdf').PecaParagrafo[]
  localData:  string
  nomeAssinanteContratante: string
}

export function corpoContratoPartido(dados: DadosContrato): ContratoPartidoResult {
  const { contratantes } = dados
  const plural = contratantes.length > 1
  const diaPagamento    = dados.diaPagamento ?? 10
  const percentualExito = dados.percentualExito ?? 10
  const dataInicio       = dados.dataInicio
  const dataFim           = addAnoMenosUmDia(dataInicio)
  const prefixoParcelaExtra = dados.anoParcelaExtra ? `A partir de ${dados.anoParcelaExtra}, ` : ''

  const CONTRATANTE   = plural ? 'CONTRATANTES' : 'CONTRATANTE'
  const nomeAssinanteContratante = plural
    ? (dados.representante ?? contratantes[0].nome)
    : contratantes[0].nome

  const rodape = plural
    ? `todos representados neste ato pelo também CONTRATANTE ${nomeAssinanteContratante}, de agora em diante denominados CONTRATANTES, através deste instrumento escrito, ${CONTRATADO_PLURAL}`
    : `de agora em diante denominado CONTRATANTE, através deste instrumento escrito, ${CONTRATADO_SINGULAR}`

  const abertura = `${listaContratantes(contratantes)}, ${rodape}`

  const temPF = contratantes.some(c => c.tipo_pessoa === 'pf')
  const objeto1_1 = plural
    ? `1.1. O objeto deste contrato destina-se a realização de serviços jurídicos, na modalidade conhecida por advocacia de partido, em prol dos ${CONTRATANTE}${temPF ? ' pessoas jurídicas e as pessoas físicas para as questões estejam relacionadas às empresas CONTRATANTES' : ''}, em especial para prestação de assessoria jurídica através de formulação de pareceres, tentativa de acordos extrajudiciais em nome dos ${CONTRATANTE}, acompanhamento de processos judiciais e administrativos fiscais, e como causídicos perante o Poder Judiciário nas seguintes áreas: Direito Civil, Empresarial, Falimentar, Administrativo, Bancário, Consumerista, Aduaneiro, Tributário e Trabalhista.`
    : `1.1. O objeto deste contrato destina-se a realização de serviços jurídicos, na modalidade conhecida por advocacia de partido, em prol do CONTRATANTE, em especial para prestação de assessoria jurídica através de formulação de pareceres, tentativa de acordos extrajudiciais em nome do CONTRATANTE, acompanhamento de processos judiciais e administrativos fiscais, e como causídicos perante o Poder Judiciário nas seguintes áreas: Direito Civil, Empresarial, Falimentar, Administrativo, Bancário, Consumerista, Aduaneiro, Tributário e Trabalhista.`

  const paragrafos: import('./pdf').PecaParagrafo[] = [
    abertura,
    {
      titulo: 'Cláusula primeira – DO OBJETO',
      texto: objeto1_1 + `\n1.2. Toda a prestação de serviços ora contratada será realizada sem qualquer vínculo empregatício com ${plural ? 'os' : 'o'} ${CONTRATANTE}.`,
    },
    {
      titulo: 'Cláusula segunda – DA FORMA DE PRESTAÇÃO DOS SERVIÇOS',
      texto:
        `2.1. Os serviços profissionais objeto do presente instrumento serão prestados pelo CONTRATADO e de seus funcionários, sendo vedado o substabelecimento dos serviços advocatícios a terceiros, a não ser com a prévia anuência ${plural ? 'dos' : 'do'} ${CONTRATANTE}.\n` +
        (plural
          ? '2.2. Eventuais serviços ou postulações administrativas e judiciais fora do Estado de Minas Gerais poderão ser objeto de acompanhamento pelos advogados CONTRATADO e seus funcionários, desde que previamente informados com no mínimo 02 (dois) dias de antecedência.'
          : '2.2. Eventuais serviços ou postulações administrativas e judiciais fora do Estado de Minas Gerais serão objeto de acompanhamento pelos advogados do CONTRATADO e seus funcionários, sendo que poderá ser necessária a contratação de advogado correspondente, cujos custos serão pagos à parte.'),
    },
    {
      titulo: 'Cláusula terceira – DA VIGÊNCIA',
      texto: `3.1. O prazo deste contrato é de 01 (um) ano, tendo vigência a partir de ${dataExtenso(dataInicio)} a ${dataExtenso(dataFim)}.`,
    },
    {
      titulo: 'Cláusula quarta – DA RENOVAÇÃO',
      texto: '4.1. Por conveniência das partes, no final do prazo fixado na cláusula terceira, o presente contrato será renovado nos termos do contrato aditivo ou tacitamente.',
    },
    {
      titulo: 'Cláusula quinta – DO PAGAMENTO',
      texto:
        '5.1. Acordam as partes que o pagamento será feito da seguinte forma:\n' +
        `- Será pago, a título de honorários advocatícios, a importância de ${extensoSalarios(dados.salariosMinimos)} vigente(s) à época do pagamento das prestações.\n` +
        `- As parcelas deverão ser pagas até o dia ${diaPagamento} de cada mês, devendo ser paga a primeira parcela até ${diaPagamento} de ${MESES[dataInicio.getMonth()]} de ${dataInicio.getFullYear()}.\n` +
        `- ${prefixoParcelaExtra}${prefixoParcelaExtra ? 'em' : 'Em'} dezembro de cada ano, é devida uma parcela extra, no mesmo valor dos honorários e a serem pagos juntamente com os mesmos, a título de 13º salário, com fulcro na resolução CFC 290/70.\n` +
        '- Os valores deverão ser quitados através de boleto bancário enviado pelo CONTRATADO.\n' +
        `- Nas causas em que o CONTRATADO atuar como causídico d${plural ? 'os' : 'o'} ${CONTRATANTE}, será devido ao CONTRATADO, a título de honorários, ${extensoPercentual(percentualExito)} sobre o valor da condenação, caso ${plural ? 'os CONTRATANTES saiam' : 'o CONTRATANTE saia'}-se vencedor${plural ? 'es' : ''}.\n` +
        `- A remuneração do CONTRATADO supra estabelecida é devida sem prejuízo dos honorários advocatícios sucumbenciais, porventura fixadas pelo Poder Judiciário (verbas autônomas dos advogados – artigos 22 e 23 da Lei nº 8.906/94, vide cláusula a seguir) em favor dos advogados d${plural ? 'os' : 'o'} ${CONTRATANTE}, no trânsito em julgado das ações judiciais onde forem prestados os serviços pelo CONTRATADO.`,
    },
    {
      titulo: 'Cláusula sexta – DA SUCUMBÊNCIA',
      texto: '6.1. A verba honorária de sucumbência pertence ao CONTRATADO, conforme ensinamento do artigo 23 do Código de Ética e Disciplina da Ordem dos Advogados do Brasil (Lei nº 8.906/94).',
    },
    {
      titulo: 'Cláusula sétima – DAS CUSTAS JUDICIAIS',
      texto: `7.1. Caberá ${plural ? 'aos' : 'ao'} ${CONTRATANTE} o pagamento das custas judiciais, independentemente do pagamento dos honorários que estão estipulados neste contrato, salvo deferimento da gratuidade das custas judiciais.`,
    },
    {
      titulo: 'Cláusula oitava – DAS DESPESAS DIVERSAS',
      texto:
        `8.1. ${plural ? 'Correrão' : 'Correrá'} por conta d${plural ? 'os' : 'o'} ${CONTRATANTE} as despesas necessárias à prestação dos serviços objeto deste contrato, tais como cópias reprográficas, autenticações em cartório, e, se for necessário, despesas de viagem (compreendendo transporte e, se necessário, estadia, alimentação, táxi)${plural ? '' : ' e contratação de advogados correspondentes'}, sendo enviadas previamente ao CONTRATADO, quando se tratar${plural ? 'em' : ''} de custos de maior montante.\n` +
        `8.2. Os valores concernentes às custas processuais, aos honorários periciais e aos eventuais depósitos judiciais serão requisitados ${plural ? 'aos' : 'para o'} ${CONTRATANTE}, antecipadamente, sendo que a respectiva quantia deverá estar disponível para o CONTRATADO em espécie, no prazo máximo de 48 (quarenta e oito) horas, sob pena de não se realizar o ato processual necessário, eximindo-se o CONTRATADO de quaisquer responsabilidades.`,
    },
    {
      titulo: 'Cláusula nona – DA DESISTÊNCIA',
      texto:
        `9.1. Em caso de desistência do presente contrato antes do seu prazo final por parte d${plural ? 'os' : 'o'} ${CONTRATANTE}, caberá a est${plural ? 'es' : 'e'}, de acordo com o artigo 14 do Código de Ética e Disciplina da Ordem dos Advogados do Brasil (Lei nº 8.906/94) o pagamento de metade da verba honorária vincenda contratada anteriormente e não retirará do CONTRATADO o direito de receber o quanto seja devido em eventual verba honorária de sucumbência, calculada proporcionalmente, em face do serviço efetivamente prestado.\n` +
        `9.2. Sendo a desistência contratual requerida pelo CONTRATADO, caberá, de acordo com o Código de Processo Civil pátrio, no seu artigo 45, a representação d${plural ? 'os mandantes' : 'o mandante'} durante os 10 (dez) dias seguintes à desistência contratual desde que seja necessário para evitar-l${plural ? 'hes' : 'he'} prejuízo. E, caso tenha sido pago alguma verba antecipada por serviço não efetuado, será devolvida ${plural ? 'aos CONTRATANTES' : 'para o CONTRATANTE'} o valor referente a ela.`,
    },
    {
      titulo: 'Cláusula décima – DO FORO',
      texto:
        '10.1. As partes elegem o foro de Belo Horizonte/MG para qualquer pendência advinda do presente contrato, com renúncia expressa de outro, por mais privilegiado que seja. E por estarem assim, justas e contratadas, assinam as partes o presente instrumento em duas vias de igual teor e forma, na presença de duas testemunhas.',
    },
  ]

  return { paragrafos, localData: `Belo Horizonte, ${dataExtenso(dataInicio)}`, nomeAssinanteContratante }
}
