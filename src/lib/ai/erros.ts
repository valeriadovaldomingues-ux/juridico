/** Mensagem clara quando a IA falha por falta de crédito/cota na conta da OpenAI (erro 429 insufficient_quota). */
export function mensagemFalhaIA(err: unknown, padrao: string): string {
  const e = err as { status?: number; code?: string; type?: string } | null
  if (e?.status === 429 && (e.code === 'credit_balance_exhausted' || e.type === 'insufficient_quota' || e.code === 'insufficient_quota')) {
    return 'Os créditos da IA acabaram (conta OpenAI sem saldo). Peça a quem administra o sistema para adicionar créditos em platform.openai.com → Billing. Enquanto isso, dá para cadastrar as tarefas manualmente.'
  }
  return padrao
}
