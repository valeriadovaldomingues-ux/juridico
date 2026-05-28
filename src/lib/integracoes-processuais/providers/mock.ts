import type {
  IntegracaoProcessualProvider,
  MovimentacaoNormalizada,
  ProcessoNormalizado,
  PublicacaoFiltros,
  PublicacaoNormalizada,
  SincronizacaoProcessoResultado,
} from '../types'

function nowIso() {
  return new Date().toISOString()
}

function normalizarNumero(numeroCnj: string) {
  return numeroCnj.trim()
}

function processoMock(numeroCnj: string): ProcessoNormalizado {
  return {
    numeroCnj: normalizarNumero(numeroCnj),
    classe: 'Procedimento Comum Civel',
    tribunal: 'TJMG',
    grau: '1o grau',
    area: 'Civel',
    assunto: 'Obrigacoes',
    status: 'Em andamento',
    partes: [
      { nome: 'Cliente Exemplo', tipo: 'autor' },
      { nome: 'Parte Contraria Exemplo', tipo: 'reu' },
    ],
    urlOrigem: 'https://www.jusbrasil.com.br/consulta-processual/',
    origem: 'mock',
    atualizadoEm: nowIso(),
  }
}

function movimentacoesMock(numeroCnj: string): MovimentacaoNormalizada[] {
  const numero = normalizarNumero(numeroCnj)
  return [
    {
      id: `mock-mov-1-${numero}`,
      numeroCnj: numero,
      data: '2026-05-20',
      titulo: 'Conclusos para decisao',
      descricao: 'Registro ficticio para desenvolvimento da integracao processual.',
      origem: 'mock',
    },
    {
      id: `mock-mov-2-${numero}`,
      numeroCnj: numero,
      data: '2026-05-18',
      titulo: 'Juntada de peticao',
      descricao: 'Movimentacao mock sem chamada externa.',
      origem: 'mock',
    },
  ]
}

function publicacoesMock(filtros: PublicacaoFiltros): PublicacaoNormalizada[] {
  const numero = filtros.numeroCnj?.trim()
  return [
    {
      id: `mock-pub-${numero ?? 'geral'}`,
      numeroCnj: numero,
      dataPublicacao: '2026-05-21',
      tribunal: 'DJEN/CNJ',
      diario: 'Diario de Justica Eletronico Nacional',
      texto: 'Publicacao ficticia para validar fluxo de integracao processual.',
      origem: 'mock',
    },
  ]
}

export const mockProcessualProvider: IntegracaoProcessualProvider = {
  id: 'mock',
  nome: 'Mock manual',
  descricao: 'Provider local para desenvolvimento sem chamadas externas.',
  configurado: () => true,
  async buscarProcessoPorNumero(numeroCnj) {
    const numero = normalizarNumero(numeroCnj)
    if (!numero) return null
    return processoMock(numero)
  },
  async buscarProcessosPorDocumento(cpfCnpj) {
    const documento = cpfCnpj.replace(/\D/g, '')
    if (!documento) return []
    return [processoMock('0000000-00.2026.8.13.0000')]
  },
  async listarMovimentacoes(numeroCnj) {
    if (!normalizarNumero(numeroCnj)) return []
    return movimentacoesMock(numeroCnj)
  },
  async listarPublicacoes(filtros) {
    return publicacoesMock(filtros)
  },
  async sincronizarProcesso(numeroCnj): Promise<SincronizacaoProcessoResultado> {
    const processo = await this.buscarProcessoPorNumero(numeroCnj)
    return {
      processo,
      movimentacoes: processo ? await this.listarMovimentacoes(numeroCnj) : [],
      publicacoes: await this.listarPublicacoes({ numeroCnj }),
      provider: this.id,
      sincronizadoEm: nowIso(),
    }
  },
}
