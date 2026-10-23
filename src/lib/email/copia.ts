import { createServiceClient } from '@/lib/supabase/service'
import { emailValido } from './mailer'

// Todo e-mail ao cliente sai, obrigatoriamente, com cópia para o advogado responsável pelo processo
// e para quem está enviando. Isso é decidido no servidor: o que vier do formulário só acrescenta.

export interface CopiaObrigatoria { papel: 'responsavel' | 'caso' | 'remetente'; nome: string | null; email: string }

/** Une as cópias obrigatórias às extras, sem repetir e sem incluir quem já está em "Para". */
export function juntarCopias(obrigatorias: string[], extras: string[], para: string[]): string[] {
  const jaNoPara = new Set(para.map(e => e.toLowerCase()))
  const saida: string[] = []
  for (const e of [...obrigatorias, ...extras].map(e => e.trim().toLowerCase())) {
    if (e && !jaNoPara.has(e) && !saida.includes(e)) saida.push(e)
  }
  return saida
}

/**
 * Busca o e-mail do advogado responsável e de quem envia. Se faltar o e-mail de alguém que precisa
 * estar em cópia, devolve `erro` (o envio não pode seguir sem eles).
 */
export async function copiaObrigatoria(advogadoResponsavelId: string | null, remetenteId: string, advogadoCasoId: string | null = null):
  Promise<{ copias: CopiaObrigatoria[]; erro?: string }> {
  const service = createServiceClient()
  const ids = [...new Set([advogadoResponsavelId, advogadoCasoId, remetenteId].filter((x): x is string => !!x))]
  const { data } = await service.from('profiles').select('id, nome, email').in('id', ids)
  const porId = new Map((data ?? []).map(p => [p.id as string, p as { id: string; nome: string | null; email: string | null }]))

  const copias: CopiaObrigatoria[] = []
  const faltando: string[] = []
  const incluir = (id: string | null, papel: CopiaObrigatoria['papel']) => {
    if (!id) return
    const p = porId.get(id)
    if (p?.email && emailValido(p.email)) copias.push({ papel, nome: p.nome, email: p.email.toLowerCase() })
    else faltando.push(`${papel === 'responsavel' ? 'do advogado responsável' : papel === 'caso' ? 'de quem cuida do caso' : 'de quem está enviando'}${p?.nome ? ` (${p.nome})` : ''}`)
  }
  incluir(advogadoResponsavelId, 'responsavel')
  if (advogadoCasoId && advogadoCasoId !== advogadoResponsavelId) incluir(advogadoCasoId, 'caso')
  incluir(remetenteId, 'remetente')
  if (faltando.length) {
    return { copias, erro: `Falta o e-mail ${faltando.join(' e ')} no cadastro de usuários. Cadastre antes de enviar — o advogado responsável, quem cuida do caso e quem envia sempre vão em cópia.` }
  }
  return { copias }
}
