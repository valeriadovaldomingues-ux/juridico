import type { SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { buildClienteLookupDescription } from '@/lib/processos/search'
import { normalizeSearchText } from '@/lib/cnpj'

export interface ClienteLookupRecord {
  id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  celular: string | null
  email: string | null
}

export interface ProcessoLookupRecord {
  value: string
  label: string
  description: string | null
}

export interface UsuarioLookupRecord {
  id: string
  nome: string
  email: string | null
  role: string | null
}

const ROLE_LABELS: Record<string, string> = {
  estagiario: 'Estagiário',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
  advogado: 'Advogado',
  gerente: 'Gerente',
  socio: 'Sócio',
  cliente: 'Cliente',
}

export function buildUsuarioLookupDescription(user: UsuarioLookupRecord) {
  const role = user.role ? (ROLE_LABELS[user.role] ?? user.role) : ''
  const email = user.email?.trim() ?? ''
  return [role || null, email || null].filter(Boolean).join(' · ') || null
}

export function buildClienteLookupOption(cliente: ClienteLookupRecord): SearchableComboboxOption {
  return {
    value: cliente.id,
    label: cliente.nome,
    description: buildClienteLookupDescription(cliente),
    keywords: [
      cliente.nome,
      cliente.cpf_cnpj,
      cliente.telefone,
      cliente.celular,
      cliente.email,
    ].filter(Boolean) as string[],
  }
}

export function buildProcessoLookupOption(record: ProcessoLookupRecord): SearchableComboboxOption {
  return {
    value: record.value,
    label: record.label,
    description: record.description,
    keywords: [record.label, record.description ?? ''].filter(Boolean),
  }
}

async function fetchCombobox<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json() as Promise<T[]>
}

export async function fetchClienteOptions(query: string, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const data = await fetchCombobox<ClienteLookupRecord>(`/api/clientes/busca?${params.toString()}`)
  return data.map(buildClienteLookupOption)
}

export async function fetchProcessoOptions(query: string, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const data = await fetchCombobox<ProcessoLookupRecord>(`/api/processos/busca?${params.toString()}`)
  return data.map(buildProcessoLookupOption)
}

export async function fetchUsuarioOptions(query: string, limit = 10) {
  const normalized = normalizeSearchText(query)
  const params = new URLSearchParams({ q: normalized || query, limit: String(limit) })
  const data = await fetchCombobox<UsuarioLookupRecord>(`/api/profiles/busca?${params.toString()}`)
  return data.map(user => ({
    value: user.id,
    label: user.nome,
    description: buildUsuarioLookupDescription(user),
    keywords: [user.nome, user.email, user.role].filter(Boolean) as string[],
  }))
}
