import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, differenceInMinutes } from 'date-fns'
import { getDeptColor, hexToRgba, hasOverlap, entryHours } from '../../lib/utils'
import { Card, Btn, Badge, Popup, Inp, Sel, C, StatusBadge, EmptyState } from '../ui'
import type { Employee, Department, Shift, Location, OpenShift } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[] }

const EMPTY_FORM = { employee_id: '', department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '', status: 'draft' }

export default function Schedule({ user, lang, employees, departments, locations }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [view, setView] = useState<'week' | '2w' | 'day'>('week')
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [openForm, setOpenForm] = useState({ department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(new Date())
  const [viewDate, setViewDate] = useState(new Date())

  // Employee portal: read-only view of own schedule
  const canEdit = false
  const numDays = view === '2w' ? 14 : view === 'day' ? 1 : 7
  const days = view === 'day' ? [viewDate] : Array.from({ length: numDays }, (_, i) => addDays(weekStart, i))

  useEffect(() => { load() }, [weekStart, view, viewDate])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    const ch = supabase.channel('schedule-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_shifts' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [weekStart, view])

  async function load() {
    const ws = view === 'day' ? format(viewDate, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd')
    const we = view === 'day' ? format(viewDate, 'yyyy-MM-dd') : format(addDays(weekStart, numDays - 1), 'yyyy-MM-dd')
    const [s, os] = await Promise.all([
      supabase.from('shifts').select('*').eq('employee_id', user.id).gte('start_time', ws).lte('start_time', we + 'T23:59:59').order('start_time'),
      supabase.from('open_shifts').select('*').gte('start_time', ws).lte('start_time', we + 'T23:59:59').order('start_time'),
    ])
    setShifts(s.data || [])
    setOpenShifts(os.data || [])
  }

  function shiftState(s: Shift): 'draft' | 'active' | 'late' | 'completed' | 'scheduled' {
    if (s.status === 'draft') return 'draft'
    const start = new Date(s.start_time), end = new Date(s.end_time)
    if (now > end) return 'completed'
    if (now >= start && now <= end) return 'active'
    if (now > start) return 'late'
    return 'scheduled'
  }

  function getShiftsForCell(empId: string, date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return shifts.filter(s => s.employee_id === empId && s.start_time.slice(0, 10) === key)
  }

  function getEmpWeekHours(empId: string): number {
    return shifts.filter(s => s.employee_id === empId && s.status !== 'draft').reduce((sum, s) => {
      if (!s.start_time || !s.end_time) return sum
      return sum + differenceInMinutes(new Date(s.end_time), new Date(s.start_time)) / 60
    }, 0)
  }

  function getEmpWeekCost(emp: Employee): number {
    const hrs = getEmpWeekHours(emp.id)
    const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
    return hrs * rate
  }

  function handleCellClick(empId: string, date: Date) {
    if (!canEdit) return
    const dateStr = format(date, 'yyyy-MM-dd')
    setForm({ ...EMPTY_FORM, employee_id: empId, start_time: dateStr + 'T09:00', end_time: dateStr + 'T17:00', department_id: employees.find(e => e.id === empId)?.department_id || '' })
    setError('')
    setCreateOpen(true)
  }

  async function createShift() {
    setError('')
    if (!form.employee_id || !form.start_time || !form.end_time) { setError('Employee, start and end time required'); return }
    if (form.start_time >= form.end_time) { setError('End must be after start'); return }
    const empShifts = shifts.filter(s => s.employee_id === form.employee_id)
    if (hasOverlap(form.start_time, form.end_time, empShifts)) { setError('Overlaps with existing shift'); return }
    setSaving(true)
    await supabase.from('shifts').insert({ ...form, position: form.position || employees.find(e => e.id === form.employee_id)?.position || '', status: 'draft', created_by: user.id })
    setSaving(false); setCreateOpen(false); load()
  }

  async function updateShift() {
    if (!selectedShift) return
    setSaving(true)
    await supabase.from('shifts').update({ start_time: selectedShift.start_time, end_time: selectedShift.end_time, status: selectedShift.status, notes: selectedShift.notes, position: selectedShift.position }).eq('id', selectedShift.id)
    setSaving(false); setPanelOpen(false); load()
  }

  async function deleteShift() {
    if (!selectedShift || !confirm('Delete this shift?')) return
    await supabase.from('shifts').delete().eq('id', selectedShift.id)
    setPanelOpen(false); setSelectedShift(null); load()
  }

  async function publishAll() {
    const drafts = shifts.filter(s => s.status === 'draft')
    if (drafts.length === 0) return
    await Promise.all(drafts.map(s => supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)))
    const eids = [...new Set(drafts.map(s => s.employee_id))]
    await Promise.all(eids.map(eid => supabase.from('notifications').insert({ employee_id: eid, title: 'Schedule Published', message: 'Your schedule has been updated.', type: 'info', read: false })))
    load()
  }

  async function createOpenShift() {
    if (!openForm.start_time || !openForm.end_time) { setError('Start and end time required'); return }
    setSaving(true)
    await supabase.from('open_shifts').insert({ ...openForm, status: 'open', created_by: user.id })
    setSaving(false); setOpenShiftModal(false); setOpenForm({ department_id: '', location_id: '', start_time: '', end_time: '', position: '', notes: '' }); load()
  }

  async function claimOpenShift(osId: string) {
    await supabase.from('open_shifts').update({ status: 'claimed', claimed_by: user.id, claimed_at: new Date().toISOString() }).eq('id', osId)
    load()
  }

  const draftCount = shifts.filter(s => s.status === 'draft').length
  // Employee portal: always show only the logged-in user's own shifts
  const displayEmployees = employees.filter(e => e.id === user.id)
  const weekLaborCost = displayEmployees.reduce((sum, emp) => sum + getEmpWeekCost(emp), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={() => { if (view === 'day') setViewDate(d => addDays(d, -1)); else setWeekStart(subWeeks(weekStart, 1)) }}>‹</Btn>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 180, textAlign: 'center' }}>
            {view === 'day' ? format(viewDate, 'EEEE, MMM d, yyyy') : `${format(days[0], 'MMM d')} — ${format(days[days.length - 1], 'MMM d, yyyy')}`}
          </span>
          <Btn variant="secondary" size="sm" onClick={() => { if (view === 'day') setViewDate(d => addDays(d, 1)); else setWeekStart(addWeeks(weekStart, 1)) }}>›</Btn>
          <Btn variant="secondary" size="sm" onClick={() => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setViewDate(new Date()) }}>Today</Btn>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {(['day', 'week', '2w'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: view === v ? C.accent : 'transparent', color: view === v ? '#fff' : C.textSub, transition: 'all 0.15s' }}>
                {v === '2w' ? '2 Weeks' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {canEdit && draftCount > 0 && <Btn variant="success" size="sm" onClick={publishAll}>Publish {draftCount} Drafts</Btn>}
          {canEdit && <Btn variant="ghost" size="sm" onClick={() => setOpenShiftModal(true)}>+ Open Shift</Btn>}
        </div>
      </div>

      {/* Labor cost summary */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.textSub }}><span style={{ fontWeight: 700, color: C.text }}>{shifts.filter(s => s.status !== 'draft').length}</span> scheduled shifts</div>
          <div style={{ fontSize: 12, color: C.textSub }}><span style={{ fontWeight: 700, color: C.accent, fontFamily: 'var(--font-mono)' }}>${Math.round(weekLaborCost).toLocaleString()}</span> projected labor cost</div>
          {draftCount > 0 && <div style={{ fontSize: 12, color: C.warning }}><span style={{ fontWeight: 700 }}>{draftCount}</span> unpublished drafts</div>}
          {openShifts.filter(os => os.status === 'open').length > 0 && (
            <div style={{ fontSize: 12, color: C.danger }}><span style={{ fontWeight: 700 }}>{openShifts.filter(os => os.status === 'open').length}</span> unclaimed open shifts</div>
          )}
        </div>
      )}

      {/* Grid */}
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ width: 160, padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
                  {canEdit ? `${displayEmployees.length} staff` : 'Employee'}
                </th>
                {days.map(d => {
                  const key = format(d, 'yyyy-MM-dd')
                  const dayShifts = shifts.filter(s => s.start_time.slice(0, 10) === key && s.status !== 'draft')
                  const covered = new Set(dayShifts.map(s => s.employee_id)).size
                  const pct = displayEmployees.length > 0 ? Math.round(covered / displayEmployees.length * 100) : 100
                  return (
                    <th key={d.toISOString()} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, background: isToday(d) ? '#EFF6FF' : '#F8FAFC', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, minWidth: view === 'day' ? 300 : 100 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isToday(d) ? C.accent : C.textSub }}>{format(d, 'EEE')}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: isToday(d) ? C.accent : C.text }}>{format(d, 'd')}</div>
                      {displayEmployees.length > 0 && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: pct >= 70 ? C.success : pct >= 40 ? C.warning : C.danger, background: pct >= 70 ? C.successBg : pct >= 40 ? C.warningBg : C.dangerBg, borderRadius: 4, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>
                          {covered}/{displayEmployees.length}
                        </div>
                      )}
                    </th>
                  )
                })}
                {canEdit && <th style={{ width: 90, padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: C.textMuted, background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>Week Hrs</th>}
              </tr>
            </thead>
            <tbody>
              {displayEmployees.map(emp => {
                const deptColor = getDeptColor(emp.department_id, departments)
                const weekHrs = getEmpWeekHours(emp.id)
                const isOT = weekHrs > 40
                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 14px', borderRight: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: emp.avatar_url ? 'transparent' : deptColor, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {emp.avatar_url ? <img src={emp.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.first_name} {emp.last_name?.[0]}.</div>
                          <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const cellShifts = getShiftsForCell(emp.id, d)
                      return (
                        <td key={d.toISOString()} onClick={() => handleCellClick(emp.id, d)} style={{ padding: 4, verticalAlign: 'top', borderLeft: `1px solid ${C.border}`, cursor: canEdit ? 'pointer' : 'default', background: isToday(d) ? '#FAFBFF' : 'transparent', minHeight: 60 }}>
                          {cellShifts.map(s => {
                            const state = shiftState(s)
                            const color = deptColor
                            return (
                              <div key={s.id} onClick={e => { e.stopPropagation(); setSelectedShift(s); setPanelOpen(true) }} style={{ background: hexToRgba(color, 0.12), borderLeft: `3px solid ${color}`, borderRadius: 4, padding: '3px 6px', marginBottom: 2, cursor: 'pointer', opacity: state === 'completed' ? 0.6 : 1, borderStyle: s.status === 'draft' ? 'dashed' : 'solid' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.text, fontFamily: 'var(--font-mono)' }}>{format(new Date(s.start_time), 'HH:mm')}–{format(new Date(s.end_time), 'HH:mm')}</div>
                                {s.position && <div style={{ fontSize: 9, color: C.textSub }}>{s.position}</div>}
                                {state === 'active' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, display: 'inline-block' }} />}
                              </div>
                            )
                          })}
                          {cellShifts.length === 0 && canEdit && <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.border, fontSize: 18 }}>+</div>}
                        </td>
                      )
                    })}
                    {canEdit && (
                      <td style={{ padding: '8px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isOT ? C.danger : C.text, fontFamily: 'var(--font-mono)' }}>{weekHrs.toFixed(1)}h</div>
                        {isOT && <div style={{ fontSize: 9, color: C.danger, fontWeight: 700 }}>OT</div>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Open shifts section */}
      {openShifts.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 12 }}>Open Shifts — Available to Claim</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {openShifts.map(os => {
              const dept = departments.find(d => d.id === os.department_id)
              const claimedBy = os.claimed_by ? employees.find(e => e.id === os.claimed_by) : null
              return (
                <div key={os.id} style={{ padding: '12px 14px', border: `1px solid ${os.status === 'open' ? C.accentBorder : C.border}`, borderRadius: 8, background: os.status === 'open' ? C.accentLight : '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{os.position || 'Open Position'}</span>
                    <StatusBadge status={os.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{format(new Date(os.start_time), 'EEE MMM d, HH:mm')} — {format(new Date(os.end_time), 'HH:mm')}</div>
                  {dept && <div style={{ fontSize: 11, color: C.textSub, marginBottom: 8 }}>{dept.name}</div>}
                  {os.notes && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{os.notes}</div>}
                  {claimedBy && <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>Claimed by {claimedBy.first_name} {claimedBy.last_name}</div>}
                  {os.status === 'open' && user.role === 'employee' && (
                    <Btn variant="primary" size="sm" onClick={() => claimOpenShift(os.id)} style={{ marginTop: 8 }}>Claim This Shift</Btn>
                  )}
                  {os.status === 'open' && canEdit && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <Btn variant="danger" size="sm" onClick={async () => { await supabase.from('open_shifts').update({ status: 'cancelled' }).eq('id', os.id); load() }}>Cancel</Btn>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Create shift modal */}
      <Popup open={createOpen} onClose={() => setCreateOpen(false)} title="Create Shift">
        <div style={{ padding: '20px 24px' }}>
          <Sel label="Employee" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee...</option>
            {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Sel>
          <Sel label="Department" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start Time" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            <Inp label="End Time" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Inp label="Position" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Cashier, Server..." />
          <Inp label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={createShift} disabled={saving}>{saving ? 'Saving...' : 'Create Draft'}</Btn>
        </div>
      </Popup>

      {/* Edit shift modal */}
      {selectedShift && (
        <Popup open={panelOpen} onClose={() => setPanelOpen(false)} title="Edit Shift">
          <div style={{ padding: '20px 24px' }}>
            {(() => {
              const emp = employees.find(e => e.id === selectedShift.employee_id)
              const dept = departments.find(d => d.id === selectedShift.department_id)
              return (
                <div style={{ marginBottom: 16, padding: '12px', background: '#F8FAFC', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700 }}>{emp?.first_name} {emp?.last_name}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{dept?.name} · {emp?.position}</div>
                </div>
              )
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label="Start Time" type="datetime-local" value={selectedShift.start_time?.slice(0, 16) || ''} onChange={e => setSelectedShift(s => s ? { ...s, start_time: e.target.value } : s)} />
              <Inp label="End Time" type="datetime-local" value={selectedShift.end_time?.slice(0, 16) || ''} onChange={e => setSelectedShift(s => s ? { ...s, end_time: e.target.value } : s)} />
            </div>
            <Inp label="Position" value={selectedShift.position || ''} onChange={e => setSelectedShift(s => s ? { ...s, position: e.target.value } : s)} />
            <Sel label="Status" value={selectedShift.status} onChange={e => setSelectedShift(s => s ? { ...s, status: e.target.value } : s)}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </Sel>
            <Inp label="Notes" value={selectedShift.notes || ''} onChange={e => setSelectedShift(s => s ? { ...s, notes: e.target.value } : s)} rows={2} />
          </div>
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <Btn variant="danger" size="sm" onClick={deleteShift}>Delete</Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setPanelOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={updateShift} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
            </div>
          </div>
        </Popup>
      )}

      {/* Open shift modal */}
      <Popup open={openShiftModal} onClose={() => setOpenShiftModal(false)} title="Create Open Shift">
        <div style={{ padding: '20px 24px' }}>
          <Sel label="Department" value={openForm.department_id} onChange={e => setOpenForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
          <Sel label="Location" value={openForm.location_id} onChange={e => setOpenForm(f => ({ ...f, location_id: e.target.value }))}>
            <option value="">Select location...</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start Time" type="datetime-local" value={openForm.start_time} onChange={e => setOpenForm(f => ({ ...f, start_time: e.target.value }))} />
            <Inp label="End Time" type="datetime-local" value={openForm.end_time} onChange={e => setOpenForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Inp label="Position" value={openForm.position} onChange={e => setOpenForm(f => ({ ...f, position: e.target.value }))} />
          <Inp label="Notes" value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setOpenShiftModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={createOpenShift} disabled={saving}>{saving ? 'Saving...' : 'Create Open Shift'}</Btn>
        </div>
      </Popup>
    </div>
  )
}
