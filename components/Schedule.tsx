import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, startOfWeek, addDays } from 'date-fns'
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
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const canEdit = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [weekStart])

  async function load() {
    const start = format(weekStart, 'yyyy-MM-dd')
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd') + 'T23:59:59'
    const { data } = await supabase.from('shifts').select('*').gte('start_time', start).lte('start_time', end)
    setShifts(data || [])
  }

  function openAdd(empId: string, day: Date) {
    const d = format(day, 'yyyy-MM-dd')
    setEditShift({ employee_id: empId, start_time: d + 'T09:00', end_time: d + 'T17:00', status: 'scheduled', department_id: employees.find(e => e.id === empId)?.department_id || '' })
    setIsEdit(false); setModalOpen(true)
  }

  function openEdit(s: Shift) { setEditShift({ ...s }); setIsEdit(true); setModalOpen(true) }

  async function save() {
    if (isEdit && editShift.id) { await supabase.from('shifts').update(editShift).eq('id', editShift.id) }
    else { await supabase.from('shifts').insert({ ...editShift, created_by: user.id }) }
    setModalOpen(false); load()
  }

  async function del() {
    if (!editShift.id) return
    await supabase.from('shifts').delete().eq('id', editShift.id)
    setModalOpen(false); load()
  }

  const filteredEmps = (filterDept ? employees.filter(e => e.department_id === filterDept) : employees).filter(e => e.status === 'active')

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon name="chevronLeft" size={14} />{t(lang, 'previousWeek')}</button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>{t(lang, 'nextWeek')}<Icon name="chevronRight" size={14} /></button>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 180 }}>
          <option value="">{t(lang, 'all')} Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="schedule-grid">
          <table className="schedule-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t(lang, 'employee')}</th>
                {days.map(d => <th key={d.toISOString()}><div>{format(d, 'EEE')}</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{format(d, 'd')}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {filteredEmps.map(emp => (
                <tr key={emp.id}>
                  <td className="schedule-emp-col">
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{emp.position}</div>
                  </td>
                  {days.map(d => {
                    const dayShifts = shifts.filter(s => s.employee_id === emp.id && s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd'))
                    const dept = departments.find(dep => dep.id === emp.department_id)
                    return (
                      <td key={d.toISOString()} onClick={() => canEdit && dayShifts.length === 0 && openAdd(emp.id, d)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                        {dayShifts.map(s => (
                          <div key={s.id} className="schedule-shift" style={{ background: (dept?.color || '#0A6EBD') + '22', color: dept?.color || '#0A6EBD' }}
                            onClick={e => { e.stopPropagation(); canEdit && openEdit(s) }}>
                            {format(new Date(s.start_time), 'HH:mm')}-{format(new Date(s.end_time), 'HH:mm')}
                            {s.position && <div style={{ fontWeight: 400, fontSize: 10 }}>{s.position}</div>}
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? t(lang, 'editShift') : t(lang, 'addShift')}>
        <div className="modal-body">
          <div className="form-group">
            <label>{t(lang, 'employee')}</label>
            <select value={editShift.employee_id || ''} onChange={e => setEditShift(s => ({ ...s, employee_id: e.target.value }))}>
              <option value="">Select...</option>
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
