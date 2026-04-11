import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, addDays } from 'date-fns'
import { fmtMoney, empName, entryHours } from './shared/utils'
import type { Employee, Department, TimeEntry, Shift } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[] }

export default function Reports({ user, lang, employees, departments }: Props) {
  const [type, setType] = useState<'hours' | 'labor' | 'attendance'>('hours')
  const [from, setFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const { data: entries } = await supabase.from('time_entries').select('*').gte('clock_in', from).lte('clock_in', to + 'T23:59:59')
    const te: TimeEntry[] = entries || []

    if (type === 'hours') {
      setData(employees.map(e => ({ name: empName(e), hours: te.filter(x => x.employee_id === e.id).reduce((s, x) => s + entryHours(x), 0), entries: te.filter(x => x.employee_id === e.id).length })).filter(r => r.hours > 0).sort((a, b) => b.hours - a.hours))
    } else if (type === 'labor') {
      setData(employees.map(e => {
        const hrs = te.filter(x => x.employee_id === e.id).reduce((s, x) => s + entryHours(x), 0)
        const rate = e.hourly_rate || (e.salary_annual ? e.salary_annual / 52 / 40 : 0)
        return { name: empName(e), hours: hrs, rate, cost: hrs * rate }
      }).filter(r => r.hours > 0).sort((a, b) => b.cost - a.cost))
    } else {
      const { data: shifts } = await supabase.from('shifts').select('*').gte('start_time', from).lte('start_time', to + 'T23:59:59')
      const allShifts: Shift[] = shifts || []
      setData(employees.map(e => ({ name: empName(e), scheduled: allShifts.filter(s => s.employee_id === e.id).length, present: te.filter(x => x.employee_id === e.id && x.clock_out).length, absent: Math.max(0, allShifts.filter(s => s.employee_id === e.id).length - te.filter(x => x.employee_id === e.id && x.clock_out).length) })).filter(r => r.scheduled > 0))
    }
    setLoading(false)
  }

  const maxVal = data.length > 0 ? Math.max(...data.map(r => r.hours || r.cost || r.scheduled || 1)) : 1

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${type === 'hours' ? 'active' : ''}`} onClick={() => setType('hours')}>{t(lang, 'hoursReport')}</button>
            <button className={`tab ${type === 'labor' ? 'active' : ''}`} onClick={() => setType('labor')}>{t(lang, 'laborCostReport')}</button>
            <button className={`tab ${type === 'attendance' ? 'active' : ''}`} onClick={() => setType('attendance')}>{t(lang, 'attendanceReport')}</button>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginLeft: 'auto' }}>
            <div><label>{t(lang, 'from')}</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 140 }} /></div>
            <div><label>{t(lang, 'to')}</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 140 }} /></div>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? t(lang, 'loading') : t(lang, 'generate')}</button>
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Chart</div>
            <div className="chart-wrap">
              <svg width={Math.max(600, data.length * 64)} height={280}>
                {data.map((r, i) => {
                  const val = r.hours || r.cost || r.scheduled || 0
                  const h = Math.max(4, (val / maxVal) * 200)
                  const x = 40 + i * 64
                  return (
                    <g key={i}>
                      <rect x={x} y={220 - h} width={44} height={h} rx={4} fill="var(--color-accent)" opacity={0.85} />
                      <text x={x + 22} y={220 - h - 6} textAnchor="middle" fontSize={11} fill="var(--color-text)" fontFamily="var(--font-mono)">
                        {type === 'labor' ? '$' + Math.round(val) : Math.round(val * 10) / 10}
                      </text>
                      <text x={x + 22} y={238} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)">{r.name.split(' ')[0]}</text>
                    </g>
                  )
                })}
                <line x1="36" y1="220" x2={40 + data.length * 64} y2="220" stroke="var(--color-border)" strokeWidth="1" />
              </svg>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t(lang, 'employee')}</th>
                    {type === 'hours' && <><th>Hours</th><th>Entries</th></>}
                    {type === 'labor' && <><th>Hours</th><th>Rate</th><th>Cost</th></>}
                    {type === 'attendance' && <><th>Scheduled</th><th>Present</th><th>Absent</th></>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      {type === 'hours' && <><td className="mono">{r.hours.toFixed(2)}</td><td>{r.entries}</td></>}
                      {type === 'labor' && <><td className="mono">{r.hours.toFixed(2)}</td><td className="mono">{fmtMoney(r.rate)}/hr</td><td className="mono" style={{ fontWeight: 700 }}>{fmtMoney(r.cost)}</td></>}
                      {type === 'attendance' && <><td>{r.scheduled}</td><td style={{ color: 'var(--color-success)' }}>{r.present}</td><td style={{ color: r.absent > 0 ? 'var(--color-danger)' : undefined }}>{r.absent}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {data.length === 0 && !loading && (
        <div className="card"><div className="empty-state"><div className="empty-state-title">Select a range and generate a report</div></div></div>
      )}
    </div>
  )
}
