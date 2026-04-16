import React, { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName, fmtMoney, entryHours } from '../../lib/utils'
import { ACard, ABtn, AModal, AInp, ASel, APageHeader, AStatusBadge, AEmpty, AAvatar, AToggle, AC, ABadge } from './ui'
import type { Employee, Department, Location } from '../../types'

interface Props { user: Employee; employees: Employee[]; departments: Department[]; locations: Location[]; setEmployees: (e: Employee[]) => void }

const TABS = ['Profile', 'Pay & HR', 'Banking', 'Certifications', 'Onboarding', 'Notes']

export default function AdminEmployees({ user, employees, departments, locations, setEmployees }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterDept, setFilterDept] = useState('')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [tab, setTab] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editData, setEditData] = useState<Partial<Employee>>({})
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const filtered = employees.filter(e => {
    if (search && !empName(e).toLowerCase().includes(search.toLowerCase()) && !e.email?.includes(search.toLowerCase())) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterDept && e.department_id !== filterDept) return false
    return true
  })

  async function openDetail(emp: Employee) {
    setSelected(emp); setEditData({ ...emp }); setTab(0); setDetailOpen(true); setInviteStatus('')
  }

  async function saveEmp() {
    if (!selected) return
    await supabase.from('employees').update(editData).eq('id', selected.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setDetailOpen(false)
  }

  async function addEmployee() {
    if (!newEmp.first_name || !newEmp.last_name || !newEmp.email) { alert('Name and email required'); return }
    const { data, error } = await supabase.from('employees').insert({ ...newEmp, status: 'pending_activation', password_hash: Math.random().toString(36).slice(2, 10) }).select('*')
    if (error) { alert(error.message); return }
    const { data: all } = await supabase.from('employees').select('*')
    setEmployees(all || [])
    if (data?.[0]) sendInvite(data[0].id)
    setAddOpen(false)
    setNewEmp({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  }

  async function sendInvite(empId: string) {
    setInviteSending(true); setInviteStatus('')
    const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId, base_url: window.location.origin }) })
    const data = await res.json()
    setInviteSending(false)
    setInviteStatus(data.success ? '✓ Invitation sent!' : '✗ ' + data.error)
    setTimeout(() => setInviteStatus(''), 4000)
  }

  async function uploadPhoto(file: File) {
    if (!selected) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${selected.id}.${ext}`
    await supabase.storage.from('staffforce').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('staffforce').getPublicUrl(path)
    setEditData(d => ({ ...d, avatar_url: publicUrl }))
    await supabase.from('employees').update({ avatar_url: publicUrl }).eq('id', selected.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  async function terminate() {
    if (!selected || !confirm(`Terminate ${empName(selected)}?`)) return
    await supabase.from('employees').update({ status: 'inactive' }).eq('id', selected.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setDetailOpen(false)
  }

  return (
    <div>
      <APageHeader title="Employees" sub={`${employees.filter(e => e.status === 'active').length} active employees`}>
        <ABtn variant="primary" size="sm" onClick={() => setAddOpen(true)}>+ Add Employee</ABtn>
      </APageHeader>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total', val: employees.length, color: AC.accent },
          { label: 'Active', val: employees.filter(e => e.status === 'active').length, color: AC.success },
          { label: 'Inactive', val: employees.filter(e => e.status === 'inactive').length, color: AC.muted },
          { label: 'Pending', val: employees.filter(e => e.status === 'pending_activation').length, color: AC.warning },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${AC.border}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: 'IBM Plex Mono, monospace', marginTop: 6 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as any }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..." style={{ width: '100%', padding: '9px 12px 9px 36px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: AC.muted }}>🔍</span>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 12px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending_activation">Pending</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '9px 12px', border: `1.5px solid ${AC.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <ACard pad={0}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-th">Employee</th>
                <th className="adm-th">Department</th>
                <th className="adm-th">Position</th>
                <th className="adm-th">Type</th>
                <th className="adm-th">Rate</th>
                <th className="adm-th">Status</th>
                <th className="adm-th">Hire Date</th>
                <th className="adm-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const dept = departments.find(d => d.id === emp.department_id)
                return (
                  <tr key={emp.id} className="adm-tr" style={{ cursor: 'pointer' }} onClick={() => openDetail(emp)}>
                    <td className="adm-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AAvatar emp={emp} size={32} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{empName(emp)}</div>
                          <div style={{ fontSize: 11, color: AC.sub }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="adm-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {dept && <div style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color || AC.accent }} />}
                        {dept?.name || '—'}
                      </div>
                    </td>
                    <td className="adm-td">{emp.position || '—'}</td>
                    <td className="adm-td"><ABadge color="gray">{emp.employment_type}</ABadge></td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{emp.hourly_rate ? '$' + emp.hourly_rate + '/hr' : emp.salary_annual ? '$' + (emp.salary_annual / 1000).toFixed(0) + 'k/yr' : '—'}</td>
                    <td className="adm-td"><AStatusBadge status={emp.status} /></td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{emp.hire_date || '—'}</td>
                    <td className="adm-td">
                      <ABtn variant="secondary" size="sm" onClick={() => openDetail(emp)}>View</ABtn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <AEmpty title="No employees found" />}
        </div>
      </ACard>

      {/* Detail modal */}
      {selected && (
        <AModal open={detailOpen} onClose={() => setDetailOpen(false)} title={`${selected.first_name} ${selected.last_name}`} wide>
          <div className="adm-tabs" style={{ margin: '0 0 0 0', padding: '0 24px', borderBottom: `1px solid ${AC.border}` }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} className={`adm-tab${tab === i ? ' active' : ''}`}>{t}</button>
            ))}
          </div>
          <div className="adm-modal-body">
            {tab === 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
                    <AAvatar emp={{ ...selected, ...editData }} size={60} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: AC.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff' }}>+</div>
                  </div>
                  <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.first_name} {selected.last_name}</div>
                    <AStatusBadge status={selected.status} />
                    {inviteStatus && <div style={{ fontSize: 12, color: inviteStatus.startsWith('✓') ? AC.success : AC.danger, marginTop: 4 }}>{inviteStatus}</div>}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <ABtn variant="ghost" size="sm" onClick={() => sendInvite(selected.id)} disabled={inviteSending}>
                      {inviteSending ? 'Sending...' : '📧 Resend Invite'}
                    </ABtn>
                  </div>
                </div>
                <div className="adm-input-row">
                  <AInp label="First Name" value={editData.first_name || ''} onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))} />
                  <AInp label="Last Name" value={editData.last_name || ''} onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))} />
                </div>
                <div className="adm-input-row">
                  <AInp label="Email" type="email" value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} />
                  <AInp label="Phone" value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} />
                </div>
                <div className="adm-input-row">
                  <AInp label="Position" value={editData.position || ''} onChange={e => setEditData(d => ({ ...d, position: e.target.value }))} />
                  <AInp label="Hire Date" type="date" value={editData.hire_date || ''} onChange={e => setEditData(d => ({ ...d, hire_date: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <ASel label="Department" value={editData.department_id || ''} onChange={e => setEditData(d => ({ ...d, department_id: e.target.value }))}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </ASel>
                  <ASel label="Role" value={editData.role || 'employee'} onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </ASel>
                  <ASel label="Status" value={editData.status || 'active'} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending_activation">Pending</option>
                  </ASel>
                </div>
                <AToggle value={!!editData.geo_exempt} onChange={v => setEditData(d => ({ ...d, geo_exempt: v }))} label="Geofence Exempt" />
              </div>
            )}
            {tab === 1 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <ASel label="Employment Type" value={editData.employment_type || 'fulltime'} onChange={e => setEditData(d => ({ ...d, employment_type: e.target.value }))}>
                    <option value="fulltime">Full-time</option>
                    <option value="parttime">Part-time</option>
                    <option value="contract">Contract</option>
                  </ASel>
                  <AInp label="Hourly Rate ($)" type="number" value={editData.hourly_rate || 0} onChange={e => setEditData(d => ({ ...d, hourly_rate: Number(e.target.value) }))} />
                  <AInp label="Annual Salary ($)" type="number" value={editData.salary_annual || 0} onChange={e => setEditData(d => ({ ...d, salary_annual: Number(e.target.value) }))} />
                  <AInp label="PTO Balance (days)" type="number" value={editData.pto_balance || 0} onChange={e => setEditData(d => ({ ...d, pto_balance: Number(e.target.value) }))} />
                  <AInp label="PTO Accrual Rate" type="number" value={editData.pto_accrual_rate || 0} onChange={e => setEditData(d => ({ ...d, pto_accrual_rate: Number(e.target.value) }))} />
                  <ASel label="Language" value={editData.language || 'en'} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </ASel>
                </div>
              </div>
            )}
            {tab === 2 && (
              <div>
                <div style={{ marginBottom: 16, padding: '12px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}>
                  Legacy bank info stored directly on the employee record.
                </div>
                <div className="adm-input-row">
                  <AInp label="Bank Name" value={editData.bank_name || ''} onChange={e => setEditData(d => ({ ...d, bank_name: e.target.value }))} />
                  <ASel label="Account Type" value={editData.bank_account_type || 'checking'} onChange={e => setEditData(d => ({ ...d, bank_account_type: e.target.value }))}>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </ASel>
                </div>
                <div className="adm-input-row">
                  <AInp label="Routing Number" value={editData.bank_routing || ''} onChange={e => setEditData(d => ({ ...d, bank_routing: e.target.value }))} />
                  <AInp label="Account Number" value={editData.bank_account || ''} onChange={e => setEditData(d => ({ ...d, bank_account: e.target.value }))} />
                </div>
              </div>
            )}
            {tab === 5 && (
              <AInp label="Internal Notes (not visible to employee)" value={editData.internal_notes || ''} onChange={e => setEditData(d => ({ ...d, internal_notes: e.target.value }))} rows={8} />
            )}
            {(tab === 3 || tab === 4) && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: AC.muted, fontSize: 13 }}>
                Manage certifications and onboarding tasks in the Employee Portal → Employees section.
              </div>
            )}
          </div>
          <div className="adm-modal-footer" style={{ justifyContent: 'space-between' }}>
            {selected.status === 'active' && <ABtn variant="danger" size="sm" onClick={terminate}>Terminate</ABtn>}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <ABtn variant="secondary" onClick={() => setDetailOpen(false)}>Close</ABtn>
              <ABtn variant="primary" onClick={saveEmp}>Save Changes</ABtn>
            </div>
          </div>
        </AModal>
      )}

      {/* Add employee modal */}
      <AModal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Employee">
        <div className="adm-modal-body">
          <div className="adm-input-row">
            <AInp label="First Name" value={newEmp.first_name || ''} onChange={e => setNewEmp(n => ({ ...n, first_name: e.target.value }))} required />
            <AInp label="Last Name" value={newEmp.last_name || ''} onChange={e => setNewEmp(n => ({ ...n, last_name: e.target.value }))} required />
          </div>
          <AInp label="Email" type="email" value={newEmp.email || ''} onChange={e => setNewEmp(n => ({ ...n, email: e.target.value }))} required />
          <AInp label="Phone" value={newEmp.phone || ''} onChange={e => setNewEmp(n => ({ ...n, phone: e.target.value }))} />
          <AInp label="Position" value={newEmp.position || ''} onChange={e => setNewEmp(n => ({ ...n, position: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ASel label="Department" value={newEmp.department_id || ''} onChange={e => setNewEmp(n => ({ ...n, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </ASel>
            <ASel label="Role" value={newEmp.role || 'employee'} onChange={e => setNewEmp(n => ({ ...n, role: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </ASel>
            <ASel label="Employment Type" value={newEmp.employment_type || 'fulltime'} onChange={e => setNewEmp(n => ({ ...n, employment_type: e.target.value }))}>
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
              <option value="contract">Contract</option>
            </ASel>
            <AInp label="Hourly Rate ($)" type="number" value={newEmp.hourly_rate || 0} onChange={e => setNewEmp(n => ({ ...n, hourly_rate: Number(e.target.value) }))} />
          </div>
          <div style={{ padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
            📧 Invitation email will be sent automatically to set up their password.
          </div>
        </div>
        <div className="adm-modal-footer">
          <ABtn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</ABtn>
          <ABtn variant="primary" onClick={addEmployee}>Add & Send Invite</ABtn>
        </div>
      </AModal>
    </div>
  )
}
