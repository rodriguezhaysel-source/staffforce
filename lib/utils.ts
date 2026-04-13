import type { Employee, TimeEntry } from '../types'

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

export function getDeptColor(deptId: string, departments: any[]): string {
  const dept = departments.find((d: any) => d.id === deptId)
  return dept?.color || '#2563EB'
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function hasOverlap(
  newStart: string, newEnd: string,
  existing: { start_time: string; end_time: string }[]
): boolean {
  return existing.some(s => newStart < s.end_time && newEnd > s.start_time)
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  })
}

export function isWithinShift(now: Date, shift: { start_time: string; end_time: string }): boolean {
  const start = new Date(new Date(shift.start_time).getTime() - 30 * 60000)
  const end = new Date(shift.end_time)
  return now >= start && now <= end
}

export function getShiftStyle(color: string, status: string = 'scheduled') {
  const base = {
    background: hexToRgba(color, 0.12),
    borderLeftColor: color,
    color: '#111827',
  }
  if (status === 'draft') return { ...base, opacity: 0.75, borderStyle: 'dashed' }
  if (status === 'completed') return { ...base, opacity: 0.55 }
  return base
}
