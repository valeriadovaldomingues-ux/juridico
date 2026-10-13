import type { InpiProcesso } from '@/types/inpi'
import { calcularDecenio } from '@/types/inpi'

export type OrdemInpi = 'marca' | 'cliente' | 'decenio' | 'numero' | 'recentes'

export const ORDENS_INPI: { id: OrdemInpi; label: string }[] = [
  { id: 'marca', label: 'Ordem alfabética (marca)' },
  { id: 'cliente', label: 'Cliente (A–Z)' },
  { id: 'decenio', label: 'Decênio mais próximo' },
  { id: 'numero', label: 'Nº do pedido' },
  { id: 'recentes', label: 'Cadastro mais recente' },
]

export const ORDEM_INPI_PADRAO: OrdemInpi = 'marca'

// Alfabética do português: ignora acento e maiúscula ("Ótica" fica junto de "Otica"), números em ordem natural.
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const txt = (v: string | null | undefined) => (v ?? '').trim()

/** Vencimento efetivo da vigência (já com as prorrogações); null se não é concedido. */
function vencimentoMs(p: InpiProcesso): number | null {
  if (p.status !== 'concedido' || !p.data_concessao) return null
  return calcularDecenio(p.data_concessao, p.prorrogacoes ?? 0).vencimento.getTime()
}

function porMarca(a: InpiProcesso, b: InpiProcesso) {
  return collator.compare(txt(a.titulo), txt(b.titulo)) || collator.compare(txt(a.numero_processo), txt(b.numero_processo))
}

/** Devolve uma cópia ordenada; nunca altera a lista recebida. */
export function ordenarInpi(lista: InpiProcesso[], ordem: OrdemInpi): InpiProcesso[] {
  const copia = [...lista]
  switch (ordem) {
    case 'marca':
      return copia.sort(porMarca)
    case 'cliente':
      // Quem não tem cliente vai para o fim.
      return copia.sort((a, b) => {
        const ca = txt(a.cliente?.nome), cb = txt(b.cliente?.nome)
        if (!ca !== !cb) return ca ? -1 : 1
        return collator.compare(ca, cb) || porMarca(a, b)
      })
    case 'decenio':
      // Concedidos com data de concessão, da vigência que vence primeiro (já contando as prorrogações) à que vence por último;
      // o resto (em andamento, indeferido, arquivado…) vai depois, em ordem alfabética.
      return copia.sort((a, b) => {
        const va = vencimentoMs(a), vb = vencimentoMs(b)
        if ((va === null) !== (vb === null)) return va === null ? 1 : -1
        if (va !== null && vb !== null && va !== vb) return va - vb
        return porMarca(a, b)
      })
    case 'numero':
      return copia.sort((a, b) => collator.compare(txt(a.numero_processo), txt(b.numero_processo)))
    case 'recentes':
      return copia.sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : porMarca(a, b)))
  }
}

export function ordemInpiValida(valor: string | null | undefined): OrdemInpi {
  return ORDENS_INPI.some(o => o.id === valor) ? (valor as OrdemInpi) : ORDEM_INPI_PADRAO
}
