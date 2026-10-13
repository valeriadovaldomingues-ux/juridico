// Relatório de despesas no formato do contador: uma linha por conta, uma coluna por mês, % do mês e acumulado.

export const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'] as const

/** Contas do relatório do contador, na ordem dele. Entram mesmo sem movimento no ano (como no relatório dele). */
export const CONTAS_PADRAO: { codigo: string; nome: string }[] = [
  { codigo: '331', nome: 'SALÁRIOS E ORDENADOS' },
  { codigo: '358', nome: 'SEGUROS / PREVIDÊNCIA' },
  { codigo: '336', nome: 'INSS' },
  { codigo: '337', nome: 'FGTS' },
  { codigo: '480', nome: 'SIMPLES NACIONAL' },
  { codigo: '339', nome: 'ASSISTÊNCIA MÉDICA E SOCIAL' },
  { codigo: '492', nome: 'VALE TRANSPORTE' },
  { codigo: '521', nome: 'DESPESAS COM ALIMENTAÇÃO' },
  { codigo: '341', nome: 'ALUGUEL' },
  { codigo: '343', nome: 'CONDOMÍNIOS E TAXAS ADM.' },
  { codigo: '348', nome: 'IPTU' },
  { codigo: '350', nome: 'TAXAS , ANUIDADES E OUTROS' },
  { codigo: '354', nome: 'ENERGIA ELÉTRICA' },
  { codigo: '522', nome: 'CURSOS E TREINAMENTOS' },
  { codigo: '356', nome: 'TELEFONE' },
  { codigo: '359', nome: 'MATERIAL DE ESCRITÓRIO' },
  { codigo: '360', nome: 'MATERIAL DE HIGIENE E LIMPEZA' },
  { codigo: '362', nome: 'SERVIÇOS PRESTADOS POR TERCEIROS' },
  { codigo: '376', nome: 'OUTRAS DESPESAS OPERACIONAIS' },
  { codigo: '334', nome: '13º SALÁRIO' },
  { codigo: '523', nome: 'DESP. COM PLANOS DE SAÚDE' },
  { codigo: '338', nome: 'INDENIZAÇÕES E AVISOS PRÉVIOS' },
]

export interface LancamentoRelatorio {
  id: string
  descricao: string
  categoria: string | null
  conta_contabil: string | null
  fornecedor?: string | null
  valor: number
  vencimento: string
  pagamento_em: string | null
  status: string
  forma_pagamento?: string | null
  parcelas_total?: number | null
  parcela_atual?: number | null
}

export interface LinhaConta {
  chave: string          // código da conta, ou "sem:<categoria>" para despesa lançada à mão sem conta contábil
  codigo: string | null
  nome: string
  meses: number[]        // 12 valores (jan..dez)
  total: number
  itens: LancamentoRelatorio[][]  // itens[m] = lançamentos daquela conta no mês m (para abrir o detalhe)
}

export interface RelatorioDespesas {
  ano: number
  linhas: LinhaConta[]
  totaisMes: number[]
  totalAno: number
}

/** Data que conta para o mês: a do pagamento, se já foi pago; senão o vencimento. */
export function dataDoLancamento(l: Pick<LancamentoRelatorio, 'pagamento_em' | 'vencimento'>): string {
  return (l.pagamento_em || l.vencimento).slice(0, 10)
}

const arredonda = (n: number) => Math.round(n * 100) / 100

export function montarRelatorioDespesas(
  lancamentos: LancamentoRelatorio[],
  ano: number,
  opcoes: { apenasPagas?: boolean } = {},
): RelatorioDespesas {
  const nomeDoCodigo = new Map(CONTAS_PADRAO.map(c => [c.codigo, c.nome]))
  const mapa = new Map<string, LinhaConta>()
  const nova = (chave: string, codigo: string | null, nome: string): LinhaConta => ({
    chave, codigo, nome, meses: Array(12).fill(0), total: 0, itens: Array.from({ length: 12 }, () => []),
  })
  for (const c of CONTAS_PADRAO) mapa.set(c.codigo, nova(c.codigo, c.codigo, c.nome))

  for (const l of lancamentos) {
    if (l.status === 'cancelado') continue
    if (opcoes.apenasPagas && l.status !== 'pago') continue
    const data = dataDoLancamento(l)
    if (Number(data.slice(0, 4)) !== ano) continue
    const mes = Number(data.slice(5, 7)) - 1
    if (mes < 0 || mes > 11) continue

    const codigo = l.conta_contabil && nomeDoCodigo.has(l.conta_contabil) ? l.conta_contabil : null
    const chave = codigo ?? `sem:${(l.categoria ?? 'Sem categoria').trim().toUpperCase()}`
    let linha = mapa.get(chave)
    if (!linha) {
      linha = nova(chave, null, (l.categoria ?? 'Sem categoria').trim().toUpperCase())
      mapa.set(chave, linha)
    }
    linha.meses[mes] = arredonda(linha.meses[mes] + Number(l.valor))
    linha.itens[mes].push(l)
  }

  const linhas = [...mapa.values()]
  for (const l of linhas) l.total = arredonda(l.meses.reduce((a, b) => a + b, 0))
  // Contas padrão na ordem do contador; as lançadas à mão, sem conta contábil, vão depois (só se tiverem valor).
  const padrao = linhas.filter(l => l.codigo !== null)
  const avulsas = linhas.filter(l => l.codigo === null && l.total !== 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const todas = [...padrao, ...avulsas]
  const totaisMes = Array.from({ length: 12 }, (_, m) => arredonda(todas.reduce((a, l) => a + l.meses[m], 0)))
  return { ano, linhas: todas, totaisMes, totalAno: arredonda(totaisMes.reduce((a, b) => a + b, 0)) }
}

/** Percentual de `valor` em relação ao `total` (0 se o total é zero). */
export const percentual = (valor: number, total: number) => (total ? valor / total : 0)

/** Anos que têm despesa (para o seletor), do mais recente ao mais antigo; sempre inclui o ano atual. */
export function anosComDespesa(lancamentos: Pick<LancamentoRelatorio, 'pagamento_em' | 'vencimento'>[], anoAtual: number): number[] {
  const anos = new Set<number>([anoAtual])
  for (const l of lancamentos) anos.add(Number(dataDoLancamento(l).slice(0, 4)))
  return [...anos].filter(a => a > 2000).sort((a, b) => b - a)
}

const brl = (n: number) => n.toFixed(2).replace('.', ',')

/** CSV para abrir no Excel em português (separador ";", vírgula decimal). */
export function csvDoRelatorio(r: RelatorioDespesas): string {
  const aspas = (s: string) => `"${s.replace(/"/g, '""')}"`
  const cab = ['CÓDIGO', 'CONTA', ...MESES, 'ACUMULADO']
  const linhas = r.linhas.map(l => [l.codigo ?? '', l.nome, ...l.meses.map(brl), brl(l.total)])
  const totais = ['', 'TOTAIS', ...r.totaisMes.map(brl), brl(r.totalAno)]
  return [cab, ...linhas, totais].map(l => l.map(c => (/[;"\n]/.test(c) ? aspas(c) : c)).join(';')).join('\r\n')
}
