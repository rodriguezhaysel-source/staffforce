import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { Modal } from './shared/Modal'
import { empName } from './shared/utils'
import type { Employee, ShiftSwap as SwapType, Shift } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function ShiftSwap({ user, lang, employees }: Props) {
  const [swaps, setSwaps] = useState<SwapType[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [targetShifts, setTargetShifts] = useState<Shift[]>([])
  const [form, setForm] = useState({ target_id: '', shift_id: '', target_shift_id: '', reason: '' })
  const canReview = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('shift_swaps').select('*').order('created_at' as any, { ascending: false })
    setSwaps(data || [])
  }

  async function openModal() {
    const { data } = await supabase.from('shifts').select('*').eq('employee_id', user.id).gte('start_time', new Date().toISOString())
    setMyShifts(data || [])
    setModalOpen(true)
  }

  async function loadTargetShifts(targetId: string) {
    const { data } = await supabase.from('shifts').select('*').eq('employee_id', targetId).gte('start_time', new Date().toISOString())
    setTargetShifts(data || [])
  }

  async function submit() {
    await supabase.from('shift_swaps').insert({ ...form, requester_id: user.id, status: 'pending' })
    setModalOpen(false); load()
  }

  async function review(id: string, status: string) {
    await supabase.from('shift_swaps').update({ status, approved_by: user.id }).eq('id', id); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={openModal}>{t(lang, 'requestSwap')}</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requester</th><th>With</th><th>My Shift</th><th>Their Shift</th>
                <th>{t(lang, 'reason')}</th><th>{t(lang, 'status')}</th>{canReview && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {swaps.map(s => (
                <tr key={s.id}>
                  <td>{empName(employees.find(e => e.id === s.requester_id))}</td>
                  <td>{empName(employees.find(e => e.id === s.target_id))}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.shift_id?.slice(0, 8)}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.target_shift_id?.slice(0, 8)}</td>
                  <td>{s.reason}</td>
                  <td><span className={`badge ${s.status === 'approved' ? 'badge-success' : s.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{s.status}</span></td>
                  {canReview && <td>{s.status === 'pending' && <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-success btn-sm" onClick={() => review(s.id, 'approved')}>{t(lang, 'approve')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => review(s.id, 'rejected')}>{t(lang, 'deny')}</button>
                  </div>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {swaps.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t(lang, 'requestSwap')}>
        <div className="modal-body">
          <div className="form-group">
            <label>{t(lang, 'targetEmployee')}</label>
            <select value={form.target_id} onChange={e => { setForm(f => ({ ...f, target_id: e.target.value })); loadTargetShifts(e.target.value) }}>
              <option value="">Select...</option>
              {employees.filter(e => e.id !== user.id && e.status === 'active').map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t(lang, 'myShift')}</label>
            <select value={form.shift_id} onChange={e => setForm(f => ({ ...f, shift_id: e.target.value }))}>
              <option value="">Select...</option>
              {myShifts.map(s => <option key={s.id} value={s.id}>{format(new Date(s.start_time), 'EEE MMM d HH:mm')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t(lang, 'theirShift')}</label>
            <select value={form.target_shift_id} onChange={e => setForm(f => ({ ...f, target_shift_id: e.target.value }))}>
              <option value="">Select...</option>
              {targetShifts.map(s => <option key={s.id} value={s.id}>{format(new Date(s.start_time), 'EEE MMM d HH:mm')}</option>)}
            </select>
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
