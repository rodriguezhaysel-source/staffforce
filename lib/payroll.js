// Payroll calculation: daily OT > 8h, weekly OT > 40h, FICA 7.65%
export function calcPayroll(entries, employee) {
  const rate = parseFloat(employee.hourly_rate) || 0
  const salaryAnnual = parseFloat(employee.salary_annual) || 0
  const isSalaried = employee.employment_type === 'salary'

  if (isSalaried) {
    const gross = salaryAnnual / 26 // biweekly
    const fica = gross * 0.0765
    const net = gross - fica
    return { gross, fica, fedTax: 0, stateTax: 0, net, regularPay: gross, otPay: 0, otHours: 0, regularHours: 0 }
  }

  // Group entries by day
  const byDay = {}
  for (const e of entries) {
    if (!e.clock_out) continue
    const day = e.clock_in.slice(0, 10)
    if (!byDay[day]) byDay[day] = 0
    const mins = (new Date(e.clock_out) - new Date(e.clock_in)) / 60000
    byDay[day] += mins / 60
  }

  let regularHours = 0
  let otHours = 0
  const days = Object.values(byDay)
  const totalHours = days.reduce((a, b) => a + b, 0)

  // Daily OT
  for (const h of days) {
    if (h > 8) {
      otHours += h - 8
      regularHours += 8
    } else {
      regularHours += h
    }
  }

  // Weekly OT check
  if (totalHours > 40 && otHours < totalHours - 40) {
    otHours = Math.max(otHours, totalHours - 40)
    regularHours = totalHours - otHours
  }

  const regularPay = regularHours * rate
  const otPay = otHours * rate * 1.5
  const gross = regularPay + otPay
  const fica = gross * 0.0765
  const fedTax = gross * 0.12
  const stateTax = gross * 0.05
  const net = gross - fica - fedTax - stateTax

  return { gross, fica, fedTax, stateTax, net, regularPay, otPay, otHours, regularHours }
}

export function generateNACHA(entries, companyName, routingNumber, accountNumber, payDate) {
  const lines = []
  lines.push(`101 ${routingNumber.padStart(9)}${accountNumber.padEnd(10)}${payDate.replace(/-/g, '').slice(2)}1200A094101${companyName.padEnd(23)}STAFFFORCE PAY`)
  lines.push(`5200${companyName.padEnd(16)}${' '.repeat(20)}PPD PAYROLL   ${payDate.replace(/-/g, '').slice(2)}${payDate.replace(/-/g, '').slice(2)}1${routingNumber.slice(0,8)}0000001`)
  let seq = 1
  for (const e of entries) {
    const amt = Math.round((e.net_pay || 0) * 100).toString().padStart(10, '0')
    const rt = (e.bank_routing || '000000000').padStart(9)
    const ac = (e.bank_account || '0000000000').padEnd(17)
    lines.push(`622${rt}${ac}${amt}${' '.repeat(15)}${(e.first_name + ' ' + e.last_name).padEnd(22).slice(0,22)}  ${routingNumber.slice(0,8)}${seq.toString().padStart(7,'0')}`)
    seq++
  }
  lines.push(`8200${seq.toString().padStart(6,'0')}${' '.repeat(10)}${' '.repeat(12)}${' '.repeat(39)}${routingNumber.slice(0,8)}0000001`)
  lines.push(`9${' '.repeat(93)}`)
  return lines.join('\n')
}
