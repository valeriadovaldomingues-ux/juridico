// Depois do login, volta para a tela de autorização do conector do Claude (/oauth/authorize?...). Só esse destino é
// aceito do parâmetro `next` (caminho relativo, mesmo site): qualquer outro valor é ignorado, sem redirecionamento aberto.
export function destinoAposLogin(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/oauth/authorize') || next.startsWith('//') || next.includes('\\')) return null
  const resto = next.slice('/oauth/authorize'.length)
  return resto === '' || resto.startsWith('?') ? next : null
}
