// Pedido da Valéria em 13/10/2026: limpar as publicações antigas e trazer só de HOJE para a frente.
// Publicação com data anterior a esta é ignorada na importação (sem isso, uma busca por data antiga
// traria de volta o que foi apagado). Para voltar a importar histórico, mude/retire esta data.
export const PUBLICACOES_DATA_MINIMA = '2026-10-13'

/** Aceita "YYYY-MM-DD…" ou "DD/MM/YYYY". Data que não dá para ler NÃO é descartada (melhor trazer do que perder). */
export function publicacaoAnteriorADataMinima(dataPublicacao: string | null | undefined, minima = PUBLICACOES_DATA_MINIMA): boolean {
  const s = String(dataPublicacao ?? '').trim()
  let iso: string | null = null
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const b = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (a) iso = `${a[1]}-${a[2]}-${a[3]}`
  else if (b) iso = `${b[3]}-${b[2]}-${b[1]}`
  return iso !== null && iso < minima
}
