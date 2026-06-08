export type ProcessoImportacaoModoAplicacao = 'preencher_vazios' | 'substituir'

export interface ProcessoImportacaoPessoa {
  nome: string
  cpfCnpj: string
  telefone: string
  email: string
  endereco: string
}

export interface ProcessoImportacaoParteContraria {
  nome: string
  cpfCnpj: string
  endereco: string
}

export interface ProcessoImportacaoProcesso {
  numero: string
  comarca: string
  vara: string
  tribunal: string
  classe: string
  assunto: string
  fase: string
  dataDistribuicao: string
  valorCausa: string
  segredoJustica: boolean | null
}

export interface ProcessoImportacaoAdvogado {
  nome: string
  oab: string
  representa: string
}

export interface ProcessoImportacaoResumo {
  resumoCaso: string
  fatosRelevantes: string[]
  pedidosPrincipais: string[]
  prazosMencionados: string[]
}

export interface ProcessoImportacaoObservacoes {
  camposNaoEncontrados: string[]
  inconsistencias: string[]
  observacoesInternas: string
}

export interface ProcessoImportacaoDados {
  cliente: ProcessoImportacaoPessoa
  parteContraria: ProcessoImportacaoParteContraria
  processo: ProcessoImportacaoProcesso
  advogados: ProcessoImportacaoAdvogado[]
  resumo: ProcessoImportacaoResumo
  observacoes: ProcessoImportacaoObservacoes
}

export const PROCESSO_IMPORTACAO_VAZIA: ProcessoImportacaoDados = {
  cliente: {
    nome: '',
    cpfCnpj: '',
    telefone: '',
    email: '',
    endereco: '',
  },
  parteContraria: {
    nome: '',
    cpfCnpj: '',
    endereco: '',
  },
  processo: {
    numero: '',
    comarca: '',
    vara: '',
    tribunal: '',
    classe: '',
    assunto: '',
    fase: '',
    dataDistribuicao: '',
    valorCausa: '',
    segredoJustica: null,
  },
  advogados: [],
  resumo: {
    resumoCaso: '',
    fatosRelevantes: [],
    pedidosPrincipais: [],
    prazosMencionados: [],
  },
  observacoes: {
    camposNaoEncontrados: [],
    inconsistencias: [],
    observacoesInternas: '',
  },
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;|•/g)
      .map(item => item.trim().replace(/^[-–—*]+\s*/, ''))
      .filter(Boolean)
  }
  return []
}

function toTriStateBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  const text = toText(value).toLowerCase()
  if (!text) return null
  if (['sim', 's', 'true', '1', 'yes', 'y'].includes(text)) return true
  if (['não', 'nao', 'n', 'false', '0', 'no'].includes(text)) return false
  return null
}

function normalizeAdvogados(value: unknown): ProcessoImportacaoAdvogado[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      return { nome: '', oab: '', representa: '' }
    }
    const record = item as Record<string, unknown>
    return {
      nome: toText(record.nome),
      oab: toText(record.oab),
      representa: toText(record.representa),
    }
  }).filter(advogado => advogado.nome || advogado.oab || advogado.representa)
}

export function normalizeProcessoImportacao(raw: unknown): ProcessoImportacaoDados {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const cliente = (record.cliente && typeof record.cliente === 'object') ? record.cliente as Record<string, unknown> : {}
  const parteContraria = (record.parteContraria && typeof record.parteContraria === 'object') ? record.parteContraria as Record<string, unknown> : {}
  const processo = (record.processo && typeof record.processo === 'object') ? record.processo as Record<string, unknown> : {}
  const resumo = (record.resumo && typeof record.resumo === 'object') ? record.resumo as Record<string, unknown> : {}
  const observacoes = (record.observacoes && typeof record.observacoes === 'object') ? record.observacoes as Record<string, unknown> : {}

  return {
    cliente: {
      nome: toText(cliente.nome),
      cpfCnpj: toText(cliente.cpfCnpj),
      telefone: toText(cliente.telefone),
      email: toText(cliente.email),
      endereco: toText(cliente.endereco),
    },
    parteContraria: {
      nome: toText(parteContraria.nome),
      cpfCnpj: toText(parteContraria.cpfCnpj),
      endereco: toText(parteContraria.endereco),
    },
    processo: {
      numero: toText(processo.numero),
      comarca: toText(processo.comarca),
      vara: toText(processo.vara),
      tribunal: toText(processo.tribunal),
      classe: toText(processo.classe),
      assunto: toText(processo.assunto),
      fase: toText(processo.fase),
      dataDistribuicao: toText(processo.dataDistribuicao),
      valorCausa: toText(processo.valorCausa),
      segredoJustica: toTriStateBoolean(processo.segredoJustica),
    },
    advogados: normalizeAdvogados(record.advogados),
    resumo: {
      resumoCaso: toText(resumo.resumoCaso),
      fatosRelevantes: toTextArray(resumo.fatosRelevantes),
      pedidosPrincipais: toTextArray(resumo.pedidosPrincipais),
      prazosMencionados: toTextArray(resumo.prazosMencionados),
    },
    observacoes: {
      camposNaoEncontrados: toTextArray(observacoes.camposNaoEncontrados),
      inconsistencias: toTextArray(observacoes.inconsistencias),
      observacoesInternas: toText(observacoes.observacoesInternas),
    },
  }
}

