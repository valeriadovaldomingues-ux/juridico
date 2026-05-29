import { normalizeSearchText } from '@/lib/cnpj'

export interface ComboboxOption {
  value: string
  label: string
  description?: string | null
  keywords?: string[]
  disabled?: boolean
}

export function normalizeComboboxText(text: string) {
  return normalizeSearchText(text).replace(/[^a-z0-9]+/g, '')
}

export function filterComboboxOptions(
  options: ComboboxOption[],
  query: string,
  limit = 20,
) {
  const q = normalizeComboboxText(query)
  if (!q) return options.slice(0, limit)

  return options
    .filter(option => {
      const haystack = [
        option.label,
        option.description ?? '',
        ...(option.keywords ?? []),
      ].map(normalizeComboboxText).join(' ')

      return haystack.includes(q)
    })
    .slice(0, limit)
}
