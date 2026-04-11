import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { Icon } from './shared/Icons'
import { Modal } from './shared/Modal'
import { empName, empInitials, entryHours, downloadBlob } from './shared/utils'
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

  async function approve(id: string) { await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', id); load() }
  async function reject(id: string) { await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id); load() }
  async function approveAll() {
    for (const e of entries.filter(e => e.status === 'pending')) {
      await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', e.id)
    }
    load()
  }
  async function saveEdit() {
    if (!editEntry) return
    await supabase.from('time_entries').update({ clock_in: editEntry.clock_in, clock_out: editEntry.clock_out, break_mins: editEntry.break_mins, notes: editEntry.notes }).eq('id', editEntry.id)
    setEditOpen(false); load()
  }

  function exportCsv() {
    const rows = [['Employee', 'Date', 'Clock In', 'Clock Out', 'Break', 'Hours', 'Status']]
    entries.forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      rows.push([empName(emp), e.clock_in?.slice(0, 10) || '', e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '', e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : '', String(e.break_mins || 0), entryHours(e).toFixed(2), e.status])
    })
    downloadBlob(rows.map(r => r.join(',')).join('\n'), 'timesheets.csv', 'text/csv')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {user.role !== 'employee' && (
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ width: 200 }}>
            <option value="">{t(lang, 'all')} {t(lang, 'employees')}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
          <option value="">{t(lang, 'all')} Status</option>
          <option value="pending">{t(lang, 'pending')}</option>
          <option value="approved">{t(lang, 'approved')}</option>
          <option value="rejected">{t(lang, 'rejected')}</option>
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 160 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canApprove && <button className="btn btn-success btn-sm" onClick={approveAll}>{t(lang, 'approveAll')}</button>}
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Icon name="download" size={13} />{t(lang, 'export')}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'employee')}</th><th>{t(lang, 'date')}</th><th>{t(lang, 'clockInTime')}</th>
                <th>{t(lang, 'clockOutTime')}</th><th>{t(lang, 'breakMins')}</th><th>{t(lang, 'hoursWorked')}</th>
                <th>{t(lang, 'status')}</th>{canApprove && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const emp = employees.find(em => em.id === e.employee_id)
                const hrs = entryHours(e)
                const isOt = hrs > 8
                return (
                  <tr key={e.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{empInitials(emp)}</div>{empName(emp)}</div></td>
                    <td>{e.clock_in?.slice(0, 10) || '-'}</td>
                    <td className="mono">{e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '-'}</td>
                    <td className="mono">{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : '-'}</td>
                    <td>{e.break_mins || 0}</td>
                    <td className="mono" style={{ color: isOt ? 'var(--color-warning)' : undefined, fontWeight: isOt ? 700 : undefined }}>{hrs.toFixed(2)}{isOt ? ' OT' : ''}</td>
                    <td><span className={`badge ${e.status === 'approved' ? 'badge-success' : e.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{t(lang, e.status)}</span></td>
                    {canApprove && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditEntry(e); setEditOpen(true) }}><Icon name="edit" size={12} /></button>
                          {e.status === 'pending' && <>
                            <button className="btn btn-success btn-sm" onClick={() => approve(e.id)}><Icon name="check" size={12} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => reject(e.id)}><Icon name="x" size={12} /></button>
                          </>}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {entries.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t(lang, 'edit')}>
        {editEntry && <>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group"><label>{t(lang, 'clockInTime')}</label><input type="datetime-local" value={editEntry.clock_in?.slice(0, 16) || ''} onChange={e => setEditEntry(en => en ? { ...en, clock_in: e.target.value } : en)} /></div>
              <div className="form-group"><label>{t(lang, 'clockOutTime')}</label><input type="datetime-local" value={editEntry.clock_out?.slice(0, 16) || ''} onChange={e => setEditEntry(en => en ? { ...en, clock_out: e.target.value } : en)} /></div>
            </div>
            <div className="form-group"><label>{t(lang, 'breakMins')}</label><input type="number" value={editEntry.break_mins || 0} onChange={e => setEditEntry(en => en ? { ...en, break_mins: Number(e.target.value) } : en)} /></div>
            <div className="form-group"><label>{t(lang, 'notes')}</label><textarea value={editEntry.notes || ''} onChange={e => setEditEntry(en => en ? { ...en, notes: e.target.value } : en)} /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>{t(lang, 'cancel')}</button>
            <button className="btn btn-primary" onClick={saveEdit}>{t(lang, 'save')}</button>
          </div>
        </>}
      </Modal>
    </div>
  )
}
