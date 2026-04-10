export interface DeductionConfig {
  id: number
  name: string
  name_es: string
  type: 'percent' | 'fixed'
  value: number
  active: boolean
}

export interface PayrollRow {
  emp_id: string
  name: string
  dept?: string
  wage_type: string
  hourly_rate?: number
  annual_salary?: number
  regular_hours: number
  overtime_hours: number
  overtime_daily_hours: number
  total_hours: number
  gross: number
  tips: number
  deductions: Array<{ name: string; name_es: string; type: string; rate: number; amount: number }>
  total_deductions: number
  net: number
  entry_count: number
}

export function calcPayrollRow(
  emp: any,
  entries: any[],
  deductionsConfig: DeductionConfig[],
  config: Record<string, string>
): PayrollRow {
  const otWeekly = parseFloat(config.ot_threshold_weekly || '40')
  const otDaily = parseFloat(config.ot_threshold_daily || '8')
  const otMult = parseFloat(config.ot_multiplier || '1.5')

  let regularHours = 0, overtimeHours = 0, overtimeDailyHours = 0, totalHours = 0, gross = 0

  if (emp.wage_type === 'salary') {
    const freq = config.payroll_frequency || 'biweekly'
    const periods: Record<string, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }
    gross = (emp.annual_salary || 0) / (periods[freq] || 26)
    totalHours = entries.reduce((s, e) => s + (e.total_hours || 0), 0)
    regularHours = totalHours
  } else {
    const rate = emp.hourly_rate || 12
    // Group by date for daily OT
    const daily: Record<string, number> = {}
    entries.forEach(e => {
      daily[e.date] = (daily[e.date] || 0) + (e.total_hours || 0)
    })
    totalHours = Object.values(daily).reduce((s, h) => s + h, 0)
    overtimeDailyHours = Object.values(daily).reduce((s, h) => s + Math.max(0, h - otDaily), 0)
    const weeklyOtBase = Math.max(0, totalHours - otWeekly)
    overtimeHours = Math.max(overtimeDailyHours, weeklyOtBase)
    regularHours = totalHours - overtimeHours
    gross = regularHours * rate + overtimeHours * rate * otMult
  }

  const tips = entries.reduce((s, e) => s + (e.tips || 0), 0)

  const deductionItems = deductionsConfig
    .filter(d => d.active)
    .map(d => ({
      name: d.name,
      name_es: d.name_es,
      type: d.type,
      rate: d.value,
      amount: d.type === 'percent' ? gross * d.value / 100 : d.value,
    }))

  const totalDeductions = deductionItems.reduce((s, d) => s + d.amount, 0)
  const net = gross - totalDeductions + tips

  return {
    emp_id: emp.id,
    name: `${emp.first} ${emp.last}`,
    dept: emp.dept,
    wage_type: emp.wage_type,
    hourly_rate: emp.hourly_rate,
    annual_salary: emp.annual_salary,
    regular_hours: Math.round(regularHours * 100) / 100,
    overtime_hours: Math.round(overtimeHours * 100) / 100,
    overtime_daily_hours: Math.round(overtimeDailyHours * 100) / 100,
    total_hours: Math.round(totalHours * 100) / 100,
    gross: Math.round(gross * 100) / 100,
    tips: Math.round(tips * 100) / 100,
    deductions: deductionItems.map(d => ({ ...d, amount: Math.round(d.amount * 100) / 100 })),
    total_deductions: Math.round(totalDeductions * 100) / 100,
    net: Math.round(net * 100) / 100,
    entry_count: entries.length,
  }
}
