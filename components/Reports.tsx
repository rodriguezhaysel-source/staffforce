import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, addDays } from 'date-fns'
import { fmtMoney, empName, entryHours, downloadBlob } from './shared/utils'
import { calculateHours } from '../lib/payroll'
import type { Employee, Department, TimeEntry, Shift } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[] }

export default function Reports({ user, lang, employees, departments }: Props) {
  const [type, setType] = useState<'hours'|'labor'|'attendance'|'overtime'>('hours')
  const [from, setFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', from).lte('clock_in', to + 'T23:59:59')
    const entries: TimeEntry[] = te || []

    if (type === 'hours') {
      setData(employees.map(e => ({
        name: empName(e), dept: departments.find(d=>d.id===e.department_id)?.name||'-',
        hours: entries.filter(x=>x.employee_id===e.id).reduce((s,x)=>s+entryHours(x),0),
        count: entries.filter(x=>x.employee_id===e.id).length
      })).filter(r=>r.hours>0).sort((a,b)=>b.hours-a.hours))
    } else if (type === 'labor') {
      setData(employees.map(e => {
        const hrs = entries.filter(x=>x.employee_id===e.id).reduce((s,x)=>s+entryHours(x),0)
        const rate = e.hourly_rate||(e.salary_annual?e.salary_annual/52/40:0)
        return { name:empName(e), dept:departments.find(d=>d.id===e.department_id)?.name||'-', hours:hrs, rate, cost:hrs*rate }
      }).filter(r=>r.hours>0).sort((a,b)=>b.cost-a.cost))
    } else if (type === 'attendance') {
      const { data: sh } = await supabase.from('shifts').select('*').gte('start_time', from).lte('start_time', to+'T23:59:59')
      const shifts: Shift[] = sh || []
      setData(employees.map(e => ({
        name: empName(e), dept: departments.find(d=>d.id===e.department_id)?.name||'-',
        scheduled: shifts.filter(s=>s.employee_id===e.id).length,
        present: entries.filter(x=>x.employee_id===e.id&&x.clock_out).length,
        absent: Math.max(0, shifts.filter(s=>s.employee_id===e.id).length - entries.filter(x=>x.employee_id===e.id&&x.clock_out).length)
      })).filter(r=>r.scheduled>0))
    } else {
      setData(employees.map(e => {
        const empEntries = entries.filter(x=>x.employee_id===e.id)
        const { regular, overtime } = calculateHours(empEntries)
        return { name:empName(e), dept:departments.find(d=>d.id===e.department_id)?.name||'-', regular, overtime, total:regular+overtime }
      }).filter(r=>r.total>0).sort((a,b)=>b.overtime-a.overtime))
    }
    setLoading(false)
  }

  function exportCSV() {
    if (!data.length) return
    const rows = [Object.keys(data[0])]
    data.forEach(r => rows.push(Object.values(r).map(String)))
    downloadBlob(rows.map(r=>r.join(',')).join('\n'), `report_${type}.csv`, 'text/csv')
  }

  const maxVal = data.length > 0 ? Math.max(...data.map(r=>r.hours||r.cost||r.scheduled||r.total||1)) : 1
  const COLORS = ['#0A6EBD','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#DB2777']

  const TYPES = [
    { key:'hours', label:'Hours' },
    { key:'labor', label:'Labor Cost' },
    { key:'attendance', label:'Attendance' },
    { key:'overtime', label:'Overtime' },
  ]

  return (
    <div>
      {/* Controls */}
      <div className="card" style={{ padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            {TYPES.map(tp => (
              <button key={tp.key} onClick={()=>setType(tp.key as any)} style={{ padding:'7px 16px', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', background:type===tp.key?'var(--primary)':'transparent', color:type===tp.key?'#fff':'#64748B', transition:'all 0.15s' }}>
                {tp.label}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginLeft:'auto' }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:4 }}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:4 }}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate'}</button>
            {data.length > 0 && <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>}
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {data.length > 0 && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {type==='hours' && [
              { label:'Employees', value:data.length },
              { label:'Total Hours', value:data.reduce((s,r)=>s+r.hours,0).toFixed(1)+'h', color:'#0A6EBD' },
              { label:'Avg Hours', value:(data.reduce((s,r)=>s+r.hours,0)/data.length).toFixed(1)+'h', color:'#0A6EBD' },
              { label:'Total Entries', value:data.reduce((s,r)=>s+r.count,0) },
            ].map((k,i)=>(
              <div key={i} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:900, color:(k as any).color||'#111827', fontFamily:'var(--font-mono)' }}>{k.value}</div>
              </div>
            ))}
            {type==='labor' && [
              { label:'Total Labor Cost', value:fmtMoney(data.reduce((s,r)=>s+r.cost,0)), color:'#0A6EBD' },
              { label:'Total Hours', value:data.reduce((s,r)=>s+r.hours,0).toFixed(1)+'h' },
              { label:'Avg Cost/Employee', value:fmtMoney(data.reduce((s,r)=>s+r.cost,0)/data.length), color:'#D97706' },
              { label:'Employees', value:data.length },
            ].map((k,i)=>(
              <div key={i} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:900, color:(k as any).color||'#111827', fontFamily:'var(--font-mono)' }}>{k.value}</div>
              </div>
            ))}
            {type==='attendance' && [
              { label:'Attendance Rate', value:Math.round(data.reduce((s,r)=>s+(r.scheduled>0?r.present/r.scheduled:0),0)/data.length*100)+'%', color:'#059669' },
              { label:'Total Absences', value:data.reduce((s,r)=>s+r.absent,0), color:data.reduce((s,r)=>s+r.absent,0)>0?'#DC2626':'#059669' },
              { label:'Total Present', value:data.reduce((s,r)=>s+r.present,0), color:'#059669' },
              { label:'Employees', value:data.length },
            ].map((k,i)=>(
              <div key={i} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:900, color:(k as any).color||'#111827', fontFamily:'var(--font-mono)' }}>{k.value}</div>
              </div>
            ))}
            {type==='overtime' && [
              { label:'Total OT Hours', value:data.reduce((s,r)=>s+r.overtime,0).toFixed(1)+'h', color:'#D97706' },
              { label:'OT Employees', value:data.filter(r=>r.overtime>0).length, color:'#D97706' },
              { label:'Regular Hours', value:data.reduce((s,r)=>s+r.regular,0).toFixed(1)+'h' },
              { label:'Total Hours', value:data.reduce((s,r)=>s+r.total,0).toFixed(1)+'h' },
            ].map((k,i)=>(
              <div key={i} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:900, color:(k as any).color||'#111827', fontFamily:'var(--font-mono)' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="card" style={{ marginBottom:16, overflowX:'auto' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#111827', marginBottom:16 }}>Visual Overview</div>
            <svg width={Math.max(700, data.length * 72)} height={300} style={{ display:'block' }}>
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <g key={pct}>
                  <line x1="60" y1={240-pct*200} x2={Math.max(700,data.length*72)-20} y2={240-pct*200} stroke="#F1F5F9" strokeWidth="1" />
                  <text x="55" y={244-pct*200} textAnchor="end" fontSize="10" fill="#94A3B8">
                    {type==='labor' ? '$'+Math.round(maxVal*pct) : Math.round(maxVal*pct*10)/10}
                  </text>
                </g>
              ))}
              {data.map((r, i) => {
                const val = r.hours||r.cost||r.scheduled||r.total||0
                const h = Math.max(4, (val/maxVal)*200)
                const x = 70 + i * 72
                const col = COLORS[i % COLORS.length]
                return (
                  <g key={i}>
                    <rect x={x-22} y={240-h} width={44} height={h} rx={5} fill={col} opacity={0.85} />
                    <text x={x} y={240-h-6} textAnchor="middle" fontSize="11" fill="#111827" fontFamily="var(--font-mono)" fontWeight="700">
                      {type==='labor' ? '$'+Math.round(val) : Math.round(val*10)/10}
                    </text>
                    <text x={x} y={258} textAnchor="middle" fontSize="10" fill="#64748B">{r.name.split(' ')[0]}</text>
                    <text x={x} y={270} textAnchor="middle" fontSize="9" fill="#94A3B8">{r.dept}</text>
                  </g>
                )
              })}
              <line x1="60" y1="240" x2={Math.max(700,data.length*72)-20} y2="240" stroke="var(--border)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Table */}
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th><th>Department</th>
                    {type==='hours' && <><th>Hours</th><th>Entries</th></>}
                    {type==='labor' && <><th>Hours</th><th>Rate</th><th>Labor Cost</th></>}
                    {type==='attendance' && <><th>Scheduled</th><th>Present</th><th>Absent</th><th>Rate</th></>}
                    {type==='overtime' && <><th>Regular</th><th>Overtime</th><th>Total</th></>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r,i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:600 }}>{r.name}</td>
                      <td><span className="badge badge-gray">{r.dept}</span></td>
                      {type==='hours' && <><td className="mono" style={{ fontWeight:700 }}>{r.hours.toFixed(2)}</td><td>{r.count}</td></>}
                      {type==='labor' && <><td className="mono">{r.hours.toFixed(2)}</td><td className="mono">{fmtMoney(r.rate)}/hr</td><td className="mono" style={{ fontWeight:800, color:'#0A6EBD' }}>{fmtMoney(r.cost)}</td></>}
                      {type==='attendance' && <><td>{r.scheduled}</td><td style={{ color:'#059669', fontWeight:700 }}>{r.present}</td><td style={{ color:r.absent>0?'#DC2626':'#111827', fontWeight:r.absent>0?700:400 }}>{r.absent}</td><td style={{ fontWeight:700, color:r.scheduled>0&&r.present/r.scheduled>=0.8?'#059669':'#D97706' }}>{r.scheduled>0?Math.round(r.present/r.scheduled*100)+'%':'-'}</td></>}
                      {type==='overtime' && <><td className="mono">{r.regular.toFixed(2)}</td><td className="mono" style={{ fontWeight:700, color:r.overtime>0?'#D97706':'#111827' }}>{r.overtime.toFixed(2)}</td><td className="mono" style={{ fontWeight:700 }}>{r.total.toFixed(2)}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {data.length === 0 && !loading && (
        <div className="card">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
            <div className="empty-state-title">Select type and date range</div>
            <div className="empty-state-sub">Click Generate to view analytics</div>
          </div>
        </div>
      )}
    </div>
  )
}
