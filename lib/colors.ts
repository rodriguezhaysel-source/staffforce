// Single source of truth for department colors
export function getDeptColor(deptId: string, departments: any[]): string {
  const dept = departments.find(d => d.id === deptId)
  return dept?.color || '#2563EB'
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
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

// Check if two shifts overlap
export function hasOverlap(
  newStart: string, newEnd: string,
  existing: { start_time: string; end_time: string }[]
): boolean {
  return existing.some(s =>
    newStart < s.end_time && newEnd > s.start_time
  )
}

// Check if clock-in time is within a shift window (±30 min)
export function isWithinShift(now: Date, shift: { start_time: string; end_time: string }): boolean {
  const start = new Date(new Date(shift.start_time).getTime() - 30 * 60000)
  const end = new Date(shift.end_time)
  return now >= start && now <= end
}
