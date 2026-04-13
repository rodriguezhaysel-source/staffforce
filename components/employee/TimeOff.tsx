import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import { format, addDays, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { empName } from '../../lib/utils'
import type { Employee, TimeOff } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[]; departments?: any[] }

export default function TimeOffComp({ user, lang, employees }: Props) {
  const [requests, setRequests] = useState<TimeOff[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [form, setForm] = useState({ type:'vacation', reason:'', start_date:'', end_date:'' })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [appConfig, setAppConfig] = useState<any>({})
  const [error, setError] = useState('')
  const canReview = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load(); loadConfig() }, [])

  async function load() {
    let q = supabase.from('time_off').select('*').order('created_at' as any, { ascending:false })
    if (user.role === 'employee') q = q.eq('employee_id', user.id)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterType) q = q.eq('type', filterType)
    const { data } = await q
    setRequests(data || [])
  }

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('timeoff_config').limit(1)
    if (data?.[0]?.timeoff_config) setAppConfig(data[0].timeoff_config)
  }

  async function submit() {
    setError('')
    if (!form.start_date || !form.end_date) { setError('Please select dates'); return }
    if (form.start_date > form.end_date) { setError('End date must be after start date'); return }

    const minDays = appConfig.min_advance_days || 2
    const minDate = format(addDays(new Date(), form.type === 'sick' ? 0 : minDays), 'yyyy-MM-dd')
    if (form.type !== 'sick' && form.start_date < minDate) {
      setError(`Requests must be submitted at least ${minDays} days in advance`)
      return
    }

    const days = eachDayOfInterval({ start: new Date(form.start_date), end: new Date(form.end_date) }).length
    await supabase.from('time_off').insert({ ...form, employee_id:user.id, days, status:'pending' })
    setModalOpen(false); setForm({ type:'vacation', reason:'', start_date:'', end_date:'' }); load()
  }

  async function approve(r: TimeOff) {
    await supabase.from('time_off').update({ status:'approved', reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq('id', r.id)
    if (r.type === 'vacation') {
      const emp = employees.find(e=>e.id===r.employee_id)
      if (emp) await supabase.from('employees').update({ pto_balance:Math.max(0,(emp.pto_balance||0)-r.days) }).eq('id', emp.id)
    }
    await supabase.from('notifications').insert({ employee_id:r.employee_id, title:'Time Off Approved', message:`Your ${r.type} request has been approved.`, type:'success', read:false })
    load()
  }

  async function deny(r: TimeOff) {
    await supabase.from('time_off').update({ status:'rejected', reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq('id', r.id)
    await supabase.from('notifications').insert({ employee_id:r.employee_id, title:'Time Off Denied', message:'Your time off request was not approved.', type:'error', read:false })
    load()
  }

  // Calendar
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const pad = Array(monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1).fill(null)
  const approvedDates = requests.filter(r=>r.status==='approved').flatMap(r=>
    eachDayOfInterval({ start:new Date(r.start_date), end:new Date(r.end_date) }).map(d=>format(d,'yyyy-MM-dd'))
  )
  const pendingDates = requests.filter(r=>r.status==='pending').flatMap(r=>
    eachDayOfInterval({ start:new Date(r.start_date), end:new Date(r.end_date) }).map(d=>format(d,'yyyy-MM-dd'))
  )
  const myEmp = employees.find(e=>e.id===user.id)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:16, alignItems:'start' }}>
        {/* Calendar */}
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>{format(viewMonth,'MMMM yyyy')}</div>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(d=>addDays(startOfMonth(d),-1))}>‹</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(d=>addDays(endOfMonth(d),1))}>›</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
              {['M','T','W','T','F','S','S'].map((d,i)=>(
                <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'#94A3B8', padding:'3px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {pad.map((_,i)=><div key={'p'+i} />)}
              {calDays.map(day => {
                const ds = format(day,'yyyy-MM-dd')
                const isApproved = approvedDates.includes(ds)
                const isPending = pendingDates.includes(ds)
                const isToday = ds === format(new Date(),'yyyy-MM-dd')
                const isSelected = selectedDays.includes(ds)
                return (
                  <div key={ds} style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                    background: isSelected?'var(--primary)':isApproved?'#D1FAE5':isPending?'#FEF3C7':isToday?'#EFF6FF':'transparent',
                    color: isSelected?'#fff':isApproved?'#065F46':isPending?'#92400E':isToday?'var(--primary)':'#374151',
                    border: isToday?'1.5px solid var(--primary)':'1.5px solid transparent'
                  }}>
                    {format(day,'d')}
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:14, marginTop:12, flexWrap:'wrap' }}>
              {[['#D1FAE5','#065F46','Approved'],['#FEF3C7','#92400E','Pending'],['#EFF6FF','var(--primary)','Today']].map(([bg,c,l])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#64748B' }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:bg, border:`1px solid ${c}` }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* PTO balance */}
          {((myEmp?.pto_balance||0) > 0 || (myEmp?.pto_accrual_rate||0) > 0) && (
            <div className="card" style={{ background:'#EFF6FF', border:'1px solid #BFDBFE' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1D4ED8', marginBottom:8 }}>PTO Balance</div>
              <div style={{ fontSize:28, fontWeight:900, color:'var(--primary)', fontFamily:'var(--font-mono)' }}>{myEmp?.pto_balance||0} days</div>
              {(myEmp?.pto_accrual_rate||0) > 0 && <div style={{ fontSize:11, color:'#64748B', marginTop:4 }}>Accruing {myEmp?.pto_accrual_rate} days/month</div>}
            </div>
          )}
        </div>

        {/* Requests */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', gap:8 }}>
              <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load()}} style={{ padding:'6px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={filterType} onChange={e=>{setFilterType(e.target.value);load()}} style={{ padding:'6px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                <option value="">All Types</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalOpen(true)}>+ Request Time Off</button>
          </div>

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {canReview && <th>Employee</th>}
                    <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                    {canReview && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const emp = employees.find(e=>e.id===r.employee_id)
                    return (
                      <tr key={r.id}>
                        {canReview && <td style={{ fontWeight:600 }}>{empName(emp)}</td>}
                        <td><span className="badge badge-gray" style={{ textTransform:'capitalize' }}>{r.type}</span></td>
                        <td>{r.start_date}</td>
                        <td>{r.end_date}</td>
                        <td style={{ fontWeight:700 }}>{r.days}</td>
                        <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#64748B' }}>{r.reason||'-'}</td>
                        <td><span className={`badge ${r.status==='approved'?'badge-success':r.status==='rejected'?'badge-danger':'badge-warning'}`}>{r.status}</span></td>
                        {canReview && <td>{r.status==='pending'&&<div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-success btn-sm" onClick={()=>approve(r)}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>deny(r)}>Deny</button>
                        </div>}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {requests.length===0 && <div className="empty-state"><div className="empty-state-title">No requests</div></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Request modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={()=>setModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Request Time Off</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={()=>setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="vacation">Vacation (uses PTO)</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} /></div>
              </div>
              <div className="form-group"><label>Reason (optional)</label><textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} rows={3} /></div>
              {form.type !== 'sick' && appConfig.min_advance_days > 0 && (
                <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#92400E', marginBottom:8 }}>
                  Requests must be submitted at least {appConfig.min_advance_days} days in advance
                </div>
              )}
              {error && <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#DC2626', marginBottom:8 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
