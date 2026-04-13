import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import { addDays, format } from 'date-fns'
import { empName } from '../../lib/utils'
import { Card, Btn, Popup, Sel, Inp, Th, Td, C, EmptyState, Badge } from '../ui'
import type { Employee, Document } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Documents({ user, lang, employees }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [filterEmp, setFilterEmp] = useState(user.role === 'employee' ? user.id : '')
  const [filterType, setFilterType] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ employee_id: user.id, name: '', type: 'id', url: '', expiry_date: '' })
  const canEdit = user.role === 'admin' || user.role === 'manager'

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
    setModalOpen(false)
    setForm({ employee_id: user.id, name: '', type: 'id', url: '', expiry_date: '' })
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this document?')) return
    await supabase.from('documents').delete().eq('id', id)
    load()
  }

  function docStatus(expiry: string): 'valid' | 'expiringSoon' | 'expired' {
    if (!expiry) return 'valid'
    const d = new Date(expiry)
    const now = new Date()
    if (d < now) return 'expired'
    if (d < addDays(now, 30)) return 'expiringSoon'
    return 'valid'
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as any }}>
        {user.role !== 'employee' && (
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 200 }}>
            <option value="">{t(lang, 'all')} {t(lang, 'employees')}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
          </select>
        )}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 150 }}>
          <option value="">{t(lang, 'all')} Types</option>
          <option value="id">ID</option>
          <option value="contract">Contract</option>
          <option value="license">License</option>
          <option value="certificate">Certificate</option>
          <option value="other">Other</option>
        </select>
        {canEdit && (
          <Btn variant="primary" size="sm" style={{ marginLeft: 'auto' } as any} onClick={() => setModalOpen(true)}>
            ↑ {t(lang, 'upload')}
          </Btn>
        )}
      </div>

      <Card pad={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>{t(lang, 'employee')}</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>{t(lang, 'expiry')}</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => {
                const emp = employees.find(e => e.id === d.employee_id)
                const status = docStatus(d.expiry_date)
                return (
                  <tr key={d.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                    <Td>{empName(emp)}</Td>
                    <Td><div style={{ fontWeight: 600 }}>{d.name}</div></Td>
                    <Td style={{ textTransform: 'capitalize' as any }}>{d.type}</Td>
                    <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{d.expiry_date || '—'}</Td>
                    <Td>
                      <Badge color={status === 'valid' ? 'green' : status === 'expiringSoon' ? 'yellow' : 'red'}>
                        {t(lang, status)}
                      </Badge>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noopener noreferrer">
                            <Btn variant="secondary" size="sm">↓ View</Btn>
                          </a>
                        )}
                        {canEdit && <Btn variant="danger" size="sm" onClick={() => del(d.id)}>Delete</Btn>}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {docs.length === 0 && <EmptyState title={t(lang, 'noData')} />}
        </div>
      </Card>

      <Popup open={modalOpen} onClose={() => setModalOpen(false)} title={t(lang, 'upload')}>
        <div style={{ padding: '20px 24px' }}>
          {canEdit && (
            <Sel label={t(lang, 'employee')} value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
            </Sel>
          )}
          <Inp label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Sel label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="id">ID</option>
            <option value="contract">Contract</option>
            <option value="license">License</option>
            <option value="certificate">Certificate</option>
            <option value="other">Other</option>
          </Sel>
          <Inp label="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
          <Inp label={t(lang, 'expiry')} type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t(lang, 'save')}</Btn>
        </div>
      </Popup>
    </div>
  )
}
