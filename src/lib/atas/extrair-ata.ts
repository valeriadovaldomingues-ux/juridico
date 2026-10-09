import { resolverPessoa, type PessoaEquipe } from '@/lib/reunioes/resolver-pessoa'

export interface ObrigacaoCliente {
  titulo: string
  descricao: string | null
  data: string | null       // YYYY-MM-DD
  dataTexto: string | null  // como a ata diz (ex.: "todo dia 10", "30 dias após a homologação")
  valor: string | null      // como a ata diz (ex.: "R$ 5.000,00")
}

export interface TarefaEscritorio {
  titulo: string
  descricao: string | null
  prazo: string | null
  responsavelId: string | null
  responsavelTexto: string | null
}

export interface ExtracaoAta {
  resumo: string
  obrigacoesCliente: ObrigacaoCliente[]
  tarefasEscritorio: TarefaEscritorio[]
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function promptSistemaAta(equipe: PessoaEquipe[], dataAudiencia: string): string {
  const d = new Date(`${dataAudiencia}T12:00:00Z`)
  const diaSemana = Number.isNaN(d.getTime()) ? '' : DIAS[d.getUTCDay()]
  return [
    'Você lê a ata de uma AUDIÊNCIA judicial para um escritório de advocacia e separa o que precisa ser feito depois dela.',
    'Responda somente em JSON: {"resumo":string,"obrigacoes_cliente":[{"titulo":string,"descricao":string|null,"data":string|null,"dataTexto":string|null,"valor":string|null}],"tarefas_escritorio":[{"titulo":string,"descricao":string|null,"responsaveis":string[],"prazo":string|null,"prazoTexto":string|null}]}.',
    'Regras:',
    '- "resumo": 2 a 4 frases em português claro, para o cliente leigo entender o que aconteceu na audiência (acordo fechado ou não, valores, próximos passos). Não invente.',
    '- "obrigacoes_cliente": o que o CLIENTE (quem o escritório representa) precisa fazer, pagar, entregar, comparecer ou providenciar: pagamento de acordo/parcelas, entrega de guias e comprovantes, documentos, comparecimento a nova audiência/perícia, assinaturas. Uma obrigação por item; parcelas com datas diferentes podem ser itens separados ou um item com a regra de vencimento em "dataTexto". Não inclua obrigações da parte contrária.',
    '- "tarefas_escritorio": providências do ESCRITÓRIO (advogados/equipe): petições, prazos para cumprir, conferir pagamento, juntar comprovante, acompanhar homologação etc. "responsaveis": nomes como estão na ata, ou [] se não houver.',
    `- "data"/"prazo": data ISO (YYYY-MM-DD) somente se a ata der data certa ou prazo relativo calculável com certeza (a audiência foi em ${dataAudiencia}${diaSemana ? `, uma ${diaSemana}` : ''}). Caso contrário null — e copie o que a ata disser em "dataTexto"/"prazoTexto".`,
    '- "valor": o valor exatamente como aparece na ata (ex.: "R$ 5.000,00"), ou null.',
    '- Não invente obrigações, valores, datas nem pessoas. Se a ata não traz nada para o cliente, devolva a lista vazia.',
    `Equipe do escritório (referência de nomes): ${equipe.map(p => p.nome).join(', ')}.`,
  ].join('\n')
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

function isoValido(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return ISO.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) ? s : null
}

function textoOuNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s || null
}

export function normalizarExtracaoAta(raw: string, equipe: PessoaEquipe[]): ExtracaoAta {
  let json: Record<string, unknown>
  try { json = JSON.parse(raw) as Record<string, unknown> } catch { return { resumo: '', obrigacoesCliente: [], tarefasEscritorio: [] } }

  const obrigacoesCliente: ObrigacaoCliente[] = []
  for (const item of (Array.isArray(json.obrigacoes_cliente) ? json.obrigacoes_cliente : []) as Record<string, unknown>[]) {
    const titulo = String(item?.titulo ?? '').trim().slice(0, 160)
    if (!titulo) continue
    obrigacoesCliente.push({
      titulo,
      descricao: textoOuNull(item.descricao),
      data: isoValido(item.data),
      dataTexto: textoOuNull(item.dataTexto),
      valor: textoOuNull(item.valor),
    })
  }

  const tarefasEscritorio: TarefaEscritorio[] = []
  for (const item of (Array.isArray(json.tarefas_escritorio) ? json.tarefas_escritorio : []) as Record<string, unknown>[]) {
    const titulo = String(item?.titulo ?? '').trim().slice(0, 140)
    if (!titulo) continue
    const prazoTexto = textoOuNull(item.prazoTexto)
    const descricao = [textoOuNull(item.descricao), prazoTexto && `Prazo na ata: ${prazoTexto}`].filter(Boolean).join('\n') || null
    const prazo = isoValido(item.prazo)
    const nomes = Array.isArray(item.responsaveis) ? (item.responsaveis as unknown[]).map(n => String(n ?? '').trim()).filter(Boolean) : []
    if (nomes.length === 0) {
      tarefasEscritorio.push({ titulo, descricao, prazo, responsavelId: null, responsavelTexto: null })
      continue
    }
    const vistos = new Set<string>()
    for (const nome of nomes) {
      const id = resolverPessoa(nome, equipe)
      const chave = id ?? `texto:${nome.toLowerCase()}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      tarefasEscritorio.push({ titulo, descricao, prazo, responsavelId: id, responsavelTexto: id ? null : nome })
    }
  }

  return { resumo: String(json.resumo ?? '').trim(), obrigacoesCliente, tarefasEscritorio }
}
