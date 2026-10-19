/**
 * Camada central de IA — todos os módulos passam por aqui.
 *
 * Configuração via variáveis de ambiente:
 *   OPENAI_API_KEY   — obrigatória (ou AI_API_KEY como alias compatível)
 *   OPENAI_MODEL     — opcional, padrão "gpt-4o-mini"
 *   OPENAI_BASE_URL  — opcional, permite usar Azure OpenAI / proxies compatíveis
 *
 * Ou, para usar o Claude (Anthropic): ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL opcional). Com ela definida,
 * toda a IA passa a usar o Claude; AI_PROVIDER=openai força a OpenAI. Ver ./anthropic.ts.
 */

import OpenAI from 'openai'
import { anthropicCompletar, anthropicStream, modeloAnthropic, usaAnthropic } from './anthropic'

export const AI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

/** Há alguma chave de IA configurada (Claude ou OpenAI)? */
export function iaConfigurada(): boolean {
  return usaAnthropic() || !!(process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY)
}

/** Modelo em uso (Claude ou OpenAI), para mensagens e logs. */
export function modeloEmUso(): string { return usaAnthropic() ? modeloAnthropic() : AI_MODEL }

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY ou AI_API_KEY não configurada. Adicione ao arquivo .env.local e reinicie o servidor.'
    )
  }
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL, // undefined = padrão OpenAI
  })
  return _client
}

/**
 * Streaming de texto puro.
 * Retorna um ReadableStream<Uint8Array> com os deltas de texto conforme chegam.
 * Use para peças jurídicas e respostas longas — o usuário vê o texto aparecer em tempo real.
 */
export function streamTexto(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { maxTokens?: number; temperature?: number },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  if (usaAnthropic()) {
    return new ReadableStream({
      async start(controller) {
        try {
          const leitor = (await anthropicStream(messages, { maxTokens: opts?.maxTokens ?? 4096, temperature: opts?.temperature ?? 0.7 })).getReader()
          for (;;) { const { done, value } = await leitor.read(); if (done) break; controller.enqueue(value) }
          controller.close()
        } catch (err) { controller.error(err) }
      },
    })
  }
  const client  = getClient()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.chat.completions.create({
          model:       AI_MODEL,
          messages,
          max_tokens:  opts?.maxTokens  ?? 4096,
          temperature: opts?.temperature ?? 0.7,
          stream:      true,
        })

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

/**
 * Streaming com preflight.
 * Cria a chamada de streaming antes de devolver o Response ao Next, permitindo
 * que rotas capturem erros de autenticação/modelo/rede e retornem JSON legível.
 */
export async function streamTextoPreflight(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  if (usaAnthropic()) return anthropicStream(messages, { maxTokens: opts?.maxTokens ?? 4096, temperature: opts?.temperature ?? 0.7 })
  const client  = getClient()
  const stream  = await client.chat.completions.create({
    model:       AI_MODEL,
    messages,
    max_tokens:  opts?.maxTokens  ?? 4096,
    temperature: opts?.temperature ?? 0.7,
    stream:      true,
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao consumir stream de IA'
        controller.enqueue(encoder.encode(`\n\n[Erro no streaming da Aurora: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Resposta completa em texto puro.
 * Use como fallback quando streaming não for adequado ou falhar no preflight.
 */
export async function completarTexto(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  if (usaAnthropic()) return anthropicCompletar(messages, { maxTokens: opts?.maxTokens ?? 3072, temperature: opts?.temperature ?? 0.5 })
  const client = getClient()
  const res = await client.chat.completions.create({
    model:       AI_MODEL,
    messages,
    max_tokens:  opts?.maxTokens  ?? 3072,
    temperature: opts?.temperature ?? 0.5,
  })
  return res.choices[0]?.message?.content ?? ''
}

/**
 * Resposta completa em JSON.
 * Use para análises estruturadas (ex: publicações) onde precisamos parsear o resultado.
 */
export async function completarJSON(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { temperature?: number },
): Promise<string> {
  if (usaAnthropic()) return anthropicCompletar(messages, { maxTokens: 4096, temperature: opts?.temperature ?? 0.3, json: true })
  const client = getClient()
  const res = await client.chat.completions.create({
    model:           AI_MODEL,
    messages,
    response_format: { type: 'json_object' },
    temperature:     opts?.temperature ?? 0.3,
    max_tokens:      2048,
  })
  return res.choices[0]?.message?.content ?? '{}'
}
