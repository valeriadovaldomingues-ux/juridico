import type { InpiProcesso } from '@/types/inpi'

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
      // Concedidos com data de concessão, do decênio mais perto de vencer (concessão mais antiga) ao mais longe;
      // o resto (em andamento, indeferido, arquivado…) vai depois, em ordem alfabética.
      return copia.sort((a, b) => {
        const da = a.status === 'concedido' ? a.data_concessao : null
        const db = b.status === 'concedido' ? b.data_concessao : null
        if (!da !== !db) return da ? -1 : 1
        if (da && db && da !== db) return da < db ? -1 : 1
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
