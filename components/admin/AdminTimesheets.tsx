import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName, entryHours, downloadBlob } from '../../lib/utils'
import { ACard, ABtn, AModal, AInp, ASel, APageHeader, AStatusBadge, AEmpty, AAvatar, AC } from './ui'
import type { Employee, Department, TimeEntry } from '../../types'

interface Props { user: Employee; employees: Employee[]; departments: Department[] }

export default function AdminTimesheets({ user, employees, departments }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filterEmp, setFilterEmp] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [filterDept, setFilterDept] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => { load() }, [filterEmp, filterStatus, filterDept, filterDate])

  async function load() {
    let q = supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
    if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterDate) q = q.gte('clock_in', filterDate).lte('clock_in', filterDate + 'T23:59:59')
    const { data } = await q
    let rows: TimeEntry[] = data || []
    if (filterDept) {
      const deptEmps = employees.filter(e => e.department_id === filterDept).map(e => e.id)
      rows = rows.filter(r => deptEmps.includes(r.employee_id))
    }
    setEntries(rows)
  }

  async function approve(id: string) {
    await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', id); load()
  }
  async function reject(id: string) {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id); load()
  }
  async function approveAll() {
    const pending = entries.filter(e => e.status === 'pending')
    await Promise.all(pending.map(e => supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', e.id)))
    load()
  }
  async function saveEdit() {
    if (!editEntry) return
    await supabase.from('time_entries').update({ clock_in: editEntry.clock_in, clock_out: editEntry.clock_out, break_mins: editEntry.break_mins, notes: editEntry.notes }).eq('id', editEntry.id)
    setEditOpen(false); load()
  }
  function exportCSV() {
    const rows = [['Employee', 'Dept', 'Date', 'Clock In', 'Clock Out', 'Break', 'Hours', 'Status']]
    entries.forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      const dept = departments.find(d => d.id === emp?.department_id)
      rows.push([empName(emp), dept?.name || '', e.clock_in?.slice(0, 10) || '', e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '', e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : '', String(e.break_mins || 0) + 'm', entryHours(e).toFixed(2), e.status])
    })
    downloadBlob(rows.map(r => r.join(',')).join('\n'), 'timesheets.csv', 'text/csv')
  }

  const pending = entries.filter(e => e.status === 'pending').length
  const totalHours = entries.reduce((s, e) => s + entryHours(e), 0)

  return (
    <div>
      <APageHeader title="Timesheets" sub="Review and approve employee time entries">
        <div style={{ display: 'flex', gap: 8 }}>
          {pending > 0 && <ABtn variant="success" size="sm" onClick={approveAll}>✓ Approve All ({pending})</ABtn>}
          <ABtn variant="secondary" size="sm" onClick={exportCSV}>↓ CSV</ABtn>
        </div>
      </APageHeader>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Entries', value: entries.length, color: AC.accent },
          { label: 'Total Hours', value: totalHours.toFixed(1) + 'h', color: AC.accent },
          { label: 'Pending', value: pending, color: pending > 0 ? AC.warning : AC.success },
          { label: 'Approved', value: entries.filter(e => e.status === 'approved').length, color: AC.success },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color, fontFamily: 'IBM Plex Mono, monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <ACard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as any, alignItems: 'flex-end' }}>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 200 }}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 160 }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <ABtn variant="secondary" size="sm" onClick={() => { setFilterEmp(''); setFilterStatus('pending'); setFilterDept(''); setFilterDate('') }}>Clear</ABtn>
        </div>
      </ACard>

      {/* Table */}
      <ACard pad={0}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-th">Employee</th>
                <th className="adm-th">Dept</th>
                <th className="adm-th">Date</th>
                <th className="adm-th">Clock In</th>
                <th className="adm-th">Clock Out</th>
                <th className="adm-th">Break</th>
                <th className="adm-th">Hours</th>
                <th className="adm-th">Status</th>
                <th className="adm-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const emp = employees.find(em => em.id === e.employee_id)
                const dept = departments.find(d => d.id === emp?.department_id)
                const hrs = entryHours(e)
                const isOT = hrs > 8
                return (
                  <tr key={e.id} className="adm-tr">
                    <td className="adm-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AAvatar emp={emp} size={28} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{empName(emp)}</div>
                          <div style={{ fontSize: 11, color: AC.sub }}>{emp?.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="adm-td" style={{ fontSize: 12, color: AC.sub }}>{dept?.name || '—'}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{e.clock_in?.slice(0, 10) || '—'}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '—'}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : <span style={{ color: AC.success, fontWeight: 700 }}>Active</span>}</td>
                    <td className="adm-td">{e.break_mins || 0}m</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: isOT ? AC.warning : AC.text }}>{hrs.toFixed(2)}{isOT ? ' OT' : ''}</td>
                    <td className="adm-td"><AStatusBadge status={e.status} /></td>
                    <td className="adm-td">
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ABtn variant="secondary" size="sm" onClick={() => { setEditEntry(e); setEditOpen(true) }}>Edit</ABtn>
                        {e.status === 'pending' && <>
                          <ABtn variant="success" size="sm" onClick={() => approve(e.id)}>✓</ABtn>
                          <ABtn variant="danger" size="sm" onClick={() => reject(e.id)}>✗</ABtn>
                        </>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {entries.length === 0 && <AEmpty title="No entries found" sub="Adjust filters to see entries" />}
        </div>
      </ACard>

      {/* Edit modal */}
      {editEntry && (
        <AModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Time Entry">
          <div className="adm-modal-body">
            <div className="adm-input-row">
              <AInp label="Clock In" type="datetime-local" value={editEntry.clock_in?.slice(0, 16) || ''} onChange={e => setEditEntry(en => en ? { ...en, clock_in: e.target.value } : en)} />
              <AInp label="Clock Out" type="datetime-local" value={editEntry.clock_out?.slice(0, 16) || ''} onChange={e => setEditEntry(en => en ? { ...en, clock_out: e.target.value } : en)} />
            </div>
            <AInp label="Break (minutes)" type="number" value={editEntry.break_mins || 0} onChange={e => setEditEntry(en => en ? { ...en, break_mins: Number(e.target.value) } : en)} />
            <AInp label="Notes" value={editEntry.notes || ''} onChange={e => setEditEntry(en => en ? { ...en, notes: e.target.value } : en)} rows={2} />
          </div>
          <div className="adm-modal-footer">
            <ABtn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</ABtn>
            <ABtn variant="primary" onClick={saveEdit}>Save</ABtn>
          </div>
        </AModal>
      )}
    </div>
  )
}
