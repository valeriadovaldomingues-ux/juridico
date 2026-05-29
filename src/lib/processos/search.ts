import type { SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { formatCPFCNPJ, formatPhone } from '@/lib/utils'

export interface ProcessoSearchRecord {
  id: string
  numero_processo: string | null
  titulo: string
  area_direito: string | null
  status: string | null
  cliente?: { nome: string } | { nome: string }[] | null
  partes_processo?: { pessoa_nome: string; tipo_parte: string }[] | null
}

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível',
  trabalhista: 'Trabalhista',
  criminal: 'Criminal',
  tributario: 'Tributário',
  previdenciario: 'Previdenciário',
  administrativo: 'Administrativo',
  familia: 'Família',
  empresarial: 'Empresarial',
  outro: 'Outro',
}

function getParteContraria(record: ProcessoSearchRecord) {
  const partes = record.partes_processo ?? []
  const nomes = partes
    .filter(parte => ['reu', 'outro', 'terceiro'].includes(parte.tipo_parte))
    .map(parte => parte.pessoa_nome.trim())
    .filter(Boolean)

  return nomes.length > 0 ? nomes.join(', ') : null
}

function getClienteNome(cliente: ProcessoSearchRecord['cliente']) {
  if (!cliente) return ''
  if (Array.isArray(cliente)) return cliente[0]?.nome?.trim() ?? ''
  return cliente.nome?.trim() ?? ''
}

export function buildProcessoLookupOption(record: ProcessoSearchRecord): SearchableComboboxOption {
  const numero = record.numero_processo?.trim() ?? ''
  const cliente = getClienteNome(record.cliente)
  const parteContraria = getParteContraria(record) ?? ''
  const area = record.area_direito ? (AREA_LABELS[record.area_direito] ?? record.area_direito) : ''
  const status = record.status?.trim() ?? ''

  const description = [
    cliente ? `Cliente: ${cliente}` : null,
    parteContraria ? `Parte contrária: ${parteContraria}` : null,
    area ? `Área: ${area}` : null,
    status ? `Status: ${status}` : null,
  ].filter(Boolean).join(' · ')

  return {
    value: record.id,
    label: numero ? `${numero} — ${record.titulo}` : record.titulo,
    description: description || null,
    keywords: [numero, record.titulo, cliente, parteContraria, area, status].filter(Boolean) as string[],
  }
}

export function buildClienteLookupDescription(cliente: {
  cpf_cnpj?: string | null
  telefone?: string | null
  celular?: string | null
  email?: string | null
}) {
  const cpfCnpj = cliente.cpf_cnpj ? formatCPFCNPJ(cliente.cpf_cnpj) : ''
  const phone = cliente.celular ?? cliente.telefone ?? ''
  const parts = [
    cpfCnpj || null,
    phone ? formatPhone(phone) : null,
    cliente.email ?? null,
  ].filter(Boolean)

  return parts.join(' · ')
}
