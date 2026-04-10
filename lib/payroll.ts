import { TimeEntry, Employee, PayrollEntry, PayrollConfig } from './store'
import { differenceInMinutes, parseISO, startOfWeek, format, addDays } from 'date-fns'

// ─── Gross Pay Calculation ─────────────────────────────────────────────────────

export interface GrossResult {
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  grossPay: number
}

export function calculateGrossPay(
  timeEntries: TimeEntry[],
  employee: Employee,
  config: PayrollConfig
): GrossResult {
  if (employee.employment_type === 'salary') {
    const grossPay = employee.salary_annual / 26
    return { regularHours: 0, overtimeHours: 0, regularPay: grossPay, overtimePay: 0, grossPay }
  }

  const rate = employee.hourly_rate
  const approved = timeEntries.filter(e => e.clock_out)

  // Group hours by day
  const dayHours: Record<string, number> = {}
  const weekHours: Record<string, number> = {}

  for (const entry of approved) {
    if (!entry.clock_out) continue
    const mins = differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in))
    const netHours = Math.max(0, (mins - (entry.break_mins || 0)) / 60)
    const dayKey = entry.clock_in.slice(0, 10)
    const weekKey = format(startOfWeek(parseISO(entry.clock_in), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    dayHours[dayKey] = (dayHours[dayKey] || 0) + netHours
    weekHours[weekKey] = (weekHours[weekKey] || 0) + netHours
  }

  let totalRegular = 0
  let totalOT = 0

  // Daily OT first
  for (const [, hours] of Object.entries(dayHours)) {
    const dailyReg = Math.min(hours, config.dailyOtThreshold)
    const dailyOT = Math.max(0, hours - config.dailyOtThreshold)
    totalRegular += dailyReg
    totalOT += dailyOT
  }

  // Weekly OT cap
  for (const [, weekTotal] of Object.entries(weekHours)) {
    if (weekTotal > config.weeklyOtThreshold) {
      const weekOT = weekTotal - config.weeklyOtThreshold
      // Only add weekly OT if not already caught by daily OT
      const weekDailyOTAlready = totalOT
      if (weekOT > weekDailyOTAlready) {
        totalOT = weekOT
        totalRegular = weekTotal - weekOT
      }
    }
  }

  const regularPay = totalRegular * rate
  const overtimePay = totalOT * rate * config.otMultiplier
  const grossPay = regularPay + overtimePay

  return {
    regularHours: Math.round(totalRegular * 100) / 100,
    overtimeHours: Math.round(totalOT * 100) / 100,
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
  }
}

// ─── Deductions ────────────────────────────────────────────────────────────────

export interface DeductionResult {
  federalTax: number
  fica: number
  stateTax: number
  healthInsurance: number
  retirement401k: number
  totalDeductions: number
  netPay: number
}

export function calculateDeductions(grossPay: number, config: PayrollConfig): DeductionResult {
  const federalTax = Math.round(grossPay * config.federalTaxPct * 100) / 100
  const fica = Math.round(grossPay * config.ficaPct * 100) / 100
  const stateTax = Math.round(grossPay * config.stateTaxPct * 100) / 100
  const healthInsurance = config.healthInsurance
  const retirement401k = Math.round(grossPay * config.retirement401kPct * 100) / 100
  const totalDeductions = federalTax + fica + stateTax + healthInsurance + retirement401k
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100

  return { federalTax, fica, stateTax, healthInsurance, retirement401k, totalDeductions, netPay }
}

// ─── NACHA Generator ──────────────────────────────────────────────────────────

export function generateNACHA(entries: PayrollEntry[], companyName: string, routingNumber: string, accountNumber: string, payDate: string): string {
  const now = new Date()
  const fileDate = format(now, 'yyMMdd')
  const fileTime = format(now, 'HHmm')
  const effectiveDate = payDate.replace(/-/g, '').slice(2)
  const lines: string[] = []

  // File Header
  lines.push(`101 ${routingNumber.padEnd(10)}${accountNumber.padEnd(10)}${fileDate}${fileTime}094101${companyName.substring(0, 23).padEnd(23)}STAFFFORCE             `)

  // Batch Header
  const batchHeader = `5200${companyName.substring(0, 16).padEnd(16)}      ${accountNumber.padStart(10, '0')}PPD PAYROLL           ${effectiveDate}   1${routingNumber.slice(0, 8)}0000001`
  lines.push(batchHeader)

  let entryCount = 0
  let totalDebit = 0

  for (const entry of entries) {
    if (!entry.bank_routing || !entry.bank_account) continue
    entryCount++
    const amount = Math.round((entry.net_pay || 0) * 100).toString().padStart(10, '0')
    const name = ((entry.employee?.first_name || '') + ' ' + (entry.employee?.last_name || '')).substring(0, 22).padEnd(22)
    const routing = entry.bank_routing.padStart(9, '0')
    const account = entry.bank_account.padEnd(17)
    totalDebit += entry.net_pay || 0
    lines.push(`622${routing}${account}${amount}               ${name}  0${accountNumber.padStart(15, '0')}${entryCount.toString().padStart(7, '0')}`)
  }

  // Batch Control
  const batchTotal = Math.round(totalDebit * 100).toString().padStart(12, '0')
  lines.push(`8200${entryCount.toString().padStart(6, '0')}${routingNumber.slice(0, 8).padStart(10, '0')}000000000000${batchTotal}${companyName.substring(0, 23).padEnd(23)}                         ${routingNumber.slice(0, 8)}0000001`)

  // File Control
  const blockCount = Math.ceil((lines.length + 1) / 10)
  lines.push(`9000001${blockCount.toString().padStart(6, '0')}${entryCount.toString().padStart(8, '0')}${routingNumber.slice(0, 8).padStart(10, '0')}000000000000${batchTotal}                                       `)

  // Pad to multiple of 10
  while (lines.length % 10 !== 0) {
    lines.push('9'.repeat(94))
  }

  return lines.join('\n')
}

// ─── CSV Generator ────────────────────────────────────────────────────────────

export function generatePayrollCSV(entries: PayrollEntry[]): string {
  const headers = [
    'Employee ID', 'First Name', 'Last Name', 'Position',
    'Regular Hours', 'OT Hours', 'Regular Pay', 'OT Pay', 'Gross Pay',
    'Federal Tax', 'FICA', 'State Tax', 'Health Insurance', '401k',
    'Total Deductions', 'Net Pay',
    'Bank Name', 'Account Type', 'Routing', 'Account (last 4)'
  ]

  const rows = entries.map(e => [
    e.employee_id || '',
    e.employee?.first_name || '',
    e.employee?.last_name || '',
    e.employee?.position || '',
    e.regular_hours,
    e.overtime_hours,
    e.regular_pay.toFixed(2),
    e.overtime_pay.toFixed(2),
    e.gross_pay.toFixed(2),
    e.federal_tax.toFixed(2),
    e.fica.toFixed(2),
    e.state_tax.toFixed(2),
    e.health_insurance.toFixed(2),
    e.retirement_401k.toFixed(2),
    (e.federal_tax + e.fica + e.state_tax + e.health_insurance + e.retirement_401k).toFixed(2),
    e.net_pay.toFixed(2),
    e.bank_name || '',
    e.bank_account_type || '',
    e.bank_routing || '',
    (e.bank_account || '').slice(-4),
  ])

  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

export function getTotalHoursForEntry(entry: TimeEntry): number {
  if (!entry.clock_out) return 0
  const mins = differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in))
  return Math.max(0, (mins - (entry.break_mins || 0)) / 60)
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}
