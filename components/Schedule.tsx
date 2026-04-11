import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, differenceInMinutes } from 'date-fns'
import { getDeptColor, hexToRgba, getShiftStyle, hasOverlap } from '../lib/colors'
import type { Employee, Department, Shift, Location } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[] }

const EMPTY_FORM = { employee_id: '', department_id: '', start_time: '', end_time: '', position: '', notes: '', status: 'draft' }

export default function Schedule({ user, lang, employees, departments, locations }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [view, setView] = useState<'week'|'2w'>('week')
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createCell, setCreateCell] = useState<{ date: string; empId: string } | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(new Date())

  const canEdit = user.role === 'admin' || user.role === 'manager'
  const numDays = view === '2w' ? 14 : 7
  const days = Array.from({ length: numDays }, (_, i) => addDays(weekStart, i))

  useEffect(() => { load() }, [weekStart, view])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('schedule-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [weekStart, view])

  async function load() {
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = format(addDays(weekStart, numDays - 1), 'yyyy-MM-dd')
    const { data } = await supabase.from('shifts').select('*')
      .gte('start_time', ws)
      .lte('start_time', we + 'T23:59:59')
      .order('start_time')
    setShifts(data || [])
  }

  // Determine shift visual state
  function shiftState(s: Shift): 'draft'|'active'|'late'|'completed'|'scheduled' {
    if (s.status === 'draft') return 'draft'
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    if (now > end) return 'completed'
    if (now >= start && now <= end) return 'active'
    if (now > start && s.status === 'scheduled') return 'late'
    return 'scheduled'
  }

  function getShiftsForCell(empId: string, date: Date): Shift[] {
    const key = format(date, 'yyyy-MM-dd')
    return shifts.filter(s => s.employee_id === empId && s.start_time.slice(0,10) === key)
  }

  function handleCellClick(empId: string, date: Date) {
    if (!canEdit) return
    const dateStr = format(date, 'yyyy-MM-dd')
    setCreateCell({ date: dateStr, empId })
    setForm({ ...EMPTY_FORM, employee_id: empId, start_time: dateStr + 'T09:00', end_time: dateStr + 'T17:00', department_id: employees.find(e=>e.id===empId)?.department_id||'' })
    setError('')
    setCreateOpen(true)
  }

  function handleShiftClick(e: React.MouseEvent, s: Shift) {
    e.stopPropagation()
    setSelectedShift(s)
    setPanelOpen(true)
  }

  async function createShift() {
    setError('')
    if (!form.employee_id || !form.start_time || !form.end_time) { setError('Employee, start and end time required'); return }
    if (form.start_time >= form.end_time) { setError('End time must be after start time'); return }
    // Overlap check
    const empShifts = shifts.filter(s => s.employee_id === form.employee_id)
    if (hasOverlap(form.start_time, form.end_time, empShifts)) { setError('This employee already has a shift that overlaps with this time'); return }
    setSaving(true)
    await supabase.from('shifts').insert({
      employee_id: form.employee_id,
      department_id: form.department_id || null,
      start_time: form.start_time,
      end_time: form.end_time,
      position: form.position || employees.find(e=>e.id===form.employee_id)?.position || '',
      notes: form.notes,
      status: 'draft',
    })
    setSaving(false); setCreateOpen(false); load()
  }

  async function updateShift() {
    if (!selectedShift) return
    // Overlap check (exclude self)
    const empShifts = shifts.filter(s => s.employee_id === selectedShift.employee_id && s.id !== selectedShift.id)
    if (hasOverlap(selectedShift.start_time, selectedShift.end_time, empShifts)) { setError('Overlap with existing shift'); return }
    await supabase.from('shifts').update({ start_time: selectedShift.start_time, end_time: selectedShift.end_time, status: selectedShift.status, notes: selectedShift.notes }).eq('id', selectedShift.id)
    setPanelOpen(false); load()
  }

  async function deleteShift() {
    if (!selectedShift || !confirm('Delete this shift?')) return
    await supabase.from('shifts').delete().eq('id', selectedShift.id)
    setPanelOpen(false); setSelectedShift(null); load()
  }

  async function publishAll() {
    const drafts = shifts.filter(s => s.status === 'draft')
    for (const s of drafts) await supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)
    const eids = [...new Set(drafts.map(s => s.employee_id))]
    for (const eid of eids) await supabase.from('notifications').insert({ employee_id: eid, title: 'Schedule Published', message: 'Your schedule has been published.', type: 'info', read: false })
    load()
  }

  const draftCount = shifts.filter(s => s.status === 'draft').length
  const displayEmployees = user.role === 'employee' ? employees.filter(e => e.id === user.id) : employees.filter(e => e.status === 'active')

  return (
    <div>
      <div className="schedule-wrap">
        {/* Header */}
        <div className="schedule-header">
          <div className="schedule-nav">
            <button onClick={() => setWeekStart(subWeeks(weekStart,1))}>&#8249;</button>
            <span className="week-label">
              {format(weekStart,'MMM d')} — {format(addDays(weekStart,numDays-1),'MMM d, yyyy')}
            </span>
            <button onClick={() => setWeekStart(addWeeks(weekStart,1))}>&#8250;</button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(),{weekStartsOn:1}))}>Today</button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <div className="schedule-views">
              <button className={view==='week'?'active':''} onClick={()=>setView('week')}>Week</button>
              <button className={view==='2w'?'active':''} onClick={()=>setView('2w')}>2 Weeks</button>
            </div>
            {canEdit && draftCount > 0 && (
              <button className="btn btn-success btn-sm" onClick={publishAll}>
                Publish {draftCount} Drafts
              </button>
            )}
            {/* Legend */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[['Draft','dashed','#94A3B8'],['Scheduled','solid','#2563EB'],['Active','pulse','#059669'],['Late','solid','#DC2626'],['Done','solid','#94A3B8']].map(([l,s,c])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#64748B', fontWeight:600 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background: l==='Done'?'transparent':hexToRgba(c,0.2), border:`2px ${s==='dashed'?'dashed':'solid'} ${c}`, opacity: l==='Done'?0.5:1 }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="schedule-grid">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Employee</th>
                {days.map(d => (
                  <th key={d.toISOString()} className={isToday(d)?'today':''}>
                    <div style={{ fontSize:11, fontWeight:700 }}>{format(d,'EEE')}</div>
                    <div style={{ fontSize:16, fontWeight:900 }}>{format(d,'d')}</div>
                    {(() => {
                      const dayShifts = shifts.filter(s => s.start_time.slice(0,10) === format(d,'yyyy-MM-dd'))
                      const covered = new Set(dayShifts.map(s => s.employee_id)).size
                      const total = displayEmployees.length
                      const pct = total === 0 ? 100 : Math.round(covered/total*100)
                      const color = pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626'
                      const bg = pct >= 70 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#FEE2E2'
                      return total > 0 ? <div style={{ fontSize:9, fontWeight:700, color, background:bg, borderRadius:4, padding:'1px 5px', marginTop:2, display:'inline-block' }}>{covered}/{total}</div> : null
                    })()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayEmployees.map(emp => {
                const dept = departments.find(d => d.id === emp.department_id)
                const deptColor = getDeptColor(emp.department_id, departments)
                return (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="avatar" style={{ width:28, height:28, fontSize:10, background: deptColor, flexShrink:0 }}>
                          {(emp as any).avatar_url
                            ? <img src={(emp as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : (emp.first_name?.[0]||'')+(emp.last_name?.[0]||'')}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:12, lineHeight:1.2 }}>{emp.first_name} {emp.last_name?.[0]}.</div>
                          <div style={{ fontSize:10, color:'#94A3B8' }}>{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const cellShifts = getShiftsForCell(emp.id, d)
                      return (
                        <td
                          key={d.toISOString()}
                          className={isToday(d)?'today-col':''}
                          onClick={() => handleCellClick(emp.id, d)}
                          style={{ minHeight:60 }}
                        >
                          {cellShifts.map(s => {
                            const color = getDeptColor(s.department_id, departments)
                            const state = shiftState(s)
                            const style = getShiftStyle(color, s.status)
                            const isLate = state === 'late'
                            const isActive = state === 'active'
                            return (
                              <div
                                key={s.id}
                                className={`shift-block ${s.status === 'draft' ? 'draft' : ''} ${isActive ? 'active-shift' : ''} ${isLate ? 'late-shift' : ''} ${state === 'completed' ? 'completed' : ''}`}
                                style={{
                                  ...style,
                                  borderLeftColor: isLate ? '#DC2626' : color,
                                  background: isLate ? '#FEE2E2' : style.background,
                                  color: isLate ? '#991B1B' : style.color,
                                }}
                                onClick={e => handleShiftClick(e, s)}
                              >
                                <div className="shift-name">{emp.first_name} {emp.last_name?.[0]}.</div>
                                <div className="shift-time">{format(new Date(s.start_time),'HH:mm')}–{format(new Date(s.end_time),'HH:mm')}</div>
                                {s.position && <div className="shift-pos">{s.position}</div>}
                                {isActive && <div className="shift-badge" style={{ background:'#059669', color:'#fff' }}>LIVE</div>}
                                {isLate && <div className="shift-badge" style={{ background:'#DC2626', color:'#fff' }}>LATE</div>}
                                {s.status === 'draft' && <div className="shift-badge" style={{ background:'#D97706', color:'#fff' }}>DRAFT</div>}
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create shift modal */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Shift</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={() => setCreateOpen(false)}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Employee</label>
                <select value={form.employee_id} onChange={e => setForm(f=>({...f,employee_id:e.target.value,department_id:employees.find(em=>em.id===e.target.value)?.department_id||''}))}>
                  <option value="">Select employee...</option>
                  {employees.filter(e=>e.status==='active').map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.position}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <select value={form.department_id} onChange={e => setForm(f=>({...f,department_id:e.target.value}))}>
                  <option value="">None</option>
                  {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start</label>
                  <input type="datetime-local" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input type="datetime-local" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label>Position / Role</label>
                <input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="e.g. Server, Manager..." />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} />
              </div>
              {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:7, fontSize:13, marginBottom:8 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createShift} disabled={saving}>{saving ? 'Saving...' : 'Create Shift'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Side panel — shift details */}
      <div className={`side-panel ${panelOpen ? 'open' : ''}`}>
        {selectedShift && (() => {
          const emp = employees.find(e => e.id === selectedShift.employee_id)
          const dept = departments.find(d => d.id === selectedShift.department_id)
          const color = getDeptColor(selectedShift.department_id, departments)
          const state = shiftState(selectedShift)
          const hrs = differenceInMinutes(new Date(selectedShift.end_time), new Date(selectedShift.start_time)) / 60
          return <>
            <div className="side-panel-header">
              <div>
                <div style={{ fontSize:16, fontWeight:800 }}>Shift Details</div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{dept?.name || 'No department'}</div>
              </div>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748B' }} onClick={() => setPanelOpen(false)}>x</button>
            </div>
            <div className="side-panel-body">
              {/* Employee */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'12px 14px', background:'#F8FAFC', borderRadius:10, border:'1px solid #E2E6EC' }}>
                <div className="avatar" style={{ width:44, height:44, fontSize:16, background:color }}>
                  {(emp as any)?.avatar_url
                    ? <img src={(emp as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : (emp?.first_name?.[0]||'')+(emp?.last_name?.[0]||'')}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{emp?.first_name} {emp?.last_name}</div>
                  <div style={{ fontSize:12, color:'#64748B' }}>{selectedShift.position || emp?.position}</div>
                </div>
              </div>

              {/* State badge */}
              <div style={{ marginBottom:16 }}>
                <span className={`badge ${state==='active'?'badge-success':state==='late'?'badge-danger':state==='completed'?'badge-gray':state==='draft'?'badge-warning':'badge-blue'}`} style={{ fontSize:12 }}>
                  {state.toUpperCase()}
                </span>
              </div>

              {/* Shift times */}
              {canEdit ? <>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="datetime-local" value={selectedShift.start_time?.slice(0,16)||''} onChange={e=>setSelectedShift(s=>s?{...s,start_time:e.target.value}:s)} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="datetime-local" value={selectedShift.end_time?.slice(0,16)||''} onChange={e=>setSelectedShift(s=>s?{...s,end_time:e.target.value}:s)} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={selectedShift.status} onChange={e=>setSelectedShift(s=>s?{...s,status:e.target.value}:s)}>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={selectedShift.notes||''} onChange={e=>setSelectedShift(s=>s?{...s,notes:e.target.value}:s)} rows={3} />
                </div>
                {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:7, fontSize:13, marginBottom:8 }}>{error}</div>}
              </> : <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                  <div style={{ background:'#F8FAFC', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E6EC' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:4 }}>Start</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{format(new Date(selectedShift.start_time),'HH:mm')}</div>
                    <div style={{ fontSize:11, color:'#64748B' }}>{format(new Date(selectedShift.start_time),'EEE, MMM d')}</div>
                  </div>
                  <div style={{ background:'#F8FAFC', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E6EC' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:4 }}>End</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{format(new Date(selectedShift.end_time),'HH:mm')}</div>
                    <div style={{ fontSize:11, color:'#64748B' }}>{format(new Date(selectedShift.end_time),'EEE, MMM d')}</div>
                  </div>
                </div>
                <div style={{ background:'#F8FAFC', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E6EC', marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', marginBottom:4 }}>Duration</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:900, fontSize:18 }}>{hrs.toFixed(1)}h</div>
                </div>
                {selectedShift.notes && <div style={{ fontSize:13, color:'#64748B', background:'#F8FAFC', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E6EC' }}>{selectedShift.notes}</div>}
              </>}
            </div>
            {canEdit && (
              <div className="side-panel-footer">
                <button className="btn btn-danger btn-sm" onClick={deleteShift}>Delete</button>
                <div style={{ flex:1 }} />
                <button className="btn btn-secondary btn-sm" onClick={() => setPanelOpen(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={updateShift}>Save</button>
              </div>
            )}
          </>
        })()}
      </div>
      {panelOpen && <div style={{ position:'fixed', inset:0, zIndex:150 }} onClick={() => setPanelOpen(false)} />}
    </div>
  )
}
