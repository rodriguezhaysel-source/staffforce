import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, parseISO, differenceInCalendarDays } from 'date-fns'
import { Modal } from './shared/Modal'
import { empName } from './shared/utils'
import type { Employee, TimeOff as TimeOffType } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function TimeOff({ user, lang, employees }: Props) {
  const [requests, setRequests] = useState<TimeOffType[]>([])
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ type: 'vacation', start_date: '', end_date: '', reason: '' })
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedStart, setSelectedStart] = useState<Date | null>(null)
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null)
  const [minDays, setMinDays] = useState(3)
  const [maxSimultaneous, setMaxSimultaneous] = useState(2)
  const [error, setError] = useState('')
  const canReview = user.role === 'admin' || user.role === 'manager'
  const myEmp = employees.find(e => e.id === user.id)

  useEffect(() => { load(); loadConfig() }, [view])

  async function load() {
    let q = supabase.from('time_off').select('*').order('created_at' as any, { ascending: false })
    if (view === 'mine') q = q.eq('employee_id', user.id)
    const { data } = await q
    setRequests(data || [])
  }

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('*').limit(1)
    if (data?.[0]?.timeoff_config) {
      setMinDays(data[0].timeoff_config.min_advance_days || 3)
      setMaxSimultaneous(data[0].timeoff_config.max_simultaneous || 2)
    }
  }

  const today = new Date()
  const minSelectableDate = form.type === 'sick' ? today : addDays(today, minDays)

  function getDayStatus(day: Date): 'blocked' | 'available' | 'selected' | 'approved' | 'pending' | 'weekend' {
    if (isWeekend(day)) return 'weekend'
    if (day < minSelectableDate && form.type !== 'sick') return 'blocked'
    if (selectedStart && selectedEnd) {
      if (day >= selectedStart && day <= selectedEnd) return 'selected'
    } else if (selectedStart && isSameDay(day, selectedStart)) return 'selected'
    const myApproved = requests.filter(r => r.employee_id === user.id && r.status === 'approved')
    if (myApproved.some(r => day >= parseISO(r.start_date) && day <= parseISO(r.end_date))) return 'approved'
    const myPending = requests.filter(r => r.employee_id === user.id && r.status === 'pending')
    if (myPending.some(r => day >= parseISO(r.start_date) && day <= parseISO(r.end_date))) return 'pending'
    return 'available'
  }

  function handleDayClick(day: Date) {
    const status = getDayStatus(day)
    if (status === 'blocked' || status === 'weekend') return
    if (!selectedStart || (selectedStart && selectedEnd)) {
      setSelectedStart(day); setSelectedEnd(null)
      setForm(f => ({ ...f, start_date: format(day, 'yyyy-MM-dd'), end_date: '' }))
    } else {
      if (day < selectedStart) { setSelectedStart(day); setForm(f => ({ ...f, start_date: format(day, 'yyyy-MM-dd') })) }
      else {
        setSelectedEnd(day)
        setForm(f => ({ ...f, end_date: format(day, 'yyyy-MM-dd') }))
      }
    }
  }

  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const firstDayOfWeek = startOfMonth(calMonth).getDay()
  const paddingDays = Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill(null)

  const selectedDays = selectedStart && selectedEnd
    ? differenceInCalendarDays(selectedEnd, selectedStart) + 1
    : selectedStart ? 1 : 0

  async function submit() {
    setError('')
    if (!form.start_date) { setError('Select a start date'); return }
    if (!form.end_date) setForm(f => ({ ...f, end_date: f.start_date }))
    const end = form.end_date || form.start_date
    const days = Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(form.start_date)) + 1)
    await supabase.from('time_off').insert({ ...form, end_date: end, employee_id: user.id, days, status: 'pending' })
    await supabase.from('notifications').insert({ employee_id: user.id, title: 'Time Off Submitted', message: `Your ${form.type} request for ${days} day(s) was submitted.`, type: 'info', read: false })
    setModalOpen(false)
    setSelectedStart(null); setSelectedEnd(null)
    setForm({ type: 'vacation', start_date: '', end_date: '', reason: '' })
    load()
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

  const dayColors: Record<string, string> = {
    blocked: '#F3F4F6',
    available: '#FFFFFF',
    selected: '#DBEAFE',
    approved: '#D1FAE5',
    pending: '#FEF3C7',
    weekend: '#F9FAFB',
  }
  const dayTextColors: Record<string, string> = {
    blocked: '#D1D5DB',
    available: '#111827',
    selected: '#1D4ED8',
    approved: '#059669',
    pending: '#D97706',
    weekend: '#9CA3AF',
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
                <th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Reason</th><th>Status</th>
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
                  {canReview && <td>{r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-sm" onClick={() => review(r.id, 'approved', r.employee_id, r.days, r.type)}>{t(lang, 'approve')}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => review(r.id, 'rejected', r.employee_id, r.days, r.type)}>{t(lang, 'deny')}</button>
                    </div>
                  )}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      {/* Request Modal with Smart Calendar */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setSelectedStart(null); setSelectedEnd(null) }} title={t(lang, 'requestTimeOff')} size="modal-lg">
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setSelectedStart(null); setSelectedEnd(null) }}>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick (no advance notice required)</option>
                <option value="personal">Personal</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          {/* Calendar Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', fontSize: 11 }}>
            {form.type !== 'sick' && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#F3F4F6', border: '1px solid #E5E7EB' }} /><span style={{ color: 'var(--color-text-secondary)' }}>Blocked ({minDays}d min)</span></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#DBEAFE' }} /><span style={{ color: 'var(--color-text-secondary)' }}>Selected</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#D1FAE5' }} /><span style={{ color: 'var(--color-text-secondary)' }}>Approved</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#FEF3C7' }} /><span style={{ color: 'var(--color-text-secondary)' }}>Pending</span></div>
          </div>

          {/* Calendar */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>Prev</button>
              <strong style={{ fontSize: 14 }}>{format(calMonth, 'MMMM yyyy')}</strong>
              <button className="btn btn-secondary btn-sm" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>Next</button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {paddingDays.map((_, i) => <div key={'pad-' + i} />)}
                {calDays.map(day => {
                  const status = getDayStatus(day)
                  const isToday = isSameDay(day, today)
                  return (
                    <div key={day.toISOString()} onClick={() => handleDayClick(day)}
                      style={{
                        textAlign: 'center', padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: dayColors[status], color: dayTextColors[status],
                        cursor: status === 'blocked' || status === 'weekend' ? 'not-allowed' : 'pointer',
                        border: isToday ? '2px solid var(--color-accent)' : '1px solid transparent',
                        transition: 'all 0.1s',
                      }}>
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Summary */}
          {selectedStart && (
            <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Selected range:</span>
                <strong>{format(selectedStart, 'MMM d')} {selectedEnd ? '- ' + format(selectedEnd, 'MMM d, yyyy') : ''}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Days requested:</span>
                <strong>{selectedDays} day(s)</strong>
              </div>
              {form.type === 'vacation' && (myEmp?.pto_balance || 0) < selectedDays && (
                <div style={{ marginTop: 8, color: 'var(--color-warning)', fontSize: 12 }}>
                  You have {myEmp?.pto_balance || 0} PTO days. This request will go unpaid for {selectedDays - (myEmp?.pto_balance || 0)} day(s).
                </div>
              )}
            </div>
          )}

          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
          {form.type !== 'sick' && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Requests must be submitted at least <strong>{minDays} days</strong> in advance. Sick leave can be submitted any time.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setModalOpen(false); setSelectedStart(null); setSelectedEnd(null) }}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={!selectedStart}>{t(lang, 'submit')}</button>
        </div>
      </Modal>
    </div>
  )
}
