import { usaAnthropic } from './anthropic'

/** Há alguma chave de IA configurada (Claude ou OpenAI)? Fica fora de service.ts para as rotas poderem checar sem carregar o SDK. */
export function iaConfigurada(env: Record<string, string | undefined> = process.env): boolean {
  return usaAnthropic(env) || !!(env.OPENAI_API_KEY ?? env.AI_API_KEY)
}
