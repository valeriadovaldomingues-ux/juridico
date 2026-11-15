import { NextResponse } from 'next/server'
import { PortalIndisponivel } from './segredos'
import { checkContentLength } from '@/lib/portal/validate'

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export function json(corpo: unknown, status = 200): NextResponse {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export function portalIndisponivel(): NextResponse {
  return json({ error: 'O portal do cliente ainda não está disponível. Fale com o escritório.' }, 503)
}

/** Lê o corpo JSON com limite de tamanho. Devolve { erro } com a resposta pronta se algo falhar. */
export async function lerCorpoJson(request: Request): Promise<{ corpo: Record<string, unknown> } | { erro: NextResponse }> {
  const tamanho = checkContentLength(request, 8 * 1024)
  if (tamanho) return { erro: json({ error: tamanho }, 413) }
  try {
    const corpo = await request.json()
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return { erro: json({ error: 'Requisição inválida.' }, 400) }
    return { corpo: corpo as Record<string, unknown> }
  } catch {
    return { erro: json({ error: 'Requisição inválida.' }, 400) }
  }
}

/** Erro inesperado numa rota de dados: portal fora do ar (503) ou 500 sem detalhes. Nunca vaza mensagem interna. */
export function tratarErro(e: unknown, onde: string): NextResponse {
  if (e instanceof PortalIndisponivel) return portalIndisponivel()
  console.error(`[portal] erro em ${onde}`)
  return json({ error: 'Não foi possível carregar agora. Tente novamente em instantes.' }, 500)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function emBreve(..._args: unknown[]): NextResponse {
  return json({ error: 'Em breve.' }, 404)
}
