import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Data "só dia" (YYYY-MM-DD, sem hora) é um dia de calendário, não um instante: não passa por
// fuso (new Date('2026-10-06') é meia-noite UTC e viraria 05/10 no Brasil).
const SO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    const m = SO_DIA.exec(date.trim())
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}
