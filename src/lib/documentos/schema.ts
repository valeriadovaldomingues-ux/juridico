export const TIPOS_DOCUMENTO_GERADOR = [
  {
    id: 'contrato_partido',
    titulo: 'Contrato — Advocacia de Partido',
    descricao: 'Contrato mensal com vigência, honorários recorrentes, áreas excluídas e êxito.',
  },
  {
    id: 'contrato_acao_isolada',
    titulo: 'Contrato — Ação Isolada',
    descricao: 'Contrato para demanda específica, com honorários fixos, parcelados ou êxito.',
  },
  {
    id: 'procuracao',
    titulo: 'Procuração ad judicia et extra',
    descricao: 'Mandato judicial e extrajudicial com poderes gerais e especiais selecionáveis.',
  },
  {
    id: 'hipossuficiencia',
    titulo: 'Declaração de Hipossuficiência',
    descricao: 'Declaração para justiça gratuita ou finalidade correlata.',
  },
  {
    id: 'peticao_comum',
    titulo: 'Petição Comum',
    descricao: 'Minuta comum com processo, fatos resumidos, objetivo e pedidos.',
  },
] as const

export type TipoDocumentoGerador = typeof TIPOS_DOCUMENTO_GERADOR[number]['id']

export type PessoaTipo = 'pf' | 'pj' | ''

export interface DadosDocumento {
  tipoDocumento: TipoDocumentoGerador
  clienteTipo: PessoaTipo
  nomeRazaoSocial: string
  cpfCnpj: string
  endereco: string
  representanteLegal: string
  cnpjBoletos: string
  processo: string
  parteContraria: string
  objeto: string
  honorarios: string
  vencimento: string
  primeiraParcela: string
  vigenciaInicio: string
  vigenciaFim: string
  todasAreas: boolean | null
  areasExcluidas: string
  percentualExito: string
  parcelaAdicionalDezembro: boolean | null
  nomeRevisor: string
  poderesProcuracao: string[]
  finalidadeHipossuficiencia: string
  tipoPeticao: string
  modeloPeticaoId: string
  grupoPeticao: string
  enderecamentoPeticao: string
  topicosPeticao: string
  fatosResumidos: string
  pedidos: string
  foro: string
  vara: string
  comarca: string
  uf: string
  direito: string
  valorCausa: string
  urgencia: boolean
  gratuidadeJustica: boolean
  localData: string
  camposAusentes: string[]
  alertas: string[]
  confianca: number
}

export interface ExtracaoDocumentoResultado {
  dados: DadosDocumento
  camposAusentes: string[]
  alertas: string[]
  confianca: number
}

export const DADOS_DOCUMENTO_VAZIO: DadosDocumento = {
  tipoDocumento: 'contrato_partido',
  clienteTipo: '',
  nomeRazaoSocial: '',
  cpfCnpj: '',
  endereco: '',
  representanteLegal: '',
  cnpjBoletos: '',
  processo: '',
  parteContraria: '',
  objeto: '',
  honorarios: '',
  vencimento: '',
  primeiraParcela: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  todasAreas: null,
  areasExcluidas: '',
  percentualExito: '',
  parcelaAdicionalDezembro: null,
  nomeRevisor: '',
  poderesProcuracao: [],
  finalidadeHipossuficiencia: '',
  tipoPeticao: '',
  modeloPeticaoId: '',
  grupoPeticao: '',
  enderecamentoPeticao: '',
  topicosPeticao: '',
  fatosResumidos: '',
  pedidos: '',
  foro: '',
  vara: '',
  comarca: '',
  uf: '',
  direito: '',
  valorCausa: '',
  urgencia: false,
  gratuidadeJustica: false,
  localData: '',
  camposAusentes: [],
  alertas: [],
  confianca: 0,
}

const CAMPOS_OBRIGATORIOS: Record<TipoDocumentoGerador, Array<keyof DadosDocumento>> = {
  contrato_partido: [
    'clienteTipo',
    'nomeRazaoSocial',
    'cpfCnpj',
    'endereco',
    'honorarios',
    'vencimento',
    'primeiraParcela',
    'vigenciaInicio',
    'percentualExito',
  ],
  contrato_acao_isolada: [
    'clienteTipo',
    'nomeRazaoSocial',
    'parteContraria',
    'objeto',
    'honorarios',
    'vencimento',
    'foro',
  ],
  procuracao: [
    'clienteTipo',
    'nomeRazaoSocial',
    'cpfCnpj',
    'endereco',
  ],
  hipossuficiencia: [
    'nomeRazaoSocial',
    'cpfCnpj',
    'endereco',
    'finalidadeHipossuficiencia',
  ],
  peticao_comum: [
    'tipoPeticao',
    'processo',
    'nomeRazaoSocial',
    'parteContraria',
    'objeto',
    'fatosResumidos',
    'pedidos',
    'vara',
    'comarca',
    'uf',
    'valorCausa',
  ],
}

const LABELS_CAMPOS: Partial<Record<keyof DadosDocumento, string>> = {
  clienteTipo: 'Cliente PF/PJ',
  nomeRazaoSocial: 'Nome ou razão social',
  cpfCnpj: 'CPF/CNPJ',
  endereco: 'Endereço',
  honorarios: 'Honorários',
  vencimento: 'Vencimento',
  primeiraParcela: 'Primeira parcela',
  vigenciaInicio: 'Início da vigência',
  todasAreas: 'Abrangência das áreas',
  areasExcluidas: 'Áreas excluídas',
  percentualExito: 'Percentual de êxito',
  nomeRevisor: 'Nome de quem revisou',
  parteContraria: 'Parte contrária',
  objeto: 'Objeto',
  foro: 'Foro',
  finalidadeHipossuficiencia: 'Finalidade',
  tipoPeticao: 'Tipo de petição',
  modeloPeticaoId: 'Modelo de petição',
  enderecamentoPeticao: 'Endereçamento',
  processo: 'Processo',
  fatosResumidos: 'Fatos resumidos',
  pedidos: 'Pedidos',
  vara: 'Vara',
  comarca: 'Comarca',
  uf: 'UF',
  valorCausa: 'Valor da causa',
}

