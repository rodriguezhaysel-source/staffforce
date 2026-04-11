import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { Modal } from './shared/Modal'
import { Stars } from './shared/Stars'
import { empName, empInitials, fmtMoney, entryHours } from './shared/utils'
import { Icon } from './shared/Icons'
import type { Employee, Department, Location, TimeEntry, PayrollEntry, Performance } from '../lib/store'
import type { EmployeeBankAccount } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[]; setEmployees: (e: Employee[]) => void }

function EmployeeCard({ emp, dept }: { emp: Employee; dept?: Department }) {
  const avatarUrl = (emp as any).avatar_url
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarUrl ? 'transparent' : (dept?.color || 'var(--primary)'), overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)' }}>
        {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{empInitials(emp)}</span>}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.first_name} {emp.last_name?.[0]}.</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{emp.position}</div>
      </div>
    </div>
  )
}

export default function Employees({ user, lang, employees, departments, locations, setEmployees }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterDept, setFilterDept] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [tab, setTab] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [empEntries, setEmpEntries] = useState<TimeEntry[]>([])
  const [empPayroll, setEmpPayroll] = useState<PayrollEntry[]>([])
  const [empPerf, setEmpPerf] = useState<Performance[]>([])
  const [bankAccounts, setBankAccounts] = useState<EmployeeBankAccount[]>([])
  const [editData, setEditData] = useState<Partial<Employee>>({})
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  const [addPerfOpen, setAddPerfOpen] = useState(false)
  const [newPerf, setNewPerf] = useState({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
  const [newBank, setNewBank] = useState<Partial<EmployeeBankAccount>>({ allocation_type: 'remainder', allocation_value: 0, priority: 1, account_type: 'checking' })
  const [addBankOpen, setAddBankOpen] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [exitSurveyOpen, setExitSurveyOpen] = useState(false)
  const [exitSurvey, setExitSurvey] = useState({ reason: '', would_return: true, rating: 3, feedback: '' })
  const photoRef = useRef<HTMLInputElement>(null)
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const filtered = employees.filter(e => {
    if (search && !empName(e).toLowerCase().includes(search.toLowerCase()) && !e.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterDept && e.department_id !== filterDept) return false
    return true
  })

  async function openEmp(emp: Employee) {
    setSelectedEmp(emp); setEditData({ ...emp }); setTab(0); setModalOpen(true); setInviteMsg('')
    const [te, pe, pf, ba] = await Promise.all([
      supabase.from('time_entries').select('*').eq('employee_id', emp.id).order('clock_in', { ascending: false }).limit(30),
      supabase.from('payroll_entries').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
      supabase.from('performance').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
      supabase.from('employee_bank_accounts').select('*').eq('employee_id', emp.id).order('priority'),
    ])
    setEmpEntries(te.data || []); setEmpPayroll(pe.data || []); setEmpPerf(pf.data || []); setBankAccounts(ba.data || [])
  }

  async function saveEmp() {
    if (!selectedEmp) return
    await supabase.from('employees').update(editData).eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setModalOpen(false)
  }

  async function addEmployee() {
    if (!newEmp.first_name || !newEmp.last_name || !newEmp.email) { alert('First name, last name and email are required'); return }
    const { data, error } = await supabase.from('employees').insert({ ...newEmp, status: 'pending_activation' }).select('*')
    if (error) { alert(error.message); return }
    const { data: all } = await supabase.from('employees').select('*')
    setEmployees(all || [])
    if (data?.[0]) {
      await sendInvite(data[0].id, data[0])
    }
    setAddOpen(false)
    setNewEmp({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  }

  async function sendInvite(empId: string, emp?: any) {
    setInviteSending(true); setInviteMsg('')
    const baseUrl = window.location.origin
    const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId, base_url: baseUrl }) })
    const data = await res.json()
    setInviteSending(false)
    setInviteMsg(data.success ? 'Invitation sent!' : 'Error: ' + data.error)
    setTimeout(() => setInviteMsg(''), 4000)
  }

  async function deleteEmp() {
    if (!selectedEmp || !confirm('Delete this employee?')) return
    if (selectedEmp.status === 'active') {
      setExitSurveyOpen(true); return
    }
    await supabase.from('employees').delete().eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setModalOpen(false)
  }

  async function deactivateWithSurvey() {
    if (!selectedEmp) return
    await supabase.from('employees').update({ status: 'inactive' }).eq('id', selectedEmp.id)
    await supabase.from('exit_surveys').insert({ ...exitSurvey, employee_id: selectedEmp.id })
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setExitSurveyOpen(false); setModalOpen(false)
  }

  async function addPerfReview() {
    if (!selectedEmp) return
    await supabase.from('performance').insert({ ...newPerf, employee_id: selectedEmp.id, reviewer_id: user.id })
    const { data } = await supabase.from('performance').select('*').eq('employee_id', selectedEmp.id)
    setEmpPerf(data || []); setAddPerfOpen(false)
    setNewPerf({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
  }

  async function addBankAccount() {
    if (!selectedEmp) return
    await supabase.from('employee_bank_accounts').insert({ ...newBank, employee_id: selectedEmp.id, status: 'pending' })
    const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp.id).order('priority')
    setBankAccounts(data || []); setAddBankOpen(false)
    setNewBank({ allocation_type: 'remainder', allocation_value: 0, priority: 1, account_type: 'checking' })
  }

  async function approveBankAccount(id: string) {
    await supabase.from('employee_bank_accounts').update({ status: 'approved', approved_by: user.id }).eq('id', id)
    if (selectedEmp) {
      const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp.id).order('priority')
      setBankAccounts(data || [])
    }
  }

  async function deleteBankAccount(id: string) {
    await supabase.from('employee_bank_accounts').delete().eq('id', id)
    if (selectedEmp) {
      const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp.id).order('priority')
      setBankAccounts(data || [])
    }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedEmp || !e.target.files?.[0]) return
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()
    const path = `avatars/${selectedEmp.id}.${ext}`
    await supabase.storage.from('staffforce').upload(path, file, { upsert: true })
    const { data: urlData } = supabase.storage.from('staffforce').getPublicUrl(path)
    await supabase.from('employees').update({ avatar_url: urlData.publicUrl }).eq('id', selectedEmp.id)
    setEditData(d => ({ ...d, avatar_url: urlData.publicUrl } as any))
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  const TABS = ['Personal', 'Bank Accounts', 'Time & Attendance', 'Payroll History', 'Performance', 'Notes']
  const profileProgress = selectedEmp ? [
    !!(selectedEmp as any).avatar_url,
    !!(selectedEmp as any).phone,
    !!(selectedEmp as any).position,
    bankAccounts.length > 0,
    empEntries.length > 0,
  ].filter(Boolean).length * 20 : 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending_activation">Pending</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160 }}>
          <option value="">All Depts</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {canEdit && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAddOpen(true)}><Icon name="plus" size={14} />Add Employee</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Position</th><th>Department</th><th>Type</th><th>Role</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const dept = departments.find(d => d.id === e.department_id)
                return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => openEmp(e)}>
                    <td><EmployeeCard emp={e} dept={dept} /></td>
                    <td>{e.position}</td>
                    <td>{dept ? <span className="badge" style={{ background: dept.color + '22', color: dept.color }}>{dept.name}</span> : '-'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.employment_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.role}</td>
                    <td><span className={`badge ${e.status === 'active' ? 'badge-success' : e.status === 'pending_activation' ? 'badge-warning' : 'badge-gray'}`}>{e.status?.replace('_', ' ')}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state-title">No employees found</div></div>}
        </div>
      </div>

      {/* Employee Detail Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selectedEmp ? empName(selectedEmp) : ''} size="modal-lg">
        <div className="modal-body">
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: (editData as any).avatar_url ? 'transparent' : 'var(--primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--border)' }}>
                {(editData as any).avatar_url
                  ? <img src={(editData as any).avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{empInitials(selectedEmp)}</span>
                }
              </div>
              {canEdit && (
                <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white' }}>
                  <Icon name="edit" size={10} color="#fff" />
                  <input ref={photoRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedEmp?.first_name} {selectedEmp?.last_name?.[0]}.</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selectedEmp?.position}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Profile {profileProgress}% complete</div>
                </div>
                <div className="progress-bar" style={{ width: 180 }}><div className="progress-fill" style={{ width: profileProgress + '%' }} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-end' }}>
              {canEdit && (
                <button className="btn btn-secondary btn-sm" onClick={() => sendInvite(selectedEmp!.id)} disabled={inviteSending}>
                  {inviteSending ? 'Sending...' : 'Resend Invite'}
                </button>
              )}
              {inviteMsg && <span style={{ fontSize: 12, color: inviteMsg.includes('Error') ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{inviteMsg}</span>}
            </div>
          </div>

          <div className="tabs">
            {TABS.map((label, i) => <button key={i} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{label}</button>)}
          </div>

          {tab === 0 && (
            <div>
              <div className="form-row">
                <div className="form-group"><label>First Name</label><input value={editData.first_name || ''} onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))} /></div>
                <div className="form-group"><label>Last Name</label><input value={editData.last_name || ''} onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Email</label><input value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} /></div>
                <div className="form-group"><label>Phone</label><input value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Position</label><input value={editData.position || ''} onChange={e => setEditData(d => ({ ...d, position: e.target.value }))} /></div>
                <div className="form-group"><label>Department</label>
                  <select value={editData.department_id || ''} onChange={e => setEditData(d => ({ ...d, department_id: e.target.value }))}>
                    <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Location</label>
                  <select value={editData.location_id || ''} onChange={e => setEditData(d => ({ ...d, location_id: e.target.value }))}>
                    <option value="">None</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Hire Date</label><input type="date" value={editData.hire_date || ''} onChange={e => setEditData(d => ({ ...d, hire_date: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Employment Type</label>
                  <select value={editData.employment_type || ''} onChange={e => setEditData(d => ({ ...d, employment_type: e.target.value }))}>
                    <option value="fulltime">Full Time</option><option value="parttime">Part Time</option><option value="contract">Contract</option>
                  </select>
                </div>
                <div className="form-group"><label>Role</label>
                  <select value={editData.role || ''} onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}>
                    <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Hourly Rate</label><input type="number" step="0.01" value={editData.hourly_rate || 0} onChange={e => setEditData(d => ({ ...d, hourly_rate: Number(e.target.value) }))} /></div>
                <div className="form-group"><label>Annual Salary</label><input type="number" value={editData.salary_annual || 0} onChange={e => setEditData(d => ({ ...d, salary_annual: Number(e.target.value) }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Status</label>
                  <select value={editData.status || ''} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option><option value="inactive">Inactive</option><option value="pending_activation">Pending Activation</option>
                  </select>
                </div>
                <div className="form-group"><label>Language</label>
                  <select value={editData.language || 'en'} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))}>
                    <option value="en">English</option><option value="es">Espanol</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>PIN</label><input type="password" maxLength={6} value={editData.pin || ''} onChange={e => setEditData(d => ({ ...d, pin: e.target.value }))} /></div>
                <div className="form-group"><label>Geo Exempt</label>
                  <select value={editData.geo_exempt ? 'true' : 'false'} onChange={e => setEditData(d => ({ ...d, geo_exempt: e.target.value === 'true' }))}>
                    <option value="false">No</option><option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>PTO Balance</label><input type="number" value={editData.pto_balance || 0} onChange={e => setEditData(d => ({ ...d, pto_balance: Number(e.target.value) }))} style={{ maxWidth: 120 }} /></div>
            </div>
          )}

          {tab === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Net pay split across {bankAccounts.length} account(s). Last account set to "remainder" receives the rest.
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setAddBankOpen(true)}><Icon name="plus" size={13} />Add Account</button>
              </div>
              {bankAccounts.length === 0 && <div className="empty-state"><div className="empty-state-title">No bank accounts</div><div className="empty-state-sub">Add at least one account to receive payroll</div></div>}
              {bankAccounts.map((ba, i) => (
                <div key={ba.id} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '14px 16px', marginBottom: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{ba.nickname || ba.bank_name} <span style={{ fontSize: 11, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>({ba.account_type})</span></div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>****{ba.account_number?.slice(-4)} | Routing: {ba.routing_number}</div>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        <span className="badge badge-blue" style={{ marginRight: 6 }}>
                          Priority {ba.priority}
                        </span>
                        <span className="badge badge-gray">
                          {ba.allocation_type === 'fixed' ? '$' + ba.allocation_value : ba.allocation_type === 'percent' ? ba.allocation_value + '%' : 'Remainder'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge ${ba.status === 'approved' ? 'badge-success' : ba.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{ba.status}</span>
                      {canEdit && ba.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => approveBankAccount(ba.id)}>Approve</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => deleteBankAccount(ba.id)}><Icon name="trash" size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}

              <Modal open={addBankOpen} onClose={() => setAddBankOpen(false)} title="Add Bank Account">
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group"><label>Nickname</label><input value={newBank.nickname || ''} onChange={e => setNewBank(b => ({ ...b, nickname: e.target.value }))} placeholder="e.g. Savings, Main" /></div>
                    <div className="form-group"><label>Bank Name</label><input value={newBank.bank_name || ''} onChange={e => setNewBank(b => ({ ...b, bank_name: e.target.value }))} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Account Type</label>
                      <select value={newBank.account_type || 'checking'} onChange={e => setNewBank(b => ({ ...b, account_type: e.target.value }))}>
                        <option value="checking">Checking</option><option value="savings">Savings</option>
                      </select>
                    </div>
                    <div className="form-group"><label>Priority (1 = first)</label><input type="number" min={1} value={newBank.priority || 1} onChange={e => setNewBank(b => ({ ...b, priority: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Routing Number</label><input value={newBank.routing_number || ''} onChange={e => setNewBank(b => ({ ...b, routing_number: e.target.value }))} /></div>
                    <div className="form-group"><label>Account Number</label><input value={newBank.account_number || ''} onChange={e => setNewBank(b => ({ ...b, account_number: e.target.value }))} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Allocation Type</label>
                      <select value={newBank.allocation_type || 'remainder'} onChange={e => setNewBank(b => ({ ...b, allocation_type: e.target.value }))}>
                        <option value="fixed">Fixed Amount ($)</option>
                        <option value="percent">Percentage (%)</option>
                        <option value="remainder">Remainder (rest of paycheck)</option>
                      </select>
                    </div>
                    {newBank.allocation_type !== 'remainder' && (
                      <div className="form-group"><label>{newBank.allocation_type === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}</label>
                        <input type="number" step="0.01" value={newBank.allocation_value || 0} onChange={e => setNewBank(b => ({ ...b, allocation_value: Number(e.target.value) }))} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setAddBankOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={addBankAccount}>Add Account</button>
                </div>
              </Modal>
            </div>
          )}

          {tab === 2 && (
            <table><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead>
              <tbody>{empEntries.map(e => (
                <tr key={e.id}>
                  <td>{e.clock_in?.slice(0, 10)}</td>
                  <td className="mono">{e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '-'}</td>
                  <td className="mono">{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : '-'}</td>
                  <td className="mono">{entryHours(e).toFixed(2)}</td>
                  <td><span className={`badge ${e.status === 'approved' ? 'badge-success' : e.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{e.status}</span></td>
                </tr>
              ))}
              {empEntries.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-title">No entries</div></div></td></tr>}
              </tbody>
            </table>
          )}

          {tab === 3 && (
            <table><thead><tr><th>Period</th><th>Gross</th><th>Net</th><th>Status</th></tr></thead>
              <tbody>{empPayroll.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.period_id?.slice(0, 8)}</td>
                  <td className="mono">{fmtMoney(p.gross_pay)}</td>
                  <td className="mono">{fmtMoney(p.net_pay)}</td>
                  <td><span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-gray'}`}>{p.status}</span></td>
                </tr>
              ))}
              {empPayroll.length === 0 && <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-title">No payroll history</div></div></td></tr>}
              </tbody>
            </table>
          )}

          {tab === 4 && (
            <div>
              {canEdit && <div style={{ marginBottom: 12 }}><button className="btn btn-primary btn-sm" onClick={() => setAddPerfOpen(true)}>Add Review</button></div>}
              {empPerf.map(p => (
                <div key={p.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{p.period}</strong><Stars value={p.rating} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}><strong>Strengths:</strong> {p.strengths}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}><strong>Improvements:</strong> {p.improvements}</div>
                </div>
              ))}
              {empPerf.length === 0 && <div className="empty-state"><div className="empty-state-title">No reviews yet</div></div>}
              <Modal open={addPerfOpen} onClose={() => setAddPerfOpen(false)} title="Add Review">
                <div className="modal-body">
                  <div className="form-group"><label>Period</label><input value={newPerf.period} onChange={e => setNewPerf(p => ({ ...p, period: e.target.value }))} placeholder="Q1 2025" /></div>
                  <div className="form-group"><label>Rating</label><Stars value={newPerf.rating} onChange={v => setNewPerf(p => ({ ...p, rating: v }))} /></div>
                  <div className="form-group"><label>Strengths</label><textarea value={newPerf.strengths} onChange={e => setNewPerf(p => ({ ...p, strengths: e.target.value }))} /></div>
                  <div className="form-group"><label>Improvements</label><textarea value={newPerf.improvements} onChange={e => setNewPerf(p => ({ ...p, improvements: e.target.value }))} /></div>
                  <div className="form-group"><label>Notes</label><textarea value={newPerf.notes} onChange={e => setNewPerf(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setAddPerfOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={addPerfReview}>Save</button>
                </div>
              </Modal>
            </div>
          )}

          {tab === 5 && (
            <div>
              {canEdit
                ? <div className="form-group"><label>Internal Notes (admin only)</label><textarea value={editData.internal_notes || ''} onChange={e => setEditData(d => ({ ...d, internal_notes: e.target.value }))} style={{ minHeight: 150 }} /></div>
                : <div className="empty-state"><div className="empty-state-title">Access restricted</div></div>
              }
            </div>
          )}
        </div>
        <div className="modal-footer">
          {canEdit && user.role === 'admin' && <button className="btn btn-danger" onClick={deleteEmp}>Deactivate</button>}
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          {canEdit && <button className="btn btn-primary" onClick={saveEmp}>Save</button>}
        </div>
      </Modal>

      {/* Exit Survey Modal */}
      <Modal open={exitSurveyOpen} onClose={() => setExitSurveyOpen(false)} title="Exit Survey">
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Before deactivating {selectedEmp?.first_name}, please complete the exit survey.</p>
          <div className="form-group"><label>Reason for leaving</label><textarea value={exitSurvey.reason} onChange={e => setExitSurvey(s => ({ ...s, reason: e.target.value }))} /></div>
          <div className="form-group"><label>Would return?</label>
            <select value={exitSurvey.would_return ? 'true' : 'false'} onChange={e => setExitSurvey(s => ({ ...s, would_return: e.target.value === 'true' }))}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
          <div className="form-group"><label>Rating</label><Stars value={exitSurvey.rating} onChange={v => setExitSurvey(s => ({ ...s, rating: v }))} /></div>
          <div className="form-group"><label>Additional Feedback</label><textarea value={exitSurvey.feedback} onChange={e => setExitSurvey(s => ({ ...s, feedback: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setExitSurveyOpen(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={deactivateWithSurvey}>Deactivate Employee</button>
        </div>
      </Modal>

      {/* Add Employee Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Employee">
        <div className="modal-body">
          <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1D4ED8' }}>
            An invitation email will be sent automatically after saving.
          </div>
          <div className="form-row">
            <div className="form-group"><label>First Name *</label><input value={newEmp.first_name || ''} onChange={e => setNewEmp(d => ({ ...d, first_name: e.target.value }))} /></div>
            <div className="form-group"><label>Last Name *</label><input value={newEmp.last_name || ''} onChange={e => setNewEmp(d => ({ ...d, last_name: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>Email *</label><input type="email" value={newEmp.email || ''} onChange={e => setNewEmp(d => ({ ...d, email: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>Position</label><input value={newEmp.position || ''} onChange={e => setNewEmp(d => ({ ...d, position: e.target.value }))} /></div>
            <div className="form-group"><label>Department</label>
              <select value={newEmp.department_id || ''} onChange={e => setNewEmp(d => ({ ...d, department_id: e.target.value }))}>
                <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Hourly Rate</label><input type="number" step="0.01" value={newEmp.hourly_rate || 0} onChange={e => setNewEmp(d => ({ ...d, hourly_rate: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>Role</label>
              <select value={newEmp.role || 'employee'} onChange={e => setNewEmp(d => ({ ...d, role: e.target.value }))}>
                <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Language</label>
            <select value={newEmp.language || 'en'} onChange={e => setNewEmp(d => ({ ...d, language: e.target.value }))}>
              <option value="en">English</option><option value="es">Espanol</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={addEmployee}>Save and Send Invite</button>
        </div>
      </Modal>
    </div>
  )
}
