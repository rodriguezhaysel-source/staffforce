import { TimeEntry, Employee, PayrollEntry } from './store'

export interface PayrollConfig {
  daily_ot_threshold: number
  weekly_ot_threshold: number
  ot_multiplier: number
  federal_tax_rate: number
  fica_rate: number
  state_tax_rate: number
  health_insurance_fixed: number
  retirement_401k_rate: number
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  daily_ot_threshold: 8,
  weekly_ot_threshold: 40,
  ot_multiplier: 1.5,
  federal_tax_rate: 0.12,
  fica_rate: 0.0765,
  state_tax_rate: 0.04,
  health_insurance_fixed: 50,
  retirement_401k_rate: 0.03,
}

export function calculateHours(entries: TimeEntry[]): {
  regular: number
  overtime: number
  total: number
} {
  const cfg = DEFAULT_PAYROLL_CONFIG
  const byDay: Record<string, number> = {}

  for (const entry of entries) {
    if (!entry.clock_in || !entry.clock_out) continue
    const inTime = new Date(entry.clock_in).getTime()
    const outTime = new Date(entry.clock_out).getTime()
    const breakMs = (entry.break_mins || 0) * 60 * 1000
    const workedMs = outTime - inTime - breakMs
    if (workedMs <= 0) continue
    const workedHours = workedMs / 3600000
    const day = entry.clock_in.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + workedHours
  }

  let regularTotal = 0
  let overtimeTotal = 0

  for (const day of Object.keys(byDay)) {
    const hrs = byDay[day]
    if (hrs > cfg.daily_ot_threshold) {
      regularTotal += cfg.daily_ot_threshold
      overtimeTotal += hrs - cfg.daily_ot_threshold
    } else {
      regularTotal += hrs
    }
  }

  if (regularTotal > cfg.weekly_ot_threshold) {
    const extra = regularTotal - cfg.weekly_ot_threshold
    regularTotal = cfg.weekly_ot_threshold
    overtimeTotal += extra
  }

  return {
    regular: Math.round(regularTotal * 100) / 100,
    overtime: Math.round(overtimeTotal * 100) / 100,
    total: Math.round((regularTotal + overtimeTotal) * 100) / 100,
  }
}

export function calculatePay(
  employee: Employee,
  regularHours: number,
  overtimeHours: number,
  cfg: PayrollConfig = DEFAULT_PAYROLL_CONFIG
): Omit<PayrollEntry, 'id' | 'period_id' | 'employee_id' | 'bank_routing' | 'bank_account' | 'bank_account_type' | 'bank_name' | 'status'> {
  const rate = employee.hourly_rate || (employee.salary_annual ? employee.salary_annual / 52 / 40 : 0)
  const regular_pay = rate * regularHours
  const overtime_pay = rate * cfg.ot_multiplier * overtimeHours
  const gross_pay = regular_pay + overtime_pay
  const federal_tax = gross_pay * cfg.federal_tax_rate
  const fica = gross_pay * cfg.fica_rate
  const state_tax = gross_pay * cfg.state_tax_rate
  const health_insurance = cfg.health_insurance_fixed
  const retirement_401k = gross_pay * cfg.retirement_401k_rate
  const net_pay = gross_pay - federal_tax - fica - state_tax - health_insurance - retirement_401k

  return {
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    regular_pay: Math.round(regular_pay * 100) / 100,
    overtime_pay: Math.round(overtime_pay * 100) / 100,
    gross_pay: Math.round(gross_pay * 100) / 100,
    federal_tax: Math.round(federal_tax * 100) / 100,
    fica: Math.round(fica * 100) / 100,
    state_tax: Math.round(state_tax * 100) / 100,
    health_insurance: Math.round(health_insurance * 100) / 100,
    retirement_401k: Math.round(retirement_401k * 100) / 100,
    net_pay: Math.round(net_pay * 100) / 100,
  }
}

export function generateNACHA(entries: PayrollEntry[], employees: Employee[], periodId: string): string {
  const lines: string[] = []
  const now = new Date()
  const fileDate = now.toISOString().slice(2, 10).replace(/-/g, '')
  const fileTime = now.toTimeString().slice(0, 5).replace(':', '')

  lines.push(
    '1' +
    '01'.padStart(2) +
    ' 123456789'.padEnd(10) +
    '1234567890'.padEnd(10) +
    fileDate +
    fileTime +
    'A' +
    '094' +
    '10' +
    '1'.padStart(7, '0') +
    'STAFFFORCE'.padEnd(23) +
    'STAFFFORCE PAYROLL  ' +
    '1'
  )

  let batchSeq = 1
  let entrySeq = 1
  let totalDebit = 0

  lines.push(
    '5' +
    '200' +
    'PAYROLL   '.padEnd(10) +
    ''.padEnd(3) +
    'STAFFFORCE PAYRL'.padEnd(16) +
    'PPD' +
    now.toISOString().slice(2, 10).replace(/-/g, '') +
    '   ' +
    '1' +
    '123456789' +
    String(batchSeq).padStart(7, '0')
  )

  for (const entry of entries) {
    const emp = employees.find(e => e.id === entry.employee_id)
    if (!emp) continue
    const routing = (entry.bank_routing || '').slice(0, 9).padEnd(9)
    const account = (entry.bank_account || '').slice(0, 17).padEnd(17)
    const amount = String(Math.round(entry.net_pay * 100)).padStart(10, '0')
    const name = (emp.first_name + ' ' + emp.last_name).slice(0, 22).padEnd(22)
    totalDebit += Math.round(entry.net_pay * 100)
    lines.push(
      '6' +
      '22' +
      routing +
      account +
      amount +
      name +
      '  ' +
      '0' +
      '123456789' +
      String(entrySeq).padStart(7, '0')
    )
    entrySeq++
  }

  const entryCount = entrySeq - 1
  lines.push(
    '8' +
    '200' +
    String(entryCount).padStart(6, '0') +
    '0000000000' +
    String(totalDebit).padStart(12, '0') +
    'STAFFFORCE'.padEnd(23) +
    ''.padEnd(39) +
    '123456789' +
    String(batchSeq).padStart(7, '0')
  )

  const blockCount = Math.ceil((lines.length + 1) / 10)
  lines.push(
    '9' +
    '000001' +
    String(blockCount).padStart(6, '0') +
    String(entryCount).padStart(8, '0') +
    '0000000000' +
    String(totalDebit).padStart(12, '0') +
    ''.padEnd(39)
  )

  while (lines.length % 10 !== 0) {
    lines.push('9'.repeat(94))
  }

  return lines.join('\n')
}
