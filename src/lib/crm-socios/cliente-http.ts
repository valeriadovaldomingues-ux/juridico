// CRM Cris e Val — chamada às APIs a partir do navegador, com erro em português.

/**
 * Faz a requisição e devolve o JSON. Lança Error com mensagem pronta para mostrar na tela:
 *  - sessão expirada (o proxy redireciona para /login e o fetch recebe HTML);
 *  - erro devolvido pela API (`{ error }`), inclusive "módulo ainda não ativado" (503).
 */
export async function requisitar<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.')
  }
  const tipo = res.headers.get('content-type') ?? ''
  if (res.redirected || tipo.includes('text/html')) {
    throw new Error('Sua sessão expirou. Entre novamente e tente de novo.')
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(json?.error ?? 'Não foi possível concluir a operação.')
  if (json === null) throw new Error('Resposta inesperada do servidor.')
  return json
}

export function jsonInit(metodo: 'POST' | 'PATCH' | 'DELETE', corpo?: unknown): RequestInit {
  return {
    method: metodo,
    ...(corpo !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : {}),
  }
}
