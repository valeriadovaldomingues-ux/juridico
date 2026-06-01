export interface OlavoDriveResposta {
  response: string
  specialist_used: string | null
  session_id: string
}

const OLAVO_DRIVE_URL = process.env.OLAVO_DRIVE_URL ?? 'http://localhost:8000'
const TIMEOUT_MS = 30_000

export async function consultarOlavoDrive(mensagem: string): Promise<OlavoDriveResposta> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${OLAVO_DRIVE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mensagem }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Olavo Drive retornou status ${res.status}`)
    }

    return (await res.json()) as OlavoDriveResposta
  } finally {
    clearTimeout(timeoutId)
  }
}

export function montarContextoOlavoDrive(resposta: OlavoDriveResposta) {
  return [
    'CONTEXTO DO SISTEMA - OLAVO DRIVE',
    'Fonte: Olavo Drive — sistema de agentes especialistas do Pessoa e do Val Advocacia.',
    resposta.specialist_used
      ? `Especialista consultado: ${resposta.specialist_used}`
      : 'Análise jurídica geral (sem especialista específico identificado).',
    '',
    'Análise do especialista:',
    resposta.response,
  ].join('\n')
}
