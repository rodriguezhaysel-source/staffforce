import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { empName, entryHours, downloadBlob } from './shared/utils'
import type { Employee, TimeEntry } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Timesheets({ user, lang, employees }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filterEmp, setFilterEmp] = useState(user.role === 'employee' ? user.id : '')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const canApprove = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [filterEmp, filterStatus, filterDate])

  async function load() {
    let q = supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
    if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterDate) q = q.gte('clock_in', filterDate).lte('clock_in', filterDate + 'T23:59:59')
    const { data } = await q
    setEntries(data || [])
  }

  async function approve(id: string) {
    await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', id)
    load()
  }
  async function reject(id: string) {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id)
    load()
  }
  async function approveAll() {
    for (const e of entries.filter(e => e.status === 'pending')) {
      await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', e.id)
    }
    load()
  }
  async function saveEdit() {
    if (!editEntry) return
    await supabase.from('time_entries').update({
      clock_in: editEntry.clock_in, clock_out: editEntry.clock_out,
      break_mins: editEntry.break_mins, notes: editEntry.notes
    }).eq('id', editEntry.id)
    setEditOpen(false); load()
  }
  function exportCsv() {
    const rows = [['Employee','Date','Clock In','Clock Out','Break','Hours','Status']]
    entries.forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      rows.push([empName(emp), e.clock_in?.slice(0,10)||'', e.clock_in?format(new Date(e.clock_in),'HH:mm'):'', e.clock_out?format(new Date(e.clock_out),'HH:mm'):'', String(e.break_mins||0), entryHours(e).toFixed(2), e.status])
    })
    downloadBlob(rows.map(r=>r.join(',')).join('\n'), 'timesheets.csv', 'text/csv')
  }

  const pending = entries.filter(e => e.status === 'pending').length
  const totalHours = entries.reduce((s, e) => s + entryHours(e), 0)

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Total Entries', value:entries.length, color:'#0A6EBD' },
          { label:'Total Hours', value:totalHours.toFixed(1)+'h', color:'#0A6EBD' },
          { label:'Pending', value:pending, color:pending>0?'#D97706':'#059669' },
          { label:'Approved', value:entries.filter(e=>e.status==='approved').length, color:'#059669' },
        ].map((k,i)=>(
          <div key={i} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:k.color, fontFamily:'var(--font-mono)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding:14, marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          {user.role !== 'employee' && (
            <div style={{ flex:1, minWidth:180 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:4 }}>Employee</label>
              <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }}>
                <option value="">All Employees</option>
                {employees.map(e=><option key={e.id} value={e.id}>{empName(e)}</option>)}
              </select>
            </div>
          )}
          <div style={{ width:140 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:4 }}>Status</label>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div style={{ width:160 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:4 }}>Date</label>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={()=>{setFilterEmp(user.role==='employee'?user.id:'');setFilterStatus('');setFilterDate('')}}>Clear</button>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {canApprove && pending > 0 && <button className="btn btn-success btn-sm" onClick={approveAll}>Approve All ({pending})</button>}
            <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t(lang,'employee')}</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Break</th>
                <th>Hours</th>
                <th>Status</th>
                {canApprove && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const emp = employees.find(em=>em.id===e.employee_id)
                const hrs = entryHours(e)
                const ot = hrs > 8
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="avatar" style={{ width:28, height:28, fontSize:10, background:'var(--primary)', flexShrink:0 }}>
                          {(emp as any)?.avatar_url ? <img src={(emp as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (emp?.first_name?.[0]||'')+(emp?.last_name?.[0]||'')}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{empName(emp)}</div>
                          <div style={{ fontSize:11, color:'#94A3B8' }}>{emp?.position}</div>
                        </div>
                      </div>
                    </td>
                    <td>{e.clock_in?.slice(0,10)||'-'}</td>
                    <td className="mono">{e.clock_in?format(new Date(e.clock_in),'HH:mm'):'-'}</td>
                    <td className="mono">{e.clock_out?format(new Date(e.clock_out),'HH:mm'):<span style={{ color:'#059669', fontWeight:700 }}>Active</span>}</td>
                    <td>{e.break_mins||0}m</td>
                    <td className="mono" style={{ color:ot?'#D97706':undefined, fontWeight:ot?700:undefined }}>{hrs.toFixed(2)}{ot?' OT':''}</td>
                    <td><span className={`badge ${e.status==='approved'?'badge-success':e.status==='rejected'?'badge-danger':'badge-warning'}`}>{e.status}</span></td>
                    {canApprove && (
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>{setEditEntry(e);setEditOpen(true)}}>Edit</button>
                          {e.status==='pending' && <>
                            <button className="btn btn-success btn-sm" onClick={()=>approve(e.id)}>✓</button>
                            <button className="btn btn-danger btn-sm" onClick={()=>reject(e.id)}>✗</button>
                          </>}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {entries.length===0 && <div className="empty-state"><div className="empty-state-title">No entries found</div></div>}
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && editEntry && (
        <div className="modal-overlay" onClick={()=>setEditOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit Time Entry</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={()=>setEditOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Clock In</label>
                  <input type="datetime-local" value={editEntry.clock_in?.slice(0,16)||''} onChange={e=>setEditEntry(en=>en?{...en,clock_in:e.target.value}:en)} />
                </div>
                <div className="form-group">
                  <label>Clock Out</label>
                  <input type="datetime-local" value={editEntry.clock_out?.slice(0,16)||''} onChange={e=>setEditEntry(en=>en?{...en,clock_out:e.target.value}:en)} />
                </div>
              </div>
              <div className="form-group">
                <label>Break (minutes)</label>
                <input type="number" value={editEntry.break_mins||0} onChange={e=>setEditEntry(en=>en?{...en,break_mins:Number(e.target.value)}:en)} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={editEntry.notes||''} onChange={e=>setEditEntry(en=>en?{...en,notes:e.target.value}:en)} rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setEditOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
