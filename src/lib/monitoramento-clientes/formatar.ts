// Formatação de exibição (pura; segura para o bundle do navegador).

/** Máscara CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO) a partir de 20 dígitos; devolve o texto original se não tiver 20. */
export function formatarNumeroCNJ(numero: string): string {
  const d = numero.replace(/\D/g, '')
  if (d.length !== 20) return numero
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`
}

/** AAAA-MM-DD (ou timestamp ISO) → DD/MM/AAAA; sem data devolve "data não informada". */
export function dataBR(iso: string | null | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : 'data não informada'
}
