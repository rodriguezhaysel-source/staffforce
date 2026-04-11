import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { addDays, format } from 'date-fns'
import { Icon } from './shared/Icons'
import { Modal } from './shared/Modal'
import { empName } from './shared/utils'
import type { Employee, Document } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Documents({ user, lang, employees }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [filterEmp, setFilterEmp] = useState(user.role === 'employee' ? user.id : '')
  const [filterType, setFilterType] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ employee_id: user.id, name: '', type: 'id', url: '', expiry_date: '' })

  useEffect(() => { load() }, [filterEmp, filterType])

  async function load() {
    let q = supabase.from('documents').select('*').order('expiry_date', { ascending: true })
    if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterType) q = q.eq('type', filterType)
    const { data } = await q
    setDocs(data || [])
  }

  async function save() {
    await supabase.from('documents').insert(form)
    setModalOpen(false); setForm({ employee_id: user.id, name: '', type: 'id', url: '', expiry_date: '' }); load()
  }

  async function del(id: string) {
    await supabase.from('documents').delete().eq('id', id); load()
  }

  function docStatus(expiry: string): 'valid' | 'expiringSoon' | 'expired' {
    if (!expiry) return 'valid'
    const d = new Date(expiry)
    const now = new Date()
    if (d < now) return 'expired'
    if (d < addDays(now, 30)) return 'expiringSoon'
    return 'valid'
  }

  const canEdit = user.role === 'admin' || user.role === 'manager'

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {user.role !== 'employee' && (
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ width: 200 }}>
            <option value="">{t(lang, 'all')} {t(lang, 'employees')}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
          </select>
        )}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 150 }}>
          <option value="">{t(lang, 'all')} Types</option>
          <option value="id">ID</option><option value="contract">Contract</option>
          <option value="license">License</option><option value="certificate">Certificate</option><option value="other">Other</option>
        </select>
        {canEdit && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModalOpen(true)}><Icon name="upload" size={13} />{t(lang, 'upload')}</button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t(lang, 'employee')}</th><th>Name</th><th>Type</th>
              <th>{t(lang, 'expiry')}</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {docs.map(d => {
                const emp = employees.find(e => e.id === d.employee_id)
                const status = docStatus(d.expiry_date)
                return (
                  <tr key={d.id}>
                    <td>{empName(emp)}</td>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{d.type}</td>
                    <td>{d.expiry_date || '-'}</td>
                    <td>
                      <span className={`badge ${status === 'valid' ? 'badge-success' : status === 'expiringSoon' ? 'badge-warning' : 'badge-danger'}`}>
                        {t(lang, status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Icon name="download" size={12} /></a>}
                        {canEdit && <button className="btn btn-danger btn-sm" onClick={() => del(d.id)}><Icon name="trash" size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {docs.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t(lang, 'upload')}>
        <div className="modal-body">
          {canEdit && (
            <div className="form-group">
              <label>{t(lang, 'employee')}</label>
              <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
                {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
              </select>
            </div>
          )}
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="id">ID</option><option value="contract">Contract</option>
              <option value="license">License</option><option value="certificate">Certificate</option><option value="other">Other</option>
            </select>
          </div>
          <div className="form-group"><label>URL</label><input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></div>
          <div className="form-group"><label>{t(lang, 'expiry')}</label><input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t(lang, 'save')}</button>
        </div>
      </Modal>
    </div>
  )
}