export function tipoDocumentoValido(tipo: string): tipo is TipoDocumentoGerador {
  return TIPOS_DOCUMENTO_GERADOR.some(item => item.id === tipo)
}

export function extensaoArquivoPermitida(nome: string, tipoMime?: string) {
  const lower = nome.toLowerCase()
  const extOk = lower.endsWith('.pdf') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')
  if (!tipoMime) return extOk
  const mimeOk = ['application/pdf', 'image/jpeg', 'image/png'].includes(tipoMime)
  return extOk && mimeOk
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function lista(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
}

function booleanOuNull(valor: unknown): boolean | null {
  if (typeof valor === 'boolean') return valor
  return null
}

function booleano(valor: unknown): boolean {
  return typeof valor === 'boolean' ? valor : false
}

function uf(valor: unknown): string {
  const raw = texto(valor)
  if (raw.startsWith('{{') && raw.endsWith('}}')) return raw
  return raw.toUpperCase().slice(0, 2)
}

function confianca(valor: unknown): number {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return 0
  return Math.max(0, Math.min(1, valor))
}

export function calcularCamposAusentes(tipoDocumento: TipoDocumentoGerador, dados: DadosDocumento) {
  const campos = CAMPOS_OBRIGATORIOS[tipoDocumento]
  const ausentes = campos
    .filter(campo => {
      const valor = dados[campo]
      if (Array.isArray(valor)) return valor.length === 0
      if (typeof valor === 'boolean') return false
      return !String(valor ?? '').trim()
    })
    .map(campo => LABELS_CAMPOS[campo] ?? String(campo))

  if (tipoDocumento === 'contrato_partido') {
    if (dados.todasAreas === null) ausentes.push(LABELS_CAMPOS.todasAreas!)
    if (dados.todasAreas === false && !dados.areasExcluidas.trim()) {
      ausentes.push(LABELS_CAMPOS.areasExcluidas!)
    }
  }

  return ausentes
}

export function normalizarDadosDocumento(input: unknown, tipoPadrao: TipoDocumentoGerador): DadosDocumento {
  const obj = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const tipoDocumento = tipoDocumentoValido(texto(obj.tipoDocumento)) ? texto(obj.tipoDocumento) as TipoDocumentoGerador : tipoPadrao

  const dados: DadosDocumento = {
    ...DADOS_DOCUMENTO_VAZIO,
    tipoDocumento,
    clienteTipo: ['pf', 'pj'].includes(texto(obj.clienteTipo)) ? texto(obj.clienteTipo) as PessoaTipo : '',
    nomeRazaoSocial: texto(obj.nomeRazaoSocial),
    cpfCnpj: texto(obj.cpfCnpj),
    endereco: texto(obj.endereco),
    representanteLegal: texto(obj.representanteLegal),
    cnpjBoletos: texto(obj.cnpjBoletos),
    processo: texto(obj.processo),
    parteContraria: texto(obj.parteContraria),
    objeto: texto(obj.objeto),
    honorarios: texto(obj.honorarios),
    vencimento: texto(obj.vencimento),
    primeiraParcela: texto(obj.primeiraParcela),
    vigenciaInicio: texto(obj.vigenciaInicio),
    vigenciaFim: texto(obj.vigenciaFim),
    todasAreas: booleanOuNull(obj.todasAreas),
    areasExcluidas: texto(obj.areasExcluidas),
    percentualExito: texto(obj.percentualExito),
    parcelaAdicionalDezembro: booleanOuNull(obj.parcelaAdicionalDezembro),
    nomeRevisor: texto(obj.nomeRevisor),
    poderesProcuracao: lista(obj.poderesProcuracao),
    finalidadeHipossuficiencia: texto(obj.finalidadeHipossuficiencia),
    tipoPeticao: texto(obj.tipoPeticao),
    modeloPeticaoId: texto(obj.modeloPeticaoId),
    grupoPeticao: texto(obj.grupoPeticao),
    enderecamentoPeticao: texto(obj.enderecamentoPeticao),
    topicosPeticao: texto(obj.topicosPeticao),
    fatosResumidos: texto(obj.fatosResumidos),
    pedidos: texto(obj.pedidos),
    foro: texto(obj.foro),
    vara: texto(obj.vara),
    comarca: texto(obj.comarca),
    uf: uf(obj.uf),
    direito: texto(obj.direito),
    valorCausa: texto(obj.valorCausa),
    urgencia: booleano(obj.urgencia),
    gratuidadeJustica: booleano(obj.gratuidadeJustica),
    localData: texto(obj.localData),
    camposAusentes: lista(obj.camposAusentes),
    alertas: lista(obj.alertas),
    confianca: confianca(obj.confianca),
  }

  const calculados = calcularCamposAusentes(tipoDocumento, dados)
  dados.camposAusentes = [...new Set([...dados.camposAusentes, ...calculados])]

  return dados
}

export function podeGerarDocumento(confirmouRevisao: boolean, dados: DadosDocumento | null): boolean {
  if (!confirmouRevisao || !dados || !dados.nomeRevisor.trim()) return false
  return calcularCamposAusentes(dados.tipoDocumento, dados).length === 0
}

export function tituloTipoDocumento(tipo: TipoDocumentoGerador) {
  return TIPOS_DOCUMENTO_GERADOR.find(item => item.id === tipo)?.titulo ?? 'Documento'
}
