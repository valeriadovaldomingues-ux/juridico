import { after } from 'next/server'

/** Roda a tarefa depois da resposta (envio de e-mail não pode alterar o tempo de resposta). Nunca lança. */
export function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = () => tarefa().catch(() => { /* silencioso: sem dado pessoal em log */ })
  try {
    after(executar)
  } catch {
    void executar()
  }
}
