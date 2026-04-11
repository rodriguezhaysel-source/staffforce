import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { Icon } from './shared/Icons'
import { Modal } from './shared/Modal'
import { empName } from './shared/utils'
import type { Employee, Department, Location, Shift } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[] }

export default function Schedule({ user, lang, employees, departments, locations }: Props) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [filterDept, setFilterDept] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editShift, setEditShift] = useState<Partial<Shift>>({})
  const [isEdit, setIsEdit] = useState(false)
  const [copying, setCopying] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState('')
  const canEdit = user.role === 'admin' || user.role === 'manager'
  const isEmployee = user.role === 'employee'
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { load() }, [weekStart])

  async function load() {
    const start = format(weekStart, 'yyyy-MM-dd')
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd') + 'T23:59:59'
    const { data } = await supabase.from('shifts').select('*').gte('start_time', start).lte('start_time', end)
    setShifts(data || [])
  }

  function openAdd(empId = '', day = new Date()) {
    if (!canEdit) return
    const d = format(day, 'yyyy-MM-dd')
    setEditShift({
      employee_id: empId,
      start_time: d + 'T09:00',
      end_time: d + 'T17:00',
      status: 'draft',
      department_id: employees.find(e => e.id === empId)?.department_id || '',
    })
    setIsEdit(false)
    setModalOpen(true)
  }

  function openEdit(s: Shift) {
    if (!canEdit) return
    setEditShift({ ...s })
    setIsEdit(true)
    setModalOpen(true)
  }

  async function save() {
    if (!editShift.employee_id) { alert('Select an employee'); return }
    if (!editShift.start_time || !editShift.end_time) { alert('Set start and end time'); return }
    if (isEdit && editShift.id) {
      await supabase.from('shifts').update(editShift).eq('id', editShift.id)
    } else {
      await supabase.from('shifts').insert({ ...editShift, created_by: user.id, status: editShift.status || 'draft' })
    }
    setModalOpen(false)
    load()
  }

  async function del() {
    if (!editShift.id) return
    await supabase.from('shifts').delete().eq('id', editShift.id)
    setModalOpen(false)
    load()
  }

  async function publishWeek() {
    setPublishing(true)
    const draftIds = shifts.filter(s => s.status === 'draft').map(s => s.id)
    for (const id of draftIds) {
      await supabase.from('shifts').update({ status: 'scheduled' }).eq('id', id)
    }
    const empIds = [...new Set(shifts.filter(s => s.status === 'draft').map(s => s.employee_id))]
    for (const empId of empIds) {
      await supabase.from('notifications').insert({
        employee_id: empId,
        title: 'New Schedule Published',
        message: `Your schedule for the week of ${format(weekStart, 'MMM d')} has been published.`,
        type: 'info',
        read: false,
      })
    }
    setPublishing(false)
    setMsg('Week published!')
    setTimeout(() => setMsg(''), 3000)
    load()
  }

  async function copyFromPreviousWeek() {
    setCopying(true)
    const prevStart = format(subWeeks(weekStart, 1), 'yyyy-MM-dd')
    const prevEnd = format(addDays(subWeeks(weekStart, 1), 6), 'yyyy-MM-dd') + 'T23:59:59'
    const { data: prevShifts } = await supabase.from('shifts').select('*').gte('start_time', prevStart).lte('start_time', prevEnd)
    if (!prevShifts || prevShifts.length === 0) {
      setCopying(false)
      setMsg('No shifts found in previous week')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    for (const s of prevShifts) {
      const dayOffset = new Date(s.start_time).getDay()
      const newStart = addDays(weekStart, dayOffset === 0 ? 6 : dayOffset - 1)
      const startStr = format(newStart, 'yyyy-MM-dd') + s.start_time.slice(10)
      const endStr = format(newStart, 'yyyy-MM-dd') + s.end_time.slice(10)
      await supabase.from('shifts').insert({
        employee_id: s.employee_id,
        department_id: s.department_id,
        location_id: s.location_id,
        start_time: startStr,
        end_time: endStr,
        position: s.position,
        notes: s.notes,
        status: 'draft',
        created_by: user.id,
      })
    }
    setCopying(false)
    setMsg(`Copied ${prevShifts.length} shifts as drafts`)
    setTimeout(() => setMsg(''), 3000)
    load()
  }

  async function copyToNextWeek() {
    setCopying(true)
    const nextWeekStart = addWeeks(weekStart, 1)
    for (const s of shifts) {
      const dayOffset = new Date(s.start_time).getDay()
      const newStart = addDays(nextWeekStart, dayOffset === 0 ? 6 : dayOffset - 1)
      const startStr = format(newStart, 'yyyy-MM-dd') + s.start_time.slice(10)
      const endStr = format(newStart, 'yyyy-MM-dd') + s.end_time.slice(10)
      await supabase.from('shifts').insert({
        employee_id: s.employee_id,
        department_id: s.department_id,
        location_id: s.location_id,
        start_time: startStr,
        end_time: endStr,
        position: s.position,
        notes: s.notes,
        status: 'draft',
        created_by: user.id,
      })
    }
    setCopying(false)
    setMsg(`Copied ${shifts.length} shifts to next week as drafts`)
    setTimeout(() => setMsg(''), 3000)
  }

  const draftCount = shifts.filter(s => s.status === 'draft').length
  const publishedCount = shifts.filter(s => s.status === 'scheduled').length

  // EMPLOYEE VIEW — only their own shifts
  if (isEmployee) {
    const myShifts = shifts.filter(s => s.employee_id === user.id && s.status === 'scheduled')
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><Icon name="chevronLeft" size={14} />{t(lang, 'previousWeek')}</button>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>{t(lang, 'nextWeek')}<Icon name="chevronRight" size={14} /></button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {myShifts.length === 0 ? (
            <div className="empty-state"><div className="empty-state-title">No shifts this week</div><div className="empty-state-sub">Check back later when your schedule is published</div></div>
          ) : (
            <table>
              <thead><tr><th>Day</th><th>Date</th><th>Start</th><th>End</th><th>Position</th></tr></thead>
              <tbody>
                {myShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{format(new Date(s.start_time), 'EEE')}</td>
                    <td>{format(new Date(s.start_time), 'MMM d')}</td>
                    <td className="mono">{format(new Date(s.start_time), 'HH:mm')}</td>
                    <td className="mono">{format(new Date(s.end_time), 'HH:mm')}</td>
                    <td>{s.position || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ADMIN / MANAGER VIEW
  const filteredEmps = (filterDept ? employees.filter(e => e.department_id === filterDept) : employees).filter(e => e.status === 'active')

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><Icon name="chevronLeft" size={14} />{t(lang, 'previousWeek')}</button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>{t(lang, 'nextWeek')}<Icon name="chevronRight" size={14} /></button>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160 }}>
          <option value="">{t(lang, 'all')} Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={copyFromPreviousWeek} disabled={copying}>Copy Prev Week</button>
          <button className="btn btn-secondary btn-sm" onClick={copyToNextWeek} disabled={copying || shifts.length === 0}>Copy to Next Week</button>
          {draftCount > 0 && (
            <button className="btn btn-success btn-sm" onClick={publishWeek} disabled={publishing}>
              Publish Week ({draftCount} drafts)
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('', new Date())}><Icon name="plus" size={14} />{t(lang, 'addShift')}</button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#0A6EBD', opacity: 0.4, border: '2px dashed #0A6EBD' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>Draft ({draftCount})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#0A6EBD' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>Published ({publishedCount})</span>
        </div>
        {msg && <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{msg}</span>}
      </div>

      {/* Grid */}
      <div className="card" style={{ padding: 0 }}>
        <div className="schedule-grid">
          <table className="schedule-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t(lang, 'employee')}</th>
                {days.map(d => (
                  <th key={d.toISOString()}>
                    <div>{format(d, 'EEE')}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{format(d, 'd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmps.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)', fontSize: 13 }}>No active employees</td></tr>
              )}
              {filteredEmps.map(emp => {
                const dept = departments.find(dep => dep.id === emp.department_id)
                const avatarUrl = (emp as any).avatar_url
                return (
                  <tr key={emp.id}>
                    <td className="schedule-emp-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: dept?.color || 'var(--color-accent)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {avatarUrl
                            ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{emp.first_name?.[0]}{emp.last_name?.[0]}</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{emp.first_name} {emp.last_name?.[0]}.</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const dayShifts = shifts.filter(s =>
                        s.employee_id === emp.id &&
                        s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd')
                      )
                      return (
                        <td key={d.toISOString()}
                          onClick={() => dayShifts.length === 0 && openAdd(emp.id, d)}
                          style={{ cursor: canEdit && dayShifts.length === 0 ? 'pointer' : 'default', position: 'relative', minHeight: 52 }}
                        >
                          {canEdit && dayShifts.length === 0 && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', fontSize: 18, color: 'var(--color-accent)', pointerEvents: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.3')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>+</div>
                          )}
                          {dayShifts.map(s => {
                            const isDraft = s.status === 'draft'
                            return (
                              <div key={s.id}
                                className="schedule-shift"
                                style={{
                                  background: isDraft ? 'transparent' : (dept?.color || '#0A6EBD') + '22',
                                  color: dept?.color || '#0A6EBD',
                                  border: isDraft ? `2px dashed ${dept?.color || '#0A6EBD'}` : 'none',
                                  opacity: isDraft ? 0.7 : 1,
                                }}
                                onClick={e => { e.stopPropagation(); openEdit(s) }}
                              >
                                <div style={{ fontSize: 10, fontWeight: 700 }}>{format(new Date(s.start_time), 'HH:mm')}-{format(new Date(s.end_time), 'HH:mm')}</div>
                                {isDraft && <div style={{ fontSize: 9, opacity: 0.8 }}>DRAFT</div>}
                                {s.position && <div style={{ fontWeight: 400, fontSize: 9 }}>{s.position}</div>}
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

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? t(lang, 'editShift') : t(lang, 'addShift')}>
        <div className="modal-body">
          <div className="form-group">
            <label>{t(lang, 'employee')}</label>
            <select value={editShift.employee_id || ''} onChange={e => setEditShift(s => ({ ...s, employee_id: e.target.value }))}>
              <option value="">Select employee...</option>
              {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t(lang, 'department')}</label>
            <select value={editShift.department_id || ''} onChange={e => setEditShift(s => ({ ...s, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'startTime')}</label><input type="datetime-local" value={editShift.start_time || ''} onChange={e => setEditShift(s => ({ ...s, start_time: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'endTime')}</label><input type="datetime-local" value={editShift.end_time || ''} onChange={e => setEditShift(s => ({ ...s, end_time: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>{t(lang, 'position')}</label><input value={editShift.position || ''} onChange={e => setEditShift(s => ({ ...s, position: e.target.value }))} /></div>
          <div className="form-group"><label>{t(lang, 'notes')}</label><textarea value={editShift.notes || ''} onChange={e => setEditShift(s => ({ ...s, notes: e.target.value }))} /></div>
          <div className="form-group">
            <label>Status</label>
            <select value={editShift.status || 'draft'} onChange={e => setEditShift(s => ({ ...s, status: e.target.value }))}>
              <option value="draft">Draft (not visible to employee)</option>
              <option value="scheduled">Published (visible to employee)</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          {isEdit && <button className="btn btn-danger" onClick={del}>{t(lang, 'deleteShift')}</button>}
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t(lang, 'save')}</button>
        </div>
      </Modal>
    </div>
  )
}
