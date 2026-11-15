// ─── Normalização e comparação de nomes ──────────────────────────────────────
//
// O DJEN só busca por NOME e de forma difusa (buscar "X Serviços de Engenharia
// Ltda" também traz "X Soluções Tecnológicas Ltda"). Por isso todo resultado é
// filtrado localmente: só vale a comunicação cujo destinatário tenha nome IGUAL
// a um dos nomes monitorados.
//
// Regra de igualdade (decisão documentada):
//   1. sem acento, minúsculas, "&" vira "e", sem pontuação, espaços colapsados;
//   2. "S/A", "S.A." e variantes viram "sa";
//   3. sufixos societários no FIM do nome são descartados (ltda, limitada, me,
//      epp, eireli, mei, sa), inclusive empilhados ("LTDA ME", "LTDA - EPP");
//   4. depois disso, os nomes têm de ser exatamente iguais.
// Assim "ACME LTDA." == "Acme Ltda" == "ACME LTDA - ME" == "ACME S.A." == "ACME".
// O miolo do nome nunca é flexibilizado: "IRRICOM SERVICOS DE ENGENHARIA" e
// "IRRICOM SOLUCOES TECNOLOGICAS" continuam diferentes.

const SUFIXOS_SOCIETARIOS = new Set(['ltda', 'limitada', 'me', 'epp', 'eireli', 'mei', 'sa'])

/** Forma canônica do nome para comparação (ver regra no topo do arquivo). */
export function normalizarNome(nome: string | null | undefined): string {
  const base = String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // S/A, S.A., S. A., S/A. → "sa"
    .replace(/\bs\s*[./]\s*a\b\.?/g, ' sa ')
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = base.split(' ').filter(Boolean)
  while (tokens.length > 1 && SUFIXOS_SOCIETARIOS.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(' ')
}

/** Dois nomes são "iguais" quando a forma canônica coincide (e não é vazia). */
export function nomesIguais(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarNome(a)
  return na !== '' && na === normalizarNome(b)
}

/** Remove nomes vazios e repetidos (comparando pela forma canônica), preservando a grafia da 1ª ocorrência. */
export function nomesUnicos(nomes: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const nome of nomes) {
    const limpo = String(nome ?? '').replace(/\s+/g, ' ').trim()
    const chave = normalizarNome(limpo)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(limpo)
  }
  return saida
}
