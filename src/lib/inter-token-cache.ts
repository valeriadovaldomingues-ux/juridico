// Guarda o token OAuth do Banco Inter até perto de vencer, em vez de pedir um novo a CADA chamada.
// Antes, cada boleto gerava vários pedidos (token + criar + token + consultar, com tentativas) e o Inter
// respondia 429 (Too Many Requests) logo nos primeiros boletos de um carnê.
// Lógica pura (sem rede): quem busca o token é passado por parâmetro, para poder testar.

export interface RespostaToken {
  access_token: string
  /** segundos de validade (o Inter costuma devolver 3600) */
  expires_in?: number
}

export const MARGEM_TOKEN_MS = 120_000 // renova 2 min antes de vencer
export const VALIDADE_MAXIMA_MS = 50 * 60_000 // nunca confia mais de 50 min, mesmo que o Inter diga mais
export const VALIDADE_PADRAO_S = 3000 // se o Inter não informar a validade

export function criarCacheToken(agora: () => number = Date.now) {
  let atual: { token: string; expiraEm: number } | null = null
  let emAndamento: Promise<string> | null = null

  return {
    /** Token válido: do cache se ainda estiver no prazo; senão busca UMA vez (chamadas simultâneas dividem o mesmo pedido). */
    obter(buscar: () => Promise<RespostaToken>): Promise<string> {
      if (atual && atual.expiraEm - MARGEM_TOKEN_MS > agora()) return Promise.resolve(atual.token)
      if (emAndamento) return emAndamento
      emAndamento = (async () => {
        try {
          const r = await buscar()
          const segundos = Number(r.expires_in) > 0 ? Number(r.expires_in) : VALIDADE_PADRAO_S
          atual = { token: r.access_token, expiraEm: agora() + Math.min(segundos * 1000, VALIDADE_MAXIMA_MS) }
          return r.access_token
        } finally {
          emAndamento = null
        }
      })()
      return emAndamento
    },
    /** Esquece o token (use quando o Inter recusar com 401). */
    limpar(): void {
      atual = null
    },
  }
}
