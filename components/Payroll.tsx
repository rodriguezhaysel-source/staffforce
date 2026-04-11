import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { fmtMoney, empName, downloadBlob } from './shared/utils'
import { calculateHours, calculatePay, generateNACHA } from '../lib/payroll'
import type { Employee, PayrollPeriod, PayrollEntry } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Payroll({ user, lang, employees }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [selected, setSelected] = useState<PayrollPeriod | null>(null)
  const [periodModal, setPeriodModal] = useState(false)
  const [paystubOpen, setPaystubOpen] = useState(false)
  const [paystubEntry, setPaystubEntry] = useState<PayrollEntry | null>(null)
  const [newPeriod, setNewPeriod] = useState({ frequency:'biweekly', start_date:'', end_date:'', pay_date:'' })
  const [running, setRunning] = useState(false)

  const canRun = user.role === 'admin'

  useEffect(() => { loadPeriods() }, [])

  async function loadPeriods() {
    const { data } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending:false })
    setPeriods(data || [])
  }

  async function loadEntries(p: PayrollPeriod) {
    setSelected(p)
    const { data } = await supabase.from('payroll_entries').select('*').eq('period_id', p.id)
    setEntries(data || [])
  }

  async function createPeriod() {
    if (!newPeriod.start_date || !newPeriod.end_date || !newPeriod.pay_date) return
    await supabase.from('payroll_periods').insert({ ...newPeriod, status:'draft' })
    setPeriodModal(false); setNewPeriod({ frequency:'biweekly', start_date:'', end_date:'', pay_date:'' }); loadPeriods()
  }

  async function runPayroll(p: PayrollPeriod) {
    if (!canRun) return
    setRunning(true)
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', p.start_date).lte('clock_in', p.end_date+'T23:59:59').eq('status', 'approved')
    for (const emp of employees.filter(e => e.status === 'active')) {
      const empEntries = (te||[]).filter(e => e.employee_id === emp.id)
      const { regular, overtime } = calculateHours(empEntries)
      const pay = calculatePay(emp, regular, overtime)
      await supabase.from('payroll_entries').upsert({
        period_id:p.id, employee_id:emp.id, ...pay,
        bank_routing:emp.bank_routing||'', bank_account:emp.bank_account||'',
        bank_account_type:emp.bank_account_type||'', bank_name:emp.bank_name||'', status:'pending'
      }, { onConflict:'period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({ status:'processed' }).eq('id', p.id)
    setRunning(false); loadPeriods(); loadEntries(p)
  }

  async function markPaid(p: PayrollPeriod) {
    if (!canRun) return
    await supabase.from('payroll_periods').update({ status:'paid', paid_at:new Date().toISOString() }).eq('id', p.id)
    await supabase.from('payroll_entries').update({ status:'paid' }).eq('period_id', p.id)
    loadPeriods(); if (selected?.id===p.id) loadEntries(p)
  }

  const totalGross = entries.reduce((s,e)=>s+e.gross_pay,0)
  const totalNet = entries.reduce((s,e)=>s+e.net_pay,0)

  const statusColor = (s: string) => s==='paid'?'badge-success':s==='processed'?'badge-blue':'badge-gray'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        {canRun && <button className="btn btn-primary btn-sm" onClick={()=>setPeriodModal(true)}>+ New Period</button>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>
        {/* Periods list */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:800, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px' }}>Pay Periods</div>
          {periods.map(p => (
            <div key={p.id} onClick={()=>loadEntries(p)} style={{ padding:'13px 16px', borderBottom:'1px solid #F8FAFC', cursor:'pointer', background:selected?.id===p.id?'#EFF6FF':'transparent', borderLeft:selected?.id===p.id?'3px solid var(--primary)':'3px solid transparent', transition:'all 0.15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{p.start_date} — {p.end_date}</div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>Pay: {p.pay_date} · {p.frequency}</div>
                </div>
                <span className={`badge ${statusColor(p.status)}`}>{p.status}</span>
              </div>
            </div>
          ))}
          {periods.length===0 && <div className="empty-state" style={{ padding:24 }}><div className="empty-state-sub">No periods yet</div></div>}
        </div>

        {/* Entries */}
        <div>
          {selected ? (
            <>
              {/* KPIs */}
              {entries.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                  <div className="card" style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:8 }}>Total Gross</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#0A6EBD', fontFamily:'var(--font-mono)' }}>{fmtMoney(totalGross)}</div>
                  </div>
                  <div className="card" style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:8 }}>Total Net</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#059669', fontFamily:'var(--font-mono)' }}>{fmtMoney(totalNet)}</div>
                  </div>
                  <div className="card" style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:8 }}>Employees</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#111827', fontFamily:'var(--font-mono)' }}>{entries.length}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {canRun && (
                <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={()=>runPayroll(selected)} disabled={running}>{running?'Running...':'Run Payroll'}</button>
                  <button className="btn btn-success btn-sm" onClick={()=>markPaid(selected)}>Mark as Paid</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>downloadBlob(generateNACHA(entries,employees,selected.id),'payroll.ach')}>Download NACHA</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>{ const rows=[['Employee','Reg','OT','Gross','Net','Status']]; entries.forEach(e=>{const emp=employees.find(em=>em.id===e.employee_id);rows.push([empName(emp),String(e.regular_hours),String(e.overtime_hours),String(e.gross_pay),String(e.net_pay),e.status])}); downloadBlob(rows.map(r=>r.join(',')).join('\n'),'payroll.csv','text/csv') }}>Export CSV</button>
                </div>
              )}

              <div className="card" style={{ padding:0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th><th>Reg Hrs</th><th>OT Hrs</th><th>Gross</th>
                        <th>Fed Tax</th><th>FICA</th><th>State</th><th>Net Pay</th><th>Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => {
                        const emp = employees.find(em=>em.id===e.employee_id)
                        return (
                          <tr key={e.id}>
                            <td style={{ fontWeight:600, whiteSpace:'nowrap' }}>{empName(emp)}</td>
                            <td className="mono">{e.regular_hours}</td>
                            <td className="mono" style={{ color:e.overtime_hours>0?'#D97706':undefined, fontWeight:e.overtime_hours>0?700:undefined }}>{e.overtime_hours}</td>
                            <td className="mono">{fmtMoney(e.gross_pay)}</td>
                            <td className="mono" style={{ color:'#94A3B8' }}>{fmtMoney(e.federal_tax)}</td>
                            <td className="mono" style={{ color:'#94A3B8' }}>{fmtMoney(e.fica)}</td>
                            <td className="mono" style={{ color:'#94A3B8' }}>{fmtMoney(e.state_tax)}</td>
                            <td className="mono" style={{ fontWeight:800, color:'#059669' }}>{fmtMoney(e.net_pay)}</td>
                            <td><span className={`badge ${e.status==='paid'?'badge-success':'badge-gray'}`}>{e.status}</span></td>
                            <td><button className="btn btn-ghost btn-sm" onClick={()=>{setPaystubEntry(e);setPaystubOpen(true)}}>Paystub</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {entries.length===0 && <div className="empty-state"><div className="empty-state-title">Run payroll to generate entries</div></div>}
                </div>
              </div>
            </>
          ) : (
            <div className="card"><div className="empty-state"><div className="empty-state-title">Select a pay period</div></div></div>
          )}
        </div>
      </div>

      {/* Create period modal */}
      {periodModal && (
        <div className="modal-overlay" onClick={()=>setPeriodModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Pay Period</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={()=>setPeriodModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Frequency</label>
                <select value={newPeriod.frequency} onChange={e=>setNewPeriod(p=>({...p,frequency:e.target.value}))}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semi-monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={newPeriod.start_date} onChange={e=>setNewPeriod(p=>({...p,start_date:e.target.value}))} /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={newPeriod.end_date} onChange={e=>setNewPeriod(p=>({...p,end_date:e.target.value}))} /></div>
              </div>
              <div className="form-group"><label>Pay Date</label><input type="date" value={newPeriod.pay_date} onChange={e=>setNewPeriod(p=>({...p,pay_date:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPeriodModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPeriod}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Paystub modal */}
      {paystubEntry && paystubOpen && (
        <div className="modal-overlay" onClick={()=>setPaystubOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Pay Statement</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={()=>setPaystubOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {(() => {
                const emp = employees.find(e=>e.id===paystubEntry.employee_id)
                const period = periods.find(p=>p.id===paystubEntry.period_id)
                return (
                  <div>
                    <div style={{ textAlign:'center', marginBottom:24, paddingBottom:20, borderBottom:'2px solid var(--border)' }}>
                      <div style={{ fontSize:22, fontWeight:900 }}>StaffForce</div>
                      <div style={{ fontSize:12, color:'#64748B' }}>Pay Statement</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                      <div>
                        <div style={{ fontWeight:700, marginBottom:4, fontSize:12, color:'#94A3B8', textTransform:'uppercase' }}>Employee</div>
                        <div style={{ fontWeight:700 }}>{empName(emp)}</div>
                        <div style={{ fontSize:12, color:'#64748B' }}>{emp?.position}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight:700, marginBottom:4, fontSize:12, color:'#94A3B8', textTransform:'uppercase' }}>Pay Period</div>
                        <div style={{ fontSize:13 }}>{period?.start_date} to {period?.end_date}</div>
                        <div style={{ fontSize:12, color:'#64748B' }}>Pay Date: {period?.pay_date}</div>
                      </div>
                    </div>
                    <table style={{ marginBottom:12 }}>
                      <thead><tr><th>Earnings</th><th style={{ textAlign:'right' }}>Hours</th><th style={{ textAlign:'right' }}>Amount</th></tr></thead>
                      <tbody>
                        <tr><td>Regular Pay</td><td className="mono" style={{ textAlign:'right' }}>{paystubEntry.regular_hours}</td><td className="mono" style={{ textAlign:'right' }}>{fmtMoney(paystubEntry.regular_pay)}</td></tr>
                        {paystubEntry.overtime_hours>0 && <tr><td>Overtime (1.5x)</td><td className="mono" style={{ textAlign:'right' }}>{paystubEntry.overtime_hours}</td><td className="mono" style={{ textAlign:'right' }}>{fmtMoney(paystubEntry.overtime_pay)}</td></tr>}
                        <tr style={{ borderTop:'2px solid var(--border)' }}><td colSpan={2}><strong>Gross Pay</strong></td><td className="mono" style={{ textAlign:'right' }}><strong>{fmtMoney(paystubEntry.gross_pay)}</strong></td></tr>
                      </tbody>
                    </table>
                    <table style={{ marginBottom:16 }}>
                      <thead><tr><th>Deductions</th><th style={{ textAlign:'right' }}>Amount</th></tr></thead>
                      <tbody>
                        {[['Federal Tax (12%)',paystubEntry.federal_tax],['FICA (7.65%)',paystubEntry.fica],['State Tax (4%)',paystubEntry.state_tax],['Health Insurance',paystubEntry.health_insurance],['401(k) (3%)',paystubEntry.retirement_401k]].map(([l,a])=>(
                          <tr key={l as string}><td style={{ color:'#64748B' }}>{l}</td><td className="mono" style={{ textAlign:'right', color:'#64748B' }}>-{fmtMoney(a as number)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ background:'#D1FAE5', padding:'16px 20px', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <strong style={{ fontSize:16, color:'#065F46' }}>Net Pay</strong>
                      <strong style={{ fontSize:26, fontFamily:'var(--font-mono)', color:'#059669' }}>{fmtMoney(paystubEntry.net_pay)}</strong>
                    </div>
                    {paystubEntry.bank_name && <div style={{ marginTop:12, fontSize:12, color:'#94A3B8', textAlign:'center' }}>Direct Deposit → {paystubEntry.bank_name} ****{paystubEntry.bank_account?.slice(-4)}</div>}
                  </div>
                )
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPaystubOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={()=>window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
