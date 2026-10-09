import { resolverPessoa, type PessoaEquipe } from './resolver-pessoa'

export interface TarefaSugerida {
  titulo: string
  descricao: string | null
  prazo: string | null            // YYYY-MM-DD
  responsavelId: string | null    // resolvido na equipe
  responsavelTexto: string | null // nome como a ata cita (quando não deu para resolver)
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function promptSistemaExtracao(equipe: PessoaEquipe[], dataReuniao: string): string {
  const d = new Date(`${dataReuniao}T12:00:00Z`)
  const diaSemana = Number.isNaN(d.getTime()) ? '' : DIAS[d.getUTCDay()]
  return [
    'Você lê a ata de uma reunião interna de um escritório de advocacia e extrai as TAREFAS (encaminhamentos) com responsável.',
    'Responda somente em JSON: {"tarefas":[{"titulo":string,"descricao":string|null,"responsaveis":string[],"prazo":string|null,"prazoTexto":string|null}]}.',
    'Regras:',
    '- Só inclua providências concretas atribuídas a alguém ou a um grupo (ex.: quadro de encaminhamentos, "Fulano fará…", "ficou a cargo de…"). Não transforme discussões, contexto ou decisões sem responsável em tarefas.',
    '- "responsaveis": os nomes EXATAMENTE como aparecem na ata (um nome por item). Se houver vários responsáveis, liste todos. Se for um cargo/grupo ("Advogado responsável", "Equipe jurídica"), use esse texto. Se não houver, use [].',
    '- "titulo": curto e no imperativo/infinitivo, até 90 caracteres. "descricao": detalhe útil da ata, sem inventar.',
    `- "prazo": data ISO (YYYY-MM-DD) somente se a ata der data certa ou um prazo relativo calculável com certeza (a reunião foi em ${dataReuniao}${diaSemana ? `, uma ${diaSemana}` : ''}). Caso contrário null. Copie o prazo/periodicidade dito na ata em "prazoTexto".`,
    '- Não invente tarefas, pessoas nem datas.',
    `Equipe do escritório (para referência de nomes): ${equipe.map(p => p.nome).join(', ')}.`,
  ].join('\n')
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Lê a resposta da IA e devolve uma tarefa por pessoa (várias pessoas = várias tarefas). */
export function normalizarTarefasIA(raw: string, equipe: PessoaEquipe[]): TarefaSugerida[] {
  let json: unknown
  try { json = JSON.parse(raw) } catch { return [] }
  const lista = (json as { tarefas?: unknown })?.tarefas
  if (!Array.isArray(lista)) return []

  const saida: TarefaSugerida[] = []
  for (const item of lista as Record<string, unknown>[]) {
    const titulo = String(item?.titulo ?? '').trim().slice(0, 140)
    if (!titulo) continue

    const prazoTexto = String(item?.prazoTexto ?? '').trim()
    const detalhe = String(item?.descricao ?? '').trim()
    const descricao = [detalhe, prazoTexto && `Prazo/periodicidade na ata: ${prazoTexto}`].filter(Boolean).join('\n') || null
    const prazoBruto = String(item?.prazo ?? '').trim()
    const prazo = ISO.test(prazoBruto) && !Number.isNaN(new Date(`${prazoBruto}T12:00:00Z`).getTime()) ? prazoBruto : null

    const nomes = Array.isArray(item?.responsaveis)
      ? (item.responsaveis as unknown[]).map(n => String(n ?? '').trim()).filter(Boolean)
      : []

    if (nomes.length === 0) {
      saida.push({ titulo, descricao, prazo, responsavelId: null, responsavelTexto: null })
      continue
    }
    const vistos = new Set<string>()
    for (const nome of nomes) {
      const id = resolverPessoa(nome, equipe)
      const chave = id ?? `texto:${nome.toLowerCase()}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      saida.push({ titulo, descricao, prazo, responsavelId: id, responsavelTexto: id ? null : nome })
    }
  }
  return saida
}
