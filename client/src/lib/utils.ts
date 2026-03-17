import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatHoursDecimal(hours: number): string {
  return hours.toFixed(2)
}

/**
 * Parses a time input string in either decimal (1.5) or colon (1:30) format.
 * Returns the hours as a decimal number, or NaN if the input is invalid.
 */
export function parseTimeInput(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return NaN

  if (trimmed.includes(':')) {
    const [hourPart, minutePart] = trimmed.split(':')
    const hours = hourPart === '' ? 0 : parseInt(hourPart, 10)
    const minutes = minutePart === '' ? 0 : parseInt(minutePart, 10)
    if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59 || hours < 0) return NaN
    if (hours === 0 && minutes === 0) return NaN
    return hours + minutes / 60
  }

  const decimal = parseFloat(trimmed)
  return decimal
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getBudgetStatus(used: number, budget: number | null): 'none' | 'ok' | 'warning' | 'over' {
  if (!budget) return 'none'
  const pct = used / budget
  if (pct >= 1) return 'over'
  if (pct >= 0.8) return 'warning'
  return 'ok'
}

export function getBudgetPercent(used: number, budget: number | null): number {
  if (!budget) return 0
  return Math.min(Math.round((used / budget) * 100), 100)
}

export function avatarInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isToday(date: string | Date): boolean {
  const d = new Date(date)
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

export function toInputDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.substring(0, 10)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
