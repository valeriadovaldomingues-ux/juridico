import type { TrelloBoard, TrelloCard, TrelloList, TrelloMember } from '@/types/trello'

const BASE = 'https://api.trello.com/1'

async function trelloFetch<T>(endpoint: string, key: string, token: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${BASE}${endpoint}${sep}key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`

  const res = await fetch(url, { method, next: { revalidate: 0 } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Trello ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function fetchBoard(boardId: string, key: string, token: string): Promise<TrelloBoard> {
  return trelloFetch<TrelloBoard>(`/boards/${boardId}?fields=id,name`, key, token)
}

export function fetchLists(boardId: string, key: string, token: string): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists?fields=id,name,closed`, key, token)
}

export function fetchMembers(boardId: string, key: string, token: string): Promise<TrelloMember[]> {
  return trelloFetch<TrelloMember[]>(
    `/boards/${boardId}/members?fields=id,username,fullName`,
    key, token,
  )
}

export function fetchOpenCards(boardId: string, key: string, token: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(
    `/boards/${boardId}/cards?filter=open&fields=id,name,desc,idList,idMembers,due,labels,closed`,
    key, token,
  )
}

/** Cria um card novo numa lista. idMembers vira o parâmetro `idMembers`
 *  aceito pelo POST /1/cards do Trello (mesma chamada já atribui os
 *  membros — o Trello notifica cada um por e-mail sozinho). */
export function createCard(
  listId: string,
  card: { name: string; desc?: string; idMembers?: string[] },
  key: string,
  token: string,
): Promise<TrelloCard> {
  const params = new URLSearchParams({ idList: listId, name: card.name })
  if (card.desc) params.set('desc', card.desc)
  if (card.idMembers?.length) params.set('idMembers', card.idMembers.join(','))
  return trelloFetch<TrelloCard>(`/cards?${params.toString()}`, key, token, 'POST')
}
