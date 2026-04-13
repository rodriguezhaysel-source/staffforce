import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addDays } from 'date-fns'
import { fmtMoney, empName, entryHours, downloadBlob } from '../../lib/utils'
import { calculateHours } from '../../lib/payroll'
import { ACard, ABtn, APageHeader, AEmpty, AC } from './ui'
import type { Employee, Department } from '../../types'

interface Props { user: Employee; employees: Employee[]; departments: Department[] }

const TYPES = [
  { key: 'hours', label: 'Hours Summary' },
  { key: 'labor', label: 'Labor Cost' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'overtime', label: 'Overtime' },
  { key: 'pto', label: 'PTO Usage' },
  { key: 'late', label: 'Late Clock-ins' },
]

export default function AdminReports({ user, employees, departments }: Props) {
  const [type, setType] = useState('hours')
  const [from, setFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filterDept, setFilterDept] = useState('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const filteredEmps = filterDept ? employees.filter(e => e.department_id === filterDept) : employees.filter(e => e.status === 'active')
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', from).lte('clock_in', to + 'T23:59:59')
    const entries = (te || []).filter((e: any) => filteredEmps.find(emp => emp.id === e.employee_id))

    if (type === 'hours') {
      setData(filteredEmps.map(e => ({
        name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—',
        position: e.position || '—',
        hours: entries.filter((x: any) => x.employee_id === e.id).reduce((s: number, x: any) => s + entryHours(x), 0),
        sessions: entries.filter((x: any) => x.employee_id === e.id).length,
      })).filter(r => r.hours > 0).sort((a, b) => b.hours - a.hours))
    } else if (type === 'labor') {
      setData(filteredEmps.map(e => {
        const hrs = entries.filter((x: any) => x.employee_id === e.id).reduce((s: number, x: any) => s + entryHours(x), 0)
        const rate = e.hourly_rate || (e.salary_annual ? e.salary_annual / 52 / 40 : 0)
        return { name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—', hours: hrs, rate, cost: hrs * rate }
      }).filter(r => r.hours > 0).sort((a, b) => b.cost - a.cost))
    } else if (type === 'overtime') {
      setData(filteredEmps.map(e => {
        const empEntries = entries.filter((x: any) => x.employee_id === e.id)
        const { regular, overtime } = calculateHours(empEntries)
        return { name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—', regular: regular.toFixed(1), overtime: overtime.toFixed(1), total: (regular + overtime).toFixed(1) }
      }).filter((r: any) => Number(r.total) > 0).sort((a: any, b: any) => Number(b.overtime) - Number(a.overtime)))
    } else if (type === 'pto') {
      const { data: pto } = await supabase.from('time_off').select('*').gte('start_date', from).lte('end_date', to).eq('status', 'approved')
      setData(filteredEmps.map(e => {
        const empPto = (pto || []).filter((p: any) => p.employee_id === e.id)
        const vacation = empPto.filter((p: any) => p.type === 'vacation').reduce((s: number, p: any) => s + (p.days || 0), 0)
        const sick = empPto.filter((p: any) => p.type === 'sick').reduce((s: number, p: any) => s + (p.days || 0), 0)
        return { name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—', vacation, sick, total: vacation + sick, balance: e.pto_balance }
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total))
    } else if (type === 'attendance') {
      const { data: sh } = await supabase.from('shifts').select('*').gte('start_time', from).lte('start_time', to + 'T23:59:59')
      const shifts = (sh || []).filter((s: any) => filteredEmps.find(e => e.id === s.employee_id))
      setData(filteredEmps.map(e => {
        const scheduled = shifts.filter((s: any) => s.employee_id === e.id).length
        const present = entries.filter((x: any) => x.employee_id === e.id && x.clock_out).length
        const absent = Math.max(0, scheduled - present)
        const pct = scheduled > 0 ? Math.round(present / scheduled * 100) : 100
        return { name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—', scheduled, present, absent, attendance: pct + '%' }
      }).filter(r => r.scheduled > 0))
    } else if (type === 'late') {
      const { data: sh } = await supabase.from('shifts').select('*').gte('start_time', from).lte('start_time', to + 'T23:59:59')
      const shifts = (sh || []).filter((s: any) => filteredEmps.find(e => e.id === s.employee_id))
      setData(filteredEmps.map(e => {
        const empShifts = shifts.filter((s: any) => s.employee_id === e.id)
        let lateCount = 0, totalLateMin = 0
        empShifts.forEach((s: any) => {
          const entry = entries.find((x: any) => x.employee_id === e.id && x.clock_in && Math.abs(new Date(x.clock_in).getTime() - new Date(s.start_time).getTime()) < 4 * 3600000)
          if (entry && entry.clock_in) {
            const minsLate = Math.round((new Date(entry.clock_in).getTime() - new Date(s.start_time).getTime()) / 60000)
            if (minsLate > 5) { lateCount++; totalLateMin += minsLate }
          }
        })
        return { name: empName(e), dept: departments.find(d => d.id === e.department_id)?.name || '—', shifts: empShifts.length, late: lateCount, avgLate: lateCount > 0 ? Math.round(totalLateMin / lateCount) + 'm' : '—' }
      }).filter(r => r.shifts > 0).sort((a, b) => b.late - a.late))
    }
    setLoading(false)
  }

  function exportCSV() {
    if (!data.length) return
    const rows = [Object.keys(data[0]).map(k => k.charAt(0).toUpperCase() + k.slice(1))]
    data.forEach(r => rows.push(Object.values(r).map(String)))
    downloadBlob(rows.map(r => r.join(',')).join('\n'), `report_${type}_${from}_${to}.csv`, 'text/csv')
  }

  const chartKey = type === 'labor' ? 'cost' : type === 'attendance' ? 'present' : type === 'late' ? 'late' : 'hours'
  const maxVal = data.length > 0 ? Math.max(...data.slice(0, 20).map((r: any) => Number(r[chartKey] || 0)), 1) : 1
  const CHART_COLORS = [AC.accent, AC.purple, AC.success, AC.teal, '#DB2777', AC.warning, AC.danger]

  const cols: Record<string, string[]> = {
    hours: ['name', 'dept', 'position', 'hours', 'sessions'],
    labor: ['name', 'dept', 'hours', 'rate', 'cost'],
    attendance: ['name', 'dept', 'scheduled', 'present', 'absent', 'attendance'],
    overtime: ['name', 'dept', 'regular', 'overtime', 'total'],
    pto: ['name', 'dept', 'vacation', 'sick', 'total', 'balance'],
    late: ['name', 'dept', 'shifts', 'late', 'avgLate'],
  }

  function fmtCell(key: string, val: any) {
    if (key === 'cost') return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: AC.accent }}>{fmtMoney(Number(val))}</span>
    if (key === 'rate') return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>${Number(val).toFixed(2)}/hr</span>
    if (['hours', 'regular', 'overtime', 'total'].includes(key)) return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{Number(val).toFixed(1)}h</span>
    if (key === 'late' && Number(val) > 0) return <span style={{ fontWeight: 700, color: AC.danger }}>{val}</span>
    return val
  }

  return (
    <div>
      <APageHeader title="Reports" sub="Analyze your workforce data">
        {data.length > 0 && <ABtn variant="secondary" size="sm" onClick={exportCSV}>↓ Export CSV</ABtn>}
      </APageHeader>

      <ACard style={{ marginBottom: 16 }} pad={16}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as any, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', border: `1px solid ${AC.border}`, borderRadius: 8, overflow: 'hidden', flexWrap: 'wrap' as any }}>
            {TYPES.map(tp => (
              <button key={tp.key} onClick={() => { setType(tp.key); setData([]) }} style={{ padding: '7px 14px', border: 'none', background: type === tp.key ? AC.accent : 'transparent', color: type === tp.key ? '#fff' : AC.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {tp.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' as any }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: AC.sub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 4 }}>From</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: AC.sub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 4 }}>To</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ABtn variant="primary" onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate'}</ABtn>
          </div>
        </div>
      </ACard>

      {data.length > 0 && (
        <>
          {/* Bar chart */}
          <ACard style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: AC.text, marginBottom: 16 }}>
              {TYPES.find(t => t.key === type)?.label} — Visual ({data.length} employees)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, minWidth: Math.max(400, data.slice(0, 25).length * 40) }}>
                {data.slice(0, 25).map((row: any, i: number) => {
                  const val = Number(row[chartKey] || 0)
                  const pct = maxVal > 0 ? val / maxVal : 0
                  const color = CHART_COLORS[i % CHART_COLORS.length]
                  return (
                    <div key={i} style={{ flex: 1, minWidth: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: AC.muted, fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center' }}>
                        {type === 'labor' ? '$' + Math.round(val) : type === 'attendance' ? val : val.toFixed(1)}
                      </div>
                      <div title={row.name} style={{ width: '100%', height: Math.max(4, pct * 115), background: color, borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} />
                      <div style={{ fontSize: 9, color: AC.muted, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {row.name.split(' ')[0]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ACard>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as any }}>
            {type === 'hours' && (
              <>
                <div style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '12px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any }}>Total Hours</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: AC.accent, fontFamily: 'IBM Plex Mono, monospace' }}>{data.reduce((s: number, r: any) => s + Number(r.hours), 0).toFixed(1)}h</div>
                </div>
                <div style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '12px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any }}>Avg / Person</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: AC.accent, fontFamily: 'IBM Plex Mono, monospace' }}>{(data.reduce((s: number, r: any) => s + Number(r.hours), 0) / data.length).toFixed(1)}h</div>
                </div>
              </>
            )}
            {type === 'labor' && (
              <div style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '12px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any }}>Total Labor Cost</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: AC.accent, fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(data.reduce((s: number, r: any) => s + Number(r.cost), 0))}</div>
              </div>
            )}
            {type === 'overtime' && (
              <div style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '12px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any }}>Total OT Hours</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: AC.warning, fontFamily: 'IBM Plex Mono, monospace' }}>{data.reduce((s: number, r: any) => s + Number(r.overtime), 0).toFixed(1)}h</div>
              </div>
            )}
          </div>

          {/* Data table */}
          <ACard pad={0}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    {(cols[type] || []).map(col => (
                      <th key={col} className="adm-th">{col.charAt(0).toUpperCase() + col.slice(1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, i: number) => (
                    <tr key={i} className="adm-tr">
                      {(cols[type] || []).map(col => (
                        <td key={col} className="adm-td">{fmtCell(col, row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ACard>
        </>
      )}

      {data.length === 0 && !loading && (
        <ACard><AEmpty title="No data" sub="Select a report type, date range, and click Generate" /></ACard>
      )}
    </div>
  )
}
