/** Segura a resposta até completar `minimoMs` desde `inicio`, para o tempo não revelar o que aconteceu. */
export async function normalizarTempo(inicio: number, minimoMs: number): Promise<void> {
  const restante = minimoMs - (Date.now() - inicio)
  if (restante > 0) await new Promise<void>(resolve => setTimeout(resolve, restante))
}
