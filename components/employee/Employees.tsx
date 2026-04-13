import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName, empInitials, fmtMoney, entryHours } from '../../lib/utils'
import { Card, Btn, Badge, Popup, Inp, Sel, Th, Td, C, StatusBadge, Stars, PageHeader, EmptyState, Avatar, Toggle } from '../ui'
import type { Employee, Department, Location, TimeEntry, PayrollEntry, Performance, EmployeeBankAccount, Certification, OnboardingTask } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[]; setEmployees: (e: Employee[]) => void }

const TABS = ['Profile', 'Schedule', 'Time', 'Payroll', 'Performance', 'Banking', 'Certifications', 'Onboarding', 'Notes']

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
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([])
  const [editData, setEditData] = useState<Partial<Employee>>({})
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  const [addPerfOpen, setAddPerfOpen] = useState(false)
  const [newPerf, setNewPerf] = useState({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
  const [addCertOpen, setAddCertOpen] = useState(false)
  const [newCert, setNewCert] = useState({ name: '', issuer: '', issued_date: '', expiry_date: '' })
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({ task: '', due_date: '' })
  const [addBankOpen, setAddBankOpen] = useState(false)
  const [newBank, setNewBank] = useState<Partial<EmployeeBankAccount>>({ allocation_type: 'remainder', allocation_value: 0, priority: 1, account_type: 'checking' })
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
    const [te, pe, pf, ba, cert, tasks] = await Promise.all([
      supabase.from('time_entries').select('*').eq('employee_id', emp.id).order('clock_in', { ascending: false }).limit(30),
      supabase.from('payroll_entries').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
      supabase.from('performance').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
      supabase.from('employee_bank_accounts').select('*').eq('employee_id', emp.id).order('priority'),
      supabase.from('certifications').select('*').eq('employee_id', emp.id).order('expiry_date'),
      supabase.from('onboarding_tasks').select('*').eq('employee_id', emp.id).order('due_date'),
    ])
    setEmpEntries(te.data || []); setEmpPayroll(pe.data || []); setEmpPerf(pf.data || [])
    setBankAccounts(ba.data || []); setCertifications(cert.data || []); setOnboardingTasks(tasks.data || [])
  }

  async function saveEmp() {
    if (!selectedEmp) return
    await supabase.from('employees').update(editData).eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setModalOpen(false)
  }

  async function addEmployee() {
    if (!newEmp.first_name || !newEmp.last_name || !newEmp.email) { alert('First name, last name and email are required'); return }
    const { data, error } = await supabase.from('employees').insert({ ...newEmp, status: 'pending_activation', password_hash: Math.random().toString(36).slice(2, 10) }).select('*')
    if (error) { alert(error.message); return }
    const { data: all } = await supabase.from('employees').select('*')
    setEmployees(all || [])
    if (data?.[0]) sendInvite(data[0].id)
    setAddOpen(false)
    setNewEmp({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  }

  async function sendInvite(empId: string) {
    setInviteSending(true); setInviteMsg('')
    const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId, base_url: window.location.origin }) })
    const data = await res.json()
    setInviteSending(false)
    setInviteMsg(data.success ? 'Invitation sent!' : 'Error: ' + data.error)
    setTimeout(() => setInviteMsg(''), 4000)
  }

  async function uploadPhoto(file: File) {
    if (!selectedEmp) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${selectedEmp.id}.${ext}`
    const { error } = await supabase.storage.from('staffforce').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); return }
    const { data: { publicUrl } } = supabase.storage.from('staffforce').getPublicUrl(path)
    setEditData(d => ({ ...d, avatar_url: publicUrl }))
    await supabase.from('employees').update({ avatar_url: publicUrl }).eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  async function savePerf() {
    if (!selectedEmp) return
    await supabase.from('performance').insert({ ...newPerf, employee_id: selectedEmp.id, reviewer_id: user.id })
    setAddPerfOpen(false); setNewPerf({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
    const { data } = await supabase.from('performance').select('*').eq('employee_id', selectedEmp.id).order('created_at' as any, { ascending: false })
    setEmpPerf(data || [])
  }

  async function saveCert() {
    if (!selectedEmp) return
    await supabase.from('certifications').insert({ ...newCert, employee_id: selectedEmp.id, status: 'valid' })
    setAddCertOpen(false); setNewCert({ name: '', issuer: '', issued_date: '', expiry_date: '' })
    const { data } = await supabase.from('certifications').select('*').eq('employee_id', selectedEmp.id)
    setCertifications(data || [])
  }

  async function saveTask() {
    if (!selectedEmp) return
    await supabase.from('onboarding_tasks').insert({ ...newTask, employee_id: selectedEmp.id, completed: false })
    setAddTaskOpen(false); setNewTask({ task: '', due_date: '' })
    const { data } = await supabase.from('onboarding_tasks').select('*').eq('employee_id', selectedEmp.id)
    setOnboardingTasks(data || [])
  }

  async function toggleTask(taskId: string, completed: boolean) {
    await supabase.from('onboarding_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', taskId)
    const { data } = await supabase.from('onboarding_tasks').select('*').eq('employee_id', selectedEmp!.id)
    setOnboardingTasks(data || [])
  }

  async function saveBank() {
    if (!selectedEmp) return
    await supabase.from('employee_bank_accounts').insert({ ...newBank, employee_id: selectedEmp.id, status: 'pending' })
    setAddBankOpen(false); setNewBank({ allocation_type: 'remainder', allocation_value: 0, priority: 1, account_type: 'checking' })
    const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp.id)
    setBankAccounts(data || [])
  }

  async function terminateEmployee() {
    if (!selectedEmp || !confirm(`Terminate ${empName(selectedEmp)}? This will set their status to inactive.`)) return
    await supabase.from('employees').update({ status: 'inactive' }).eq('id', selectedEmp.id)
    setExitSurveyOpen(true)
  }

  async function submitExitSurvey() {
    if (!selectedEmp) return
    await supabase.from('exit_surveys').insert({ ...exitSurvey, employee_id: selectedEmp.id })
    setExitSurveyOpen(false); setModalOpen(false)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  const deptEmployeeCounts: (Department & { count: number })[] = departments.map(d => ({ ...d, count: employees.filter(e => e.department_id === d.id && e.status === 'active').length }))

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ width: '100%', padding: '9px 12px 9px 36px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 14 }}>🔍</span>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 120 }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending_activation">Pending</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 160 }}>
          <option value="">All Departments</option>
          {deptEmployeeCounts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.count})</option>)}
        </select>
        {canEdit && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>+ Add Employee</Btn>}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: employees.length, color: C.accent },
          { label: 'Active', value: employees.filter(e => e.status === 'active').length, color: C.success },
          { label: 'Inactive', value: employees.filter(e => e.status === 'inactive').length, color: C.textMuted },
          { label: 'Pending', value: employees.filter(e => e.status === 'pending_activation').length, color: C.warning },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 18px', minWidth: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Employee list */}
      <Card pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Employee</Th><Th>Department</Th><Th>Position</Th><Th>Type</Th><Th>Status</Th><Th>Hire Date</Th>
              {canEdit && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => {
              const dept = departments.find(d => d.id === emp.department_id)
              return (
                <tr key={emp.id} style={{ borderBottom: `1px solid #F8FAFC`, cursor: 'pointer' }} onClick={() => openEmp(emp)}>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar emp={emp} size={32} color={dept?.color || C.accent} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.first_name} {emp.last_name}</div>
                        <div style={{ fontSize: 11, color: C.textSub }}>{emp.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{dept && <div style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color || C.accent }} />}{dept?.name || '—'}</div></Td>
                  <Td>{emp.position || '—'}</Td>
                  <Td><Badge color="gray">{emp.employment_type}</Badge></Td>
                  <Td><StatusBadge status={emp.status} /></Td>
                  <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{emp.hire_date || '—'}</Td>
                  {canEdit && <Td><Btn variant="secondary" size="sm" onClick={() => openEmp(emp)}>View</Btn></Td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState title="No employees found" sub="Adjust your filters or add a new employee" />}
      </Card>

      {/* Employee detail modal */}
      {selectedEmp && (
        <Popup open={modalOpen} onClose={() => setModalOpen(false)} title={`${selectedEmp.first_name} ${selectedEmp.last_name}`} wide>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, overflowX: 'auto', flexShrink: 0 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{ padding: '10px 16px', border: 'none', borderBottom: tab === i ? `2px solid ${C.accent}` : '2px solid transparent', background: 'transparent', fontSize: 12, fontWeight: tab === i ? 800 : 500, color: tab === i ? C.accent : C.textSub, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as any }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* PROFILE TAB */}
            {tab === 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
                    <Avatar emp={{ ...selectedEmp, ...editData }} size={64} color={departments.find(d => d.id === selectedEmp.department_id)?.color || C.accent} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff' }}>+</div>
                  </div>
                  <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedEmp.first_name} {selectedEmp.last_name}</div>
                    <StatusBadge status={selectedEmp.status} />
                    {inviteMsg && <div style={{ fontSize: 12, color: C.success, marginTop: 4 }}>{inviteMsg}</div>}
                  </div>
                  {canEdit && <Btn variant="ghost" size="sm" onClick={() => sendInvite(selectedEmp.id)} disabled={inviteSending} style={{ marginLeft: 'auto' }}>
                    {inviteSending ? 'Sending...' : '📧 Resend Invite'}
                  </Btn>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <Inp label="First Name" value={editData.first_name || ''} onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))} disabled={!canEdit} />
                  <div style={{ paddingLeft: 12 }}><Inp label="Last Name" value={editData.last_name || ''} onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))} disabled={!canEdit} /></div>
                  <Inp label="Email" type="email" value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} disabled={!canEdit} />
                  <div style={{ paddingLeft: 12 }}><Inp label="Phone" value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} disabled={!canEdit} /></div>
                  <Inp label="Position" value={editData.position || ''} onChange={e => setEditData(d => ({ ...d, position: e.target.value }))} disabled={!canEdit} />
                  <div style={{ paddingLeft: 12 }}><Inp label="Hire Date" type="date" value={editData.hire_date || ''} onChange={e => setEditData(d => ({ ...d, hire_date: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Sel label="Department" value={editData.department_id || ''} onChange={e => setEditData(d => ({ ...d, department_id: e.target.value }))} disabled={!canEdit}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Sel>
                  <Sel label="Location" value={editData.location_id || ''} onChange={e => setEditData(d => ({ ...d, location_id: e.target.value }))} disabled={!canEdit}>
                    <option value="">None</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </Sel>
                  <Sel label="Role" value={editData.role || 'employee'} onChange={e => setEditData(d => ({ ...d, role: e.target.value }))} disabled={!canEdit}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </Sel>
                  <Sel label="Status" value={editData.status || 'active'} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} disabled={!canEdit}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending_activation">Pending Activation</option>
                  </Sel>
                  <Sel label="Employment Type" value={editData.employment_type || 'fulltime'} onChange={e => setEditData(d => ({ ...d, employment_type: e.target.value }))} disabled={!canEdit}>
                    <option value="fulltime">Full-time</option>
                    <option value="parttime">Part-time</option>
                    <option value="contract">Contract</option>
                  </Sel>
                  <Sel label="Language" value={editData.language || 'en'} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))} disabled={!canEdit}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </Sel>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Inp label="Hourly Rate ($)" type="number" value={editData.hourly_rate || 0} onChange={e => setEditData(d => ({ ...d, hourly_rate: Number(e.target.value) }))} disabled={!canEdit} />
                  <Inp label="Annual Salary ($)" type="number" value={editData.salary_annual || 0} onChange={e => setEditData(d => ({ ...d, salary_annual: Number(e.target.value) }))} disabled={!canEdit} />
                  <Inp label="PTO Balance (days)" type="number" value={editData.pto_balance || 0} onChange={e => setEditData(d => ({ ...d, pto_balance: Number(e.target.value) }))} disabled={!canEdit} />
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <Toggle value={!!editData.geo_exempt} onChange={v => setEditData(d => ({ ...d, geo_exempt: v }))} label="Geofence Exempt" />
                  </div>
                )}
              </div>
            )}

            {/* TIME TAB */}
            {tab === 2 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Total Entries', value: empEntries.length },
                    { label: 'Total Hours', value: empEntries.reduce((s, e) => s + entryHours(e), 0).toFixed(1) + 'h' },
                    { label: 'Approved', value: empEntries.filter(e => e.status === 'approved').length },
                    { label: 'Pending', value: empEntries.filter(e => e.status === 'pending').length },
                  ].map((k, i) => (
                    <div key={i} style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as any }}>{k.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: C.accent, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Date</Th><Th>In</Th><Th>Out</Th><Th>Break</Th><Th>Hours</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {empEntries.slice(0, 20).map(e => (
                      <tr key={e.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.clock_in?.slice(0, 10) || '-'}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.clock_in ? format(new Date(e.clock_in), 'HH:mm') : '-'}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : <span style={{ color: C.success, fontWeight: 700 }}>Active</span>}</Td>
                        <Td>{e.break_mins || 0}m</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{entryHours(e).toFixed(2)}</Td>
                        <Td><StatusBadge status={e.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {empEntries.length === 0 && <EmptyState title="No time entries" />}
              </div>
            )}

            {/* PAYROLL TAB */}
            {tab === 3 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textSub, marginBottom: 8 }}>YTD Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Gross Paid', value: fmtMoney(empPayroll.filter(p => p.status === 'paid').reduce((s, p) => s + p.gross_pay, 0)) },
                      { label: 'Net Paid', value: fmtMoney(empPayroll.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_pay, 0)) },
                      { label: 'Periods', value: empPayroll.length },
                    ].map((k, i) => (
                      <div key={i} style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as any }}>{k.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Period</Th><Th>Reg Hrs</Th><Th>OT Hrs</Th><Th>Gross</Th><Th>Deductions</Th><Th>Net</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {empPayroll.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.period_id?.slice(0, 8)}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)' }}>{p.regular_hours?.toFixed(1)}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', color: p.overtime_hours > 0 ? C.warning : undefined }}>{p.overtime_hours?.toFixed(1)}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(p.gross_pay)}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', color: C.danger }}>{fmtMoney(p.federal_tax + p.fica + p.state_tax + p.health_insurance + p.retirement_401k)}</Td>
                        <Td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: C.success }}>{fmtMoney(p.net_pay)}</Td>
                        <Td><StatusBadge status={p.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {empPayroll.length === 0 && <EmptyState title="No payroll records" />}
              </div>
            )}

            {/* PERFORMANCE TAB */}
            {tab === 4 && (
              <div>
                {canEdit && <div style={{ marginBottom: 16 }}><Btn variant="primary" size="sm" onClick={() => setAddPerfOpen(true)}>+ Add Review</Btn></div>}
                {empPerf.map(p => (
                  <div key={p.id} style={{ padding: '14px 16px', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.period}</div>
                      <Stars value={p.rating} size={14} />
                    </div>
                    {p.strengths && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: C.success, textTransform: 'uppercase' as any }}>Strengths</span><p style={{ fontSize: 13, color: C.text, margin: '4px 0 0' }}>{p.strengths}</p></div>}
                    {p.improvements && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: C.warning, textTransform: 'uppercase' as any }}>Improvements</span><p style={{ fontSize: 13, color: C.text, margin: '4px 0 0' }}>{p.improvements}</p></div>}
                    {p.notes && <div><span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any }}>Notes</span><p style={{ fontSize: 13, color: C.textSub, margin: '4px 0 0' }}>{p.notes}</p></div>}
                  </div>
                ))}
                {empPerf.length === 0 && <EmptyState title="No performance reviews" />}
              </div>
            )}

            {/* BANKING TAB */}
            {tab === 5 && (
              <div>
                {canEdit && <div style={{ marginBottom: 16 }}><Btn variant="primary" size="sm" onClick={() => setAddBankOpen(true)}>+ Add Bank Account</Btn></div>}
                {bankAccounts.map(ba => (
                  <div key={ba.id} style={{ padding: '14px 16px', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700 }}>{ba.nickname || ba.bank_name}</div>
                      <StatusBadge status={ba.status} />
                    </div>
                    <div style={{ fontSize: 12, color: C.textSub }}>
                      {ba.bank_name} · {ba.account_type} · ****{ba.account_number?.slice(-4)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSub }}>
                      Allocation: {ba.allocation_type === 'remainder' ? 'Remainder' : ba.allocation_type === 'percent' ? `${ba.allocation_value}%` : `$${ba.allocation_value}`}
                      {' '}· Priority #{ba.priority}
                    </div>
                    {canEdit && ba.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <Btn variant="success" size="sm" onClick={async () => { await supabase.from('employee_bank_accounts').update({ status: 'approved', approved_by: user.id }).eq('id', ba.id); const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp!.id); setBankAccounts(data || []) }}>Approve</Btn>
                        <Btn variant="danger" size="sm" onClick={async () => { await supabase.from('employee_bank_accounts').update({ status: 'rejected' }).eq('id', ba.id); const { data } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', selectedEmp!.id); setBankAccounts(data || []) }}>Reject</Btn>
                      </div>
                    )}
                  </div>
                ))}
                {bankAccounts.length === 0 && <EmptyState title="No bank accounts on file" />}
              </div>
            )}

            {/* CERTIFICATIONS TAB */}
            {tab === 6 && (
              <div>
                {canEdit && <div style={{ marginBottom: 16 }}><Btn variant="primary" size="sm" onClick={() => setAddCertOpen(true)}>+ Add Certification</Btn></div>}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Certification</Th><Th>Issuer</Th><Th>Issued</Th><Th>Expires</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {certifications.map(cert => {
                      const isExpired = cert.expiry_date && new Date(cert.expiry_date) < new Date()
                      const isSoon = cert.expiry_date && !isExpired && new Date(cert.expiry_date) < new Date(Date.now() + 30 * 86400000)
                      return (
                        <tr key={cert.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                          <Td><div style={{ fontWeight: 600 }}>{cert.name}</div></Td>
                          <Td style={{ color: C.textSub, fontSize: 12 }}>{cert.issuer}</Td>
                          <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{cert.issued_date || '—'}</Td>
                          <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isExpired ? C.danger : isSoon ? C.warning : undefined }}>{cert.expiry_date || '—'}</Td>
                          <Td><Badge color={isExpired ? 'red' : isSoon ? 'yellow' : 'green'}>{isExpired ? 'Expired' : isSoon ? 'Expiring Soon' : 'Valid'}</Badge></Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {certifications.length === 0 && <EmptyState title="No certifications on file" />}
              </div>
            )}

            {/* ONBOARDING TAB */}
            {tab === 7 && (
              <div>
                {canEdit && <div style={{ marginBottom: 16 }}><Btn variant="primary" size="sm" onClick={() => setAddTaskOpen(true)}>+ Add Task</Btn></div>}
                <div style={{ marginBottom: 12, fontSize: 13, color: C.textSub }}>
                  {onboardingTasks.filter(t => t.completed).length} of {onboardingTasks.length} tasks completed
                </div>
                {onboardingTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, background: task.completed ? C.successBg : '#fff' }}>
                    <input type="checkbox" checked={task.completed} onChange={e => toggleTask(task.id, e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? C.textSub : C.text }}>{task.task}</div>
                      {task.due_date && <div style={{ fontSize: 11, color: C.textMuted }}>Due: {task.due_date}</div>}
                    </div>
                    {task.completed && <Badge color="green">Done</Badge>}
                  </div>
                ))}
                {onboardingTasks.length === 0 && <EmptyState title="No onboarding tasks" sub="Add tasks to track the onboarding progress" />}
              </div>
            )}

            {/* NOTES TAB */}
            {tab === 8 && (
              <div>
                <Inp label="Internal Notes (not visible to employee)" value={editData.internal_notes || ''} onChange={e => setEditData(d => ({ ...d, internal_notes: e.target.value }))} rows={8} disabled={!canEdit} />
              </div>
            )}
          </div>

          <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'space-between', position: 'sticky', bottom: 0, background: '#fff' }}>
            {canEdit && selectedEmp?.status === 'active' && (
              <Btn variant="danger" size="sm" onClick={terminateEmployee}>Terminate</Btn>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <Btn variant="secondary" onClick={() => setModalOpen(false)}>Close</Btn>
              {canEdit && <Btn variant="primary" onClick={saveEmp}>Save Changes</Btn>}
            </div>
          </div>
        </Popup>
      )}

      {/* Add employee modal */}
      <Popup open={addOpen} onClose={() => setAddOpen(false)} title="Add New Employee">
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="First Name" value={newEmp.first_name || ''} onChange={e => setNewEmp(n => ({ ...n, first_name: e.target.value }))} required />
            <Inp label="Last Name" value={newEmp.last_name || ''} onChange={e => setNewEmp(n => ({ ...n, last_name: e.target.value }))} required />
          </div>
          <Inp label="Email" type="email" value={newEmp.email || ''} onChange={e => setNewEmp(n => ({ ...n, email: e.target.value }))} required />
          <Inp label="Phone" value={newEmp.phone || ''} onChange={e => setNewEmp(n => ({ ...n, phone: e.target.value }))} />
          <Inp label="Position" value={newEmp.position || ''} onChange={e => setNewEmp(n => ({ ...n, position: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Department" value={newEmp.department_id || ''} onChange={e => setNewEmp(n => ({ ...n, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Sel>
            <Sel label="Role" value={newEmp.role || 'employee'} onChange={e => setNewEmp(n => ({ ...n, role: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Sel>
            <Sel label="Employment Type" value={newEmp.employment_type || 'fulltime'} onChange={e => setNewEmp(n => ({ ...n, employment_type: e.target.value }))}>
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
              <option value="contract">Contract</option>
            </Sel>
            <Inp label="Hourly Rate ($)" type="number" value={newEmp.hourly_rate || 0} onChange={e => setNewEmp(n => ({ ...n, hourly_rate: Number(e.target.value) }))} />
          </div>
          <div style={{ fontSize: 12, color: C.textSub, background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, marginTop: 8 }}>
            📧 An invitation email will be sent automatically to set up their password.
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={addEmployee}>Add & Send Invite</Btn>
        </div>
      </Popup>

      {/* Add performance review modal */}
      <Popup open={addPerfOpen} onClose={() => setAddPerfOpen(false)} title="Add Performance Review">
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Period (e.g. Q1 2025)" value={newPerf.period} onChange={e => setNewPerf(p => ({ ...p, period: e.target.value }))} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>Rating</label>
            <Stars value={newPerf.rating} onChange={v => setNewPerf(p => ({ ...p, rating: v }))} size={24} />
          </div>
          <Inp label="Strengths" value={newPerf.strengths} onChange={e => setNewPerf(p => ({ ...p, strengths: e.target.value }))} rows={3} />
          <Inp label="Areas for Improvement" value={newPerf.improvements} onChange={e => setNewPerf(p => ({ ...p, improvements: e.target.value }))} rows={3} />
          <Inp label="Additional Notes" value={newPerf.notes} onChange={e => setNewPerf(p => ({ ...p, notes: e.target.value }))} rows={2} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setAddPerfOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={savePerf}>Save Review</Btn>
        </div>
      </Popup>

      {/* Add certification modal */}
      <Popup open={addCertOpen} onClose={() => setAddCertOpen(false)} title="Add Certification">
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Certification Name" value={newCert.name} onChange={e => setNewCert(c => ({ ...c, name: e.target.value }))} />
          <Inp label="Issuer / Organization" value={newCert.issuer} onChange={e => setNewCert(c => ({ ...c, issuer: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Issued Date" type="date" value={newCert.issued_date} onChange={e => setNewCert(c => ({ ...c, issued_date: e.target.value }))} />
            <Inp label="Expiry Date" type="date" value={newCert.expiry_date} onChange={e => setNewCert(c => ({ ...c, expiry_date: e.target.value }))} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setAddCertOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveCert}>Save Certification</Btn>
        </div>
      </Popup>

      {/* Add onboarding task modal */}
      <Popup open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="Add Onboarding Task">
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Task Description" value={newTask.task} onChange={e => setNewTask(t => ({ ...t, task: e.target.value }))} rows={2} />
          <Inp label="Due Date" type="date" value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setAddTaskOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveTask}>Add Task</Btn>
        </div>
      </Popup>

      {/* Add bank account modal */}
      <Popup open={addBankOpen} onClose={() => setAddBankOpen(false)} title="Add Bank Account">
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Nickname (optional)" value={newBank.nickname || ''} onChange={e => setNewBank(b => ({ ...b, nickname: e.target.value }))} placeholder="e.g. Main Checking" />
          <Inp label="Bank Name" value={newBank.bank_name || ''} onChange={e => setNewBank(b => ({ ...b, bank_name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Account Type" value={newBank.account_type || 'checking'} onChange={e => setNewBank(b => ({ ...b, account_type: e.target.value }))}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </Sel>
            <Inp label="Priority" type="number" value={newBank.priority || 1} onChange={e => setNewBank(b => ({ ...b, priority: Number(e.target.value) }))} />
          </div>
          <Inp label="Routing Number" value={newBank.routing_number || ''} onChange={e => setNewBank(b => ({ ...b, routing_number: e.target.value }))} />
          <Inp label="Account Number" value={newBank.account_number || ''} onChange={e => setNewBank(b => ({ ...b, account_number: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Allocation Type" value={newBank.allocation_type || 'remainder'} onChange={e => setNewBank(b => ({ ...b, allocation_type: e.target.value }))}>
              <option value="remainder">Remainder</option>
              <option value="fixed">Fixed Amount</option>
              <option value="percent">Percentage</option>
            </Sel>
            <Inp label="Allocation Value" type="number" value={newBank.allocation_value || 0} onChange={e => setNewBank(b => ({ ...b, allocation_value: Number(e.target.value) }))} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setAddBankOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveBank}>Add Account</Btn>
        </div>
      </Popup>

      {/* Exit survey modal */}
      <Popup open={exitSurveyOpen} onClose={() => setExitSurveyOpen(false)} title="Exit Survey">
        <div style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16, padding: '12px', background: C.warningBg, borderRadius: 8, fontSize: 13, color: C.warning }}>Employee status has been set to Inactive. Complete the exit survey below.</div>
          <Inp label="Reason for Leaving" value={exitSurvey.reason} onChange={e => setExitSurvey(s => ({ ...s, reason: e.target.value }))} rows={3} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>Rating</label>
            <Stars value={exitSurvey.rating} onChange={v => setExitSurvey(s => ({ ...s, rating: v }))} size={22} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Toggle value={exitSurvey.would_return} onChange={v => setExitSurvey(s => ({ ...s, would_return: v }))} label="Would return to the company" />
          </div>
          <Inp label="Additional Feedback" value={exitSurvey.feedback} onChange={e => setExitSurvey(s => ({ ...s, feedback: e.target.value }))} rows={4} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => { setExitSurveyOpen(false); setModalOpen(false) }}>Skip</Btn>
          <Btn variant="primary" onClick={submitExitSurvey}>Submit & Close</Btn>
        </div>
      </Popup>
    </div>
  )
}
