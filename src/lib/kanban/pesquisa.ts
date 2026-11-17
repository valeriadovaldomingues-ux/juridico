// Pesquisa do Kanban "em tudo": para cada processo achado, quando foi a última movimentação e o que há dele no Kanban.

export interface CartaoDoProcesso {
  id: string
  titulo: string
  status: string
  arquivado: boolean
  concluidoEm: string | null
  responsavel: string | null
  origem: string | null
  prazo: string | null
}

export interface MovimentacaoRecente { data: string; fonte: 'andamento' | 'publicacao'; titulo: string | null }

/** Dias inteiros entre duas datas AAAA-MM-DD (hoje - data); nunca negativo. */
export function diasSemMovimento(data: string | null | undefined, hoje: string): number | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}/.test(data)) return null
  const d = Date.parse(`${data.slice(0, 10)}T12:00:00Z`)
  const h = Date.parse(`${hoje}T12:00:00Z`)
  if (Number.isNaN(d) || Number.isNaN(h)) return null
  return Math.max(0, Math.round((h - d) / 86400000))
}

/** A mais recente entre a última movimentação do processo (andamento) e a última publicação. Datas futuras são ignoradas. */
export function movimentacaoMaisRecente(
  andamento: { data: string | null; titulo: string | null } | null,
  publicacao: { data: string | null; titulo: string | null } | null,
  hoje: string,
): MovimentacaoRecente | null {
  const cand: MovimentacaoRecente[] = []
  if (andamento?.data && andamento.data.slice(0, 10) <= hoje) cand.push({ data: andamento.data.slice(0, 10), fonte: 'andamento', titulo: andamento.titulo })
  if (publicacao?.data && publicacao.data.slice(0, 10) <= hoje) cand.push({ data: publicacao.data.slice(0, 10), fonte: 'publicacao', titulo: publicacao.titulo })
  if (cand.length === 0) return null
  return cand.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))[0]
}

/** O cartão é deste processo? Por vínculo (id), pelo número gravado no cartão ou pelo número escrito no título (cartões do Trello). */
export function cartaoEDoProcesso(
  c: { processoId: string | null; numeroProcesso: string | null; titulo: string },
  p: { id: string; numero: string | null },
): boolean {
  if (c.processoId && c.processoId === p.id) return true
  if (!p.numero) return false
  if (c.numeroProcesso && c.numeroProcesso === p.numero) return true
  const digitos = p.numero.replace(/\D/g, '')
  return c.titulo.includes(p.numero) || (digitos.length >= 15 && c.titulo.replace(/\D/g, '').includes(digitos))
}
