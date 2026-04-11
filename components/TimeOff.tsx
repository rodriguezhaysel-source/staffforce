import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { parseISO } from 'date-fns'
import { Modal } from './shared/Modal'
import { empName } from './shared/utils'
import type { Employee, TimeOff as TimeOffType } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function TimeOff({ user, lang, employees }: Props) {
  const [requests, setRequests] = useState<TimeOffType[]>([])
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ type: 'vacation', start_date: '', end_date: '', reason: '' })
  const canReview = user.role === 'admin' || user.role === 'manager'
  const myEmp = employees.find(e => e.id === user.id)

  useEffect(() => { load() }, [view])

  async function load() {
    let q = supabase.from('time_off').select('*').order('created_at' as any, { ascending: false })
    if (view === 'mine') q = q.eq('employee_id', user.id)
    const { data } = await q
    setRequests(data || [])
  }

  async function submit() {
    if (!form.start_date || !form.end_date) return
    const days = Math.max(1, Math.round((parseISO(form.end_date).getTime() - parseISO(form.start_date).getTime()) / 86400000) + 1)
    await supabase.from('time_off').insert({ ...form, employee_id: user.id, days, status: 'pending' })
    await supabase.from('notifications').insert({ employee_id: user.id, title: 'Time Off Submitted', message: `Your ${form.type} request for ${days} day(s) was submitted.`, type: 'info', read: false })
    setModalOpen(false); setForm({ type: 'vacation', start_date: '', end_date: '', reason: '' }); load()
  }

  async function review(id: string, status: string, empId: string, days: number, type: string) {
    await supabase.from('time_off').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (status === 'approved' && type === 'vacation') {
      const emp = employees.find(e => e.id === empId)
      if (emp) await supabase.from('employees').update({ pto_balance: Math.max(0, (emp.pto_balance || 0) - days) }).eq('id', empId)
    }
    await supabase.from('notifications').insert({ employee_id: empId, title: 'Time Off ' + (status === 'approved' ? 'Approved' : 'Denied'), message: `Your time off request has been ${status}.`, type: status === 'approved' ? 'success' : 'error', read: false })
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${view === 'mine' ? 'active' : ''}`} onClick={() => setView('mine')}>{t(lang, 'myRequests')}</button>
          {canReview && <button className={`tab ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>{t(lang, 'allRequests')}</button>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13 }}>{t(lang, 'ptoBalance')}: <strong className="mono">{myEmp?.pto_balance || 0} {t(lang, 'days')}</strong></div>
          <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>{t(lang, 'requestTimeOff')}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {view === 'all' && <th>{t(lang, 'employee')}</th>}
                <th>{t(lang, 'type')}</th><th>{t(lang, 'startDate')}</th><th>{t(lang, 'endDate')}</th>
                <th>{t(lang, 'days')}</th><th>{t(lang, 'reason')}</th><th>{t(lang, 'status')}</th>
                {canReview && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  {view === 'all' && <td>{empName(employees.find(e => e.id === r.employee_id))}</td>}
                  <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{r.type}</span></td>
                  <td>{r.start_date}</td><td>{r.end_date}</td><td>{r.days}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                  <td><span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                  {canReview && (
                    <td>
                      {r.status === 'pending' && <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm" onClick={() => review(r.id, 'approved', r.employee_id, r.days, r.type)}>{t(lang, 'approve')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => review(r.id, 'rejected', r.employee_id, r.days, r.type)}>{t(lang, 'deny')}</button>
                      </div>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t(lang, 'requestTimeOff')}>
        <div className="modal-body">
          <div className="form-group">
            <label>{t(lang, 'type')}</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="vacation">{t(lang, 'vacation')}</option>
              <option value="sick">{t(lang, 'sick')}</option>
              <option value="personal">{t(lang, 'personal')}</option>
              <option value="unpaid">{t(lang, 'unpaid')}</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'startDate')}</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'endDate')}</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>{t(lang, 'reason')}</label><textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={submit}>{t(lang, 'submit')}</button>
        </div>
      </Modal>
    </div>
  )
}
