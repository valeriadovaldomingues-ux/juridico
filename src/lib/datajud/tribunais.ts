// Qual "alias" da API pública do DataJud (CNJ) consulta o processo, a partir dos dígitos J.TR do número único (CNJ).
// NNNNNNN DD AAAA J TR OOOO  →  J (índice 13) = ramo da Justiça; TR (14–15) = tribunal.

const TJ_POR_TR: Record<string, string> = {
  '01': 'tjac', '02': 'tjal', '03': 'tjap', '04': 'tjam', '05': 'tjba', '06': 'tjce', '07': 'tjdft', '08': 'tjes', '09': 'tjgo',
  '10': 'tjma', '11': 'tjmt', '12': 'tjms', '13': 'tjmg', '14': 'tjpa', '15': 'tjpb', '16': 'tjpr', '17': 'tjpe', '18': 'tjpi',
  '19': 'tjrj', '20': 'tjrn', '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc', '25': 'tjse', '26': 'tjsp', '27': 'tjto',
}

export const soDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/** Alias do DataJud ("api_publica_tjmg", "api_publica_trt3"…) ou null quando não há como consultar (número fora do padrão, justiça não coberta). */
export function aliasDoDataJud(numero: string | null | undefined): string | null {
  const cnj = soDigitos(numero)
  if (cnj.length !== 20) return null
  const ramo = cnj[13]
  const tr = cnj.slice(14, 16)
  const n = Number(tr)
  let sigla: string | undefined
  if (ramo === '8') sigla = TJ_POR_TR[tr]
  else if (ramo === '5' && n >= 1 && n <= 24) sigla = `trt${n}`
  else if (ramo === '4' && n >= 1 && n <= 6) sigla = `trf${n}`
  else if (ramo === '3' && tr === '00') sigla = 'stj'
  else if (ramo === '5' && tr === '00') sigla = 'tst'
  return sigla ? `api_publica_${sigla}` : null
}
