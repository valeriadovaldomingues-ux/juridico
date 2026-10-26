// O advogado responsável de todo processo é sempre a Valéria (sócia). O segundo campo,
// "quem cuida do caso" (processos.advogado_caso_id), diz quem toca o processo no dia a dia.

export const ADVOGADO_RESPONSAVEL_ID = 'a7eccddf-443a-408d-be21-23a285093fca'
export const ADVOGADO_RESPONSAVEL_NOME = 'Valéria do Val'

/** Quem recebe o trabalho do processo (agenda, assinatura de e-mail): quem cuida do caso, senão a responsável. */
export function quemCuidaOuResponsavel(p: { advogado_caso_id?: string | null; advogado_responsavel_id?: string | null }): string | null {
  return p.advogado_caso_id ?? p.advogado_responsavel_id ?? null
}
