import type { Employee } from '../../lib/store'
import type { TimeEntry } from '../../lib/store'

export function empName(emp: Employee | undefined): string {
  if (!emp) return 'Unknown'
  return emp.first_name + ' ' + emp.last_name
}

export function empInitials(emp: Employee | undefined): string {
  if (!emp) return '?'
  return (emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')
}

export function fmtMoney(v: number): string {
  return '$' + (v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h + 'h ' + m + 'm'
}

export function entryHours(e: TimeEntry): number {
  if (!e.clock_in || !e.clock_out) return 0
  const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime() - (e.break_mins || 0) * 60000
  return Math.max(0, ms / 3600000)
}

export function downloadBlob(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
