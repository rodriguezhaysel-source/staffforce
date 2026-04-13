import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, addDays, addWeeks, subWeeks, differenceInMinutes, isToday } from 'date-fns'
import { empName, getDeptColor, hasOverlap } from '../../lib/utils'
import { ACard, ABtn, AModal, AInp, ASel, AC, getPositionColor, POSITION_COLORS, APageHeader, AEmpty, AStatusBadge } from './ui'
import type { Employee, Department, Shift, Location, OpenShift } from '../../types'

interface Props { user: Employee; employees: Employee[]; departments: Department[]; locations: Location[] }

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_START = 5   // 5am
const DAY_END = 24    // midnight
const VISIBLE_HOURS = DAY_END - DAY_START

export default function AdminSchedule({ user, employees, departments, locations }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [view, setView] = useState<'week' | 'day'>('week')
  const [viewDate, setViewDate] = useState(new Date())
  const [now, setNow] = useState(new Date())
  const [createOpen, setCreateOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [filterDept, setFilterDept] = useState('')
  const [form, setForm] = useState({ employee_id: '', department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '', status: 'draft' })
  const [openForm, setOpenForm] = useState({ department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const timelineRef = useRef<HTMLDivElement>(null)

  const days = view === 'day' ? [viewDate] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { load() }, [weekStart, view, viewDate])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    const ws = view === 'day' ? format(viewDate, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd')
    const we = view === 'day' ? format(viewDate, 'yyyy-MM-dd') : format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [s, os] = await Promise.all([
      supabase.from('shifts').select('*').gte('start_time', ws).lte('start_time', we + 'T23:59:59').order('start_time'),
      supabase.from('open_shifts').select('*').gte('start_time', ws).lte('start_time', we + 'T23:59:59'),
    ])
    setShifts(s.data || [])
    setOpenShifts(os.data || [])
  }

  // Convert time to % position on timeline
  function timeToPct(timeStr: string): number {
    const d = new Date(timeStr)
    const h = d.getHours() + d.getMinutes() / 60
    return Math.max(0, Math.min(100, ((h - DAY_START) / VISIBLE_HOURS) * 100))
  }

  function durationToPct(startStr: string, endStr: string): number {
    const start = new Date(startStr)
    const end = new Date(endStr)
    const mins = differenceInMinutes(end, start)
    return Math.max(2, (mins / 60 / VISIBLE_HOURS) * 100)
  }

  // Current time indicator position
  function nowPct(): number {
    const h = now.getHours() + now.getMinutes() / 60
    return ((h - DAY_START) / VISIBLE_HOURS) * 100
  }

  async function createShift() {
    setError('')
    if (!form.employee_id || !form.start_time || !form.end_time) { setError('Employee, start and end required'); return }
    if (form.start_time >= form.end_time) { setError('End must be after start'); return }
    const empShifts = shifts.filter(s => s.employee_id === form.employee_id)
    if (hasOverlap(form.start_time, form.end_time, empShifts)) { setError('Overlaps with existing shift'); return }
    setSaving(true)
    await supabase.from('shifts').insert({ ...form, created_by: user.id })
    setSaving(false); setCreateOpen(false); load()
    setForm({ employee_id: '', department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '', status: 'draft' })
  }

  async function updateShift() {
    if (!editShift) return
    setSaving(true)
    await supabase.from('shifts').update({ start_time: editShift.start_time, end_time: editShift.end_time, status: editShift.status, notes: editShift.notes, position: editShift.position, department_id: editShift.department_id }).eq('id', editShift.id)
    setSaving(false); setEditOpen(false); load()
  }

  async function deleteShift() {
    if (!editShift || !confirm('Delete this shift?')) return
    await supabase.from('shifts').delete().eq('id', editShift.id)
    setEditOpen(false); load()
  }

  async function publishAll() {
    const drafts = shifts.filter(s => s.status === 'draft')
    await Promise.all(drafts.map(s => supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)))
    const eids = [...new Set(drafts.map(s => s.employee_id))]
    await Promise.all(eids.map(eid => supabase.from('notifications').insert({ employee_id: eid, title: 'New Schedule Posted', message: 'Your schedule has been updated. Check the Schedule section.', type: 'info', read: false })))
    load()
  }

  async function createOpenShift() {
    if (!openForm.start_time || !openForm.end_time) return
    setSaving(true)
    await supabase.from('open_shifts').insert({ ...openForm, status: 'open', created_by: user.id })
    setSaving(false); setOpenShiftModal(false); load()
  }

  const filteredEmps = employees.filter(e => e.status === 'active' && (!filterDept || e.department_id === filterDept))
  const draftCount = shifts.filter(s => s.status === 'draft').length
  const totalWeekCost = filteredEmps.reduce((sum, emp) => {
    const empShifts = shifts.filter(s => s.employee_id === emp.id && s.status !== 'draft')
    const hrs = empShifts.reduce((s, sh) => sh.start_time && sh.end_time ? s + differenceInMinutes(new Date(sh.end_time), new Date(sh.start_time)) / 60 : s, 0)
    const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
    return sum + hrs * rate
  }, 0)

  // Build position legend from all shifts
  const usedPositions = [...new Set(shifts.map(s => s.position).filter(Boolean))]

  return (
    <div>
      <APageHeader title="Schedule" sub={`${format(days[0], 'MMM d')} — ${format(days[days.length - 1], 'MMM d, yyyy')}`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any, alignItems: 'center' }}>
          <ABtn variant="secondary" size="sm" onClick={() => { if (view === 'day') setViewDate(d => addDays(d, -1)); else setWeekStart(w => subWeeks(w, 1)) }}>‹</ABtn>
          <ABtn variant="secondary" size="sm" onClick={() => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setViewDate(new Date()) }}>Today</ABtn>
          <ABtn variant="secondary" size="sm" onClick={() => { if (view === 'day') setViewDate(d => addDays(d, 1)); else setWeekStart(w => addWeeks(w, 1)) }}>›</ABtn>
          <div style={{ display: 'flex', border: `1px solid ${AC.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {(['week', 'day'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', border: 'none', background: view === v ? AC.accent : 'transparent', color: view === v ? '#fff' : AC.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${AC.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {draftCount > 0 && <ABtn variant="success" size="sm" onClick={publishAll}>Publish {draftCount} Drafts</ABtn>}
          <ABtn variant="ghost" size="sm" onClick={() => setOpenShiftModal(true)}>+ Open Shift</ABtn>
          <ABtn variant="primary" size="sm" onClick={() => setCreateOpen(true)}>+ Add Shift</ABtn>
        </div>
      </APageHeader>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 12, color: AC.sub }}>
        <span><strong style={{ color: AC.text }}>{shifts.filter(s => s.status !== 'draft').length}</strong> scheduled</span>
        <span><strong style={{ color: AC.accent, fontFamily: 'IBM Plex Mono, monospace' }}>${Math.round(totalWeekCost).toLocaleString()}</strong> projected labor</span>
        {draftCount > 0 && <span style={{ color: AC.warning }}><strong>{draftCount}</strong> unpublished drafts</span>}
        {openShifts.filter(os => os.status === 'open').length > 0 && (
          <span style={{ color: AC.danger }}><strong>{openShifts.filter(os => os.status === 'open').length}</strong> open shifts unclaimed</span>
        )}
      </div>

      {/* Position legend */}
      {usedPositions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any, marginBottom: 14 }}>
          {usedPositions.map(pos => (
            <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: getPositionColor(pos!) + '20', border: `1px solid ${getPositionColor(pos!)}40` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPositionColor(pos!), flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: getPositionColor(pos!) }}>{pos}</span>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE GRID */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
        {/* Day headers */}
        <div style={{ display: 'flex', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ width: 160, minWidth: 160, padding: '10px 14px', borderRight: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {filteredEmps.length} staff
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {days.map(d => (
                <div key={d.toISOString()} style={{ flex: 1, padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #F3F4F6', background: isToday(d) ? 'rgba(37,99,235,0.06)' : 'transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday(d) ? '#2563EB' : '#6B7280' }}>{format(d, 'EEE')}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isToday(d) ? '#2563EB' : '#111827' }}>{format(d, 'd')}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: 80, padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>Wk Hrs</div>
          </div>
        </div>

        {/* Hour scale */}
        {view === 'day' && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', paddingLeft: 160 }}>
            {HOURS.slice(DAY_START, DAY_END).map(h => (
              <div key={h} style={{ flex: 1, padding: '4px 2px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', borderRight: '1px solid #E5E7EB' }}>
                {h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'}
              </div>
            ))}
          </div>
        )}

        {/* Employee rows */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
          {filteredEmps.map(emp => {
            const dept = departments.find(d => d.id === emp.department_id)
            const empShifts = shifts.filter(s => s.employee_id === emp.id)
            const weekHrs = empShifts.filter(s => s.status !== 'draft').reduce((sum, s) => s.start_time && s.end_time ? sum + differenceInMinutes(new Date(s.end_time), new Date(s.start_time)) / 60 : sum, 0)
            const isOT = weekHrs > 40

            return (
              <div key={emp.id} style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', minHeight: 52, alignItems: 'stretch' }}>
                {/* Employee label */}
                <div style={{ width: 160, minWidth: 160, padding: '8px 14px', borderRight: '1px solid #E5E7EB', background: '#F9FAFB', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.first_name} {emp.last_name?.[0]}.</div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{emp.position || dept?.name}</div>
                </div>

                {/* Day cells */}
                <div style={{ flex: 1, display: 'flex' }}>
                  {days.map(d => {
                    const key = format(d, 'yyyy-MM-dd')
                    const dayShifts = empShifts.filter(s => s.start_time?.slice(0, 10) === key)
                    const isTodayCol = isToday(d)

                    return (
                      <div
                        key={d.toISOString()}
                        style={{ flex: 1, position: 'relative', borderRight: '1px solid #F3F4F6', background: isTodayCol ? 'rgba(37,99,235,0.04)' : 'transparent', minHeight: 52, cursor: 'pointer' }}
                        onClick={() => {
                          const ds = format(d, 'yyyy-MM-dd')
                          setForm(f => ({ ...f, employee_id: emp.id, department_id: emp.department_id || '', start_time: ds + 'T09:00', end_time: ds + 'T17:00', position: emp.position || '' }))
                          setError(''); setCreateOpen(true)
                        }}
                      >
                        {/* Hour grid lines */}
                        {view === 'day' && HOURS.slice(DAY_START, DAY_END).map((h, idx) => (
                          <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(idx / VISIBLE_HOURS) * 100}%`, width: 1, background: '#F3F4F6' }} />
                        ))}

                        {/* Now line — only on today column */}
                        {isTodayCol && view === 'day' && (() => {
                          const pct = nowPct()
                          return pct > 0 && pct < 100 ? (
                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 2, background: '#EF4444', zIndex: 10 }}>
                              <div style={{ position: 'absolute', top: '50%', left: -4, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', transform: 'translateY(-50%)' }} />
                            </div>
                          ) : null
                        })()}

                        {/* Shifts */}
                        {view === 'day' ? (
                          dayShifts.map(s => {
                            const color = getPositionColor(s.position || '')
                            const left = timeToPct(s.start_time)
                            const width = durationToPct(s.start_time, s.end_time)
                            return (
                              <div
                                key={s.id}
                                onClick={e => { e.stopPropagation(); setEditShift(s); setEditOpen(true) }}
                                style={{ position: 'absolute', top: 8, height: 36, left: `${left}%`, width: `${width}%`, minWidth: 40, background: color, borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 7px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', zIndex: 2, opacity: s.status === 'draft' ? 0.6 : 1, border: s.status === 'draft' ? '2px dashed rgba(255,255,255,0.4)' : 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', overflow: 'hidden', whiteSpace: 'nowrap' }}
                              >
                                {s.position || format(new Date(s.start_time), 'HH:mm')}
                                <span style={{ marginLeft: 4, opacity: 0.75, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9 }}>{format(new Date(s.start_time), 'HH:mm')}</span>
                              </div>
                            )
                          })
                        ) : (
                          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayShifts.map(s => {
                              const color = getPositionColor(s.position || '')
                              return (
                                <div
                                  key={s.id}
                                  onClick={e => { e.stopPropagation(); setEditShift(s); setEditOpen(true) }}
                                  style={{ background: color, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: s.status === 'draft' ? 0.65 : 1, border: s.status === 'draft' ? '1.5px dashed rgba(255,255,255,0.4)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }}>{s.position || '—'}</span>
                                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, opacity: 0.8 }}>{format(new Date(s.start_time), 'HH:mm')}</span>
                                </div>
                              )
                            })}
                            {dayShifts.length === 0 && (
                              <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 18 }}>+</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Week hours */}
                <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #E5E7EB', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: isOT ? '#DC2626' : '#6B7280', fontFamily: 'IBM Plex Mono, monospace' }}>{weekHrs.toFixed(1)}h</div>
                  {isOT && <div style={{ fontSize: 9, fontWeight: 800, color: '#EF4444' }}>OT</div>}
                </div>
              </div>
            )
          })}

          {filteredEmps.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#4B5563' }}>No employees found</div>
          )}
        </div>

        {/* Open shifts footer */}
        {openShifts.filter(os => os.status === 'open').length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>Open Shifts — Unclaimed</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any }}>
              {openShifts.filter(os => os.status === 'open').map(os => {
                const dept = departments.find(d => d.id === os.department_id)
                const color = getPositionColor(os.position || '')
                return (
                  <div key={os.id} style={{ padding: '5px 12px', borderRadius: 6, background: color + '20', border: `1px solid ${color}40`, fontSize: 11, fontWeight: 700, color: '#111827' }}>
                    {os.position || 'Open'} · {format(new Date(os.start_time), 'EEE HH:mm')}–{format(new Date(os.end_time), 'HH:mm')}
                    {dept && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · {dept.name}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create shift modal */}
      <AModal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Shift">
        <div className="adm-modal-body">
          <ASel label="Employee" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee...</option>
            {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{empName(e)} — {e.position}</option>)}
          </ASel>
          <ASel label="Department" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </ASel>
          <div className="adm-input-row">
            <AInp label="Start Time" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            <AInp label="End Time" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <AInp label="Position" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Server, Cashier, Cook..." />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any, marginBottom: 14 }}>
            {Object.entries(POSITION_COLORS).filter(([k]) => k !== 'default').map(([pos, color]) => (
              <div key={pos} onClick={() => setForm(f => ({ ...f, position: pos }))} style={{ padding: '3px 10px', borderRadius: 20, background: color + '20', border: `1.5px solid ${form.position === pos ? color : color + '40'}`, cursor: 'pointer', fontSize: 11, fontWeight: 700, color }}>
                {pos}
              </div>
            ))}
          </div>
          <AInp label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          {error && <div style={{ color: AC.danger, fontSize: 12, marginTop: 4 }}>{error}</div>}
        </div>
        <div className="adm-modal-footer">
          <ABtn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</ABtn>
          <ABtn variant="primary" onClick={createShift} disabled={saving}>{saving ? 'Saving...' : 'Create Draft'}</ABtn>
        </div>
      </AModal>

      {/* Edit shift modal */}
      {editShift && (
        <AModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Shift">
          <div className="adm-modal-body">
            {(() => {
              const emp = employees.find(e => e.id === editShift.employee_id)
              return <div style={{ marginBottom: 16, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}><strong>{empName(emp)}</strong> · {emp?.position}</div>
            })()}
            <div className="adm-input-row">
              <AInp label="Start Time" type="datetime-local" value={editShift.start_time?.slice(0, 16) || ''} onChange={e => setEditShift(s => s ? { ...s, start_time: e.target.value } : s)} />
              <AInp label="End Time" type="datetime-local" value={editShift.end_time?.slice(0, 16) || ''} onChange={e => setEditShift(s => s ? { ...s, end_time: e.target.value } : s)} />
            </div>
            <AInp label="Position" value={editShift.position || ''} onChange={e => setEditShift(s => s ? { ...s, position: e.target.value } : s)} />
            <ASel label="Status" value={editShift.status} onChange={e => setEditShift(s => s ? { ...s, status: e.target.value } : s)}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </ASel>
            <AInp label="Notes" value={editShift.notes || ''} onChange={e => setEditShift(s => s ? { ...s, notes: e.target.value } : s)} rows={2} />
          </div>
          <div className="adm-modal-footer" style={{ justifyContent: 'space-between' }}>
            <ABtn variant="danger" size="sm" onClick={deleteShift}>Delete</ABtn>
            <div style={{ display: 'flex', gap: 8 }}>
              <ABtn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</ABtn>
              <ABtn variant="primary" onClick={updateShift} disabled={saving}>{saving ? 'Saving...' : 'Save'}</ABtn>
            </div>
          </div>
        </AModal>
      )}

      {/* Open shift modal */}
      <AModal open={openShiftModal} onClose={() => setOpenShiftModal(false)} title="Create Open Shift">
        <div className="adm-modal-body">
          <ASel label="Department" value={openForm.department_id} onChange={e => setOpenForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </ASel>
          <div className="adm-input-row">
            <AInp label="Start Time" type="datetime-local" value={openForm.start_time} onChange={e => setOpenForm(f => ({ ...f, start_time: e.target.value }))} />
            <AInp label="End Time" type="datetime-local" value={openForm.end_time} onChange={e => setOpenForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <AInp label="Position" value={openForm.position} onChange={e => setOpenForm(f => ({ ...f, position: e.target.value }))} />
          <AInp label="Notes" value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
        <div className="adm-modal-footer">
          <ABtn variant="secondary" onClick={() => setOpenShiftModal(false)}>Cancel</ABtn>
          <ABtn variant="primary" onClick={createOpenShift} disabled={saving}>{saving ? 'Saving...' : 'Create'}</ABtn>
        </div>
      </AModal>
    </div>
  )
}