export function buildObservacoesImportacao(dados: ProcessoImportacaoDados): string {
  const linhas: string[] = []

  if (dados.resumo.resumoCaso) {
    linhas.push('Resumo do caso:')
    linhas.push(dados.resumo.resumoCaso)
  }

  if (dados.resumo.fatosRelevantes.length > 0) {
    linhas.push('Fatos relevantes:')
    dados.resumo.fatosRelevantes.forEach(item => linhas.push(`- ${item}`))
  }

  if (dados.resumo.pedidosPrincipais.length > 0) {
    linhas.push('Pedidos principais:')
    dados.resumo.pedidosPrincipais.forEach(item => linhas.push(`- ${item}`))
  }

  if (dados.resumo.prazosMencionados.length > 0) {
    linhas.push('Prazos mencionados:')
    dados.resumo.prazosMencionados.forEach(item => linhas.push(`- ${item}`))
  }

  const dadosExtras: string[] = []
  if (dados.processo.comarca) dadosExtras.push(`Comarca: ${dados.processo.comarca}`)
  if (dados.processo.classe) dadosExtras.push(`Classe processual: ${dados.processo.classe}`)
  if (dados.processo.assunto) dadosExtras.push(`Assunto: ${dados.processo.assunto}`)
  if (dados.processo.segredoJustica !== null) dadosExtras.push(`Segredo de justiça: ${dados.processo.segredoJustica ? 'Sim' : 'Não'}`)
  if (dados.cliente.nome || dados.cliente.cpfCnpj || dados.parteContraria.nome) {
    linhas.push('Resumo da importação:')
    if (dados.cliente.nome) linhas.push(`Cliente sugerido: ${dados.cliente.nome}`)
    if (dados.cliente.cpfCnpj) linhas.push(`CPF/CNPJ do cliente: ${dados.cliente.cpfCnpj}`)
    if (dados.parteContraria.nome) linhas.push(`Parte contrária sugerida: ${dados.parteContraria.nome}`)
    if (dados.parteContraria.cpfCnpj) linhas.push(`CPF/CNPJ da parte contrária: ${dados.parteContraria.cpfCnpj}`)
  }
  if (dadosExtras.length > 0) {
    linhas.push('Dados jurídicos identificados:')
    linhas.push(...dadosExtras.map(item => `- ${item}`))
  }

  if (dados.observacoes.observacoesInternas) {
    linhas.push('Observações internas:')
    linhas.push(dados.observacoes.observacoesInternas)
  }

  if (dados.observacoes.camposNaoEncontrados.length > 0) {
    linhas.push('Campos não encontrados:')
    dados.observacoes.camposNaoEncontrados.forEach(item => linhas.push(`- ${item}`))
  }

  if (dados.observacoes.inconsistencias.length > 0) {
    linhas.push('Inconsistências identificadas:')
    dados.observacoes.inconsistencias.forEach(item => linhas.push(`- ${item}`))
  }

  return linhas.join('\n').trim()
}

export function escolherValorImportado<T>(
  atual: T,
  novo: T,
  modo: ProcessoImportacaoModoAplicacao,
): T {
  if (modo === 'preencher_vazios') {
    if (atual === null || atual === undefined) return novo
    if (typeof atual === 'string' && atual.trim() === '') return novo
    return atual
  }
  return novo
}

