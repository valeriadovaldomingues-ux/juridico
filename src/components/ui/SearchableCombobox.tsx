'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filterComboboxOptions, type ComboboxOption } from '@/lib/search/combobox'

export type { ComboboxOption as SearchableComboboxOption }

interface Props {
  value: string
  onChange: (value: string, option: ComboboxOption | null) => void
  options?: ComboboxOption[]
  loadOptions?: (query: string) => Promise<ComboboxOption[]>
  selectedOption?: ComboboxOption | null
  placeholder?: string
  searchPlaceholder?: string
  helperText?: string
  noResultsText?: string
  emptyText?: string
  loadingText?: string
  allowClear?: boolean
  clearLabel?: string
  createHref?: string
  createLabel?: string
  minSearchLength?: number
  maxResults?: number
  disabled?: boolean
  className?: string
}

export default function SearchableCombobox({
  value,
  onChange,
  options = [],
  loadOptions,
  selectedOption = null,
  placeholder = 'Selecionar…',
  searchPlaceholder = 'Digite para buscar…',
  helperText,
  noResultsText = 'Nenhum resultado encontrado.',
  emptyText = 'Digite para buscar.',
  loadingText = 'Buscando…',
  allowClear = false,
  clearLabel = 'Limpar',
  createHref,
  createLabel = 'Cadastrar novo',
  minSearchLength = 2,
  maxResults = 20,
  disabled = false,
  className,
}: Props) {
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remoteOptions, setRemoteOptions] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = selectedOption ?? options.find(option => option.value === value) ?? null
  const localOptions = useMemo(() => options, [options])

  const visibleOptions = useMemo(() => {
    if (loadOptions) return remoteOptions
    return filterComboboxOptions(localOptions, query, maxResults)
  }, [localOptions, loadOptions, maxResults, query, remoteOptions])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    if (!open || !loadOptions) return

    const q = query.trim()
    if (q.length < minSearchLength) {
      setRemoteOptions([])
      setLoading(false)
      setActiveIndex(0)
      return
    }

    let cancelled = false
    setLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const result = await loadOptions(q)
        if (cancelled) return
        setRemoteOptions(result.slice(0, maxResults))
        setActiveIndex(0)
      } catch {
        if (!cancelled) {
          setRemoteOptions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [loadOptions, maxResults, minSearchLength, open, query])

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, value, open])

  function selectOption(option: ComboboxOption) {
    if (option.disabled) return
    onChange(option.value, option)
    setOpen(false)
    setQuery('')
    setRemoteOptions([])
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)))
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) selectOption(option)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const canSearch = open && (!loadOptions || query.trim().length >= minSearchLength || localOptions.length <= maxResults)
  const showEmptyHint = open && !loading && !visibleOptions.length
  const selectedDescription = selected?.description ? selected.description : ''

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className={cn(
          'w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-left transition-colors',
          'focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10',
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#cfd8d8]',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {selected ? (
              <>
                <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">{selected.label}</p>
                {selectedDescription && (
                  <p className="truncate text-[11px] text-[var(--color-ink-3)] mt-0.5">{selectedDescription}</p>
                )}
              </>
            ) : (
              <p className="truncate text-[13px] text-[var(--color-ink-3)]">{placeholder}</p>
            )}
          </div>
          <ChevronDown size={14} className="text-[var(--color-ink-3)] shrink-0" />
        </div>
      </button>

      {open && (
        <div
          id={id}
          role="listbox"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_24px_60px_rgba(13,34,53,0.14)]"
        >
          <div className="border-b border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-3 py-2.5">
              <Search size={14} className="text-[var(--color-ink-3)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-3)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setRemoteOptions([])
                    inputRef.current?.focus()
                  }}
                  className="shrink-0 text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                  aria-label={clearLabel}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {helperText && <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">{helperText}</p>}
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {!canSearch && (
              <div className="px-3 py-4 text-[12px] text-[var(--color-ink-3)]">
                {emptyText}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-[var(--color-ink-3)]">
                <Loader2 size={13} className="animate-spin" />
                {loadingText}
              </div>
            )}

            {showEmptyHint && !loading && (
              <div className="px-3 py-4 text-[12px] text-[var(--color-ink-3)]">
                {noResultsText}
              </div>
            )}

            {visibleOptions.map((option, index) => {
              const active = index === activeIndex
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left transition-colors',
                    active ? 'bg-[var(--color-surface-warm)]' : 'hover:bg-[var(--color-surface-warm)]/80',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <p className="text-[13px] font-medium text-[var(--color-ink)]">{option.label}</p>
                  {option.description && (
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-3)] leading-relaxed">{option.description}</p>
                  )}
                </button>
              )
            })}
          </div>

          {(allowClear || createHref) && (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-warm)] px-3 py-2.5">
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('', null)
                    setOpen(false)
                    setQuery('')
                    setRemoteOptions([])
                  }}
                  className="text-[12px] font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  {clearLabel}
                </button>
              ) : (
                <span />
              )}

              {createHref && (
                <Link
                  href={createHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-sidebar)] hover:border-[var(--color-copper)] hover:text-[var(--color-copper)]"
                >
                  <Plus size={12} />
                  {createLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
