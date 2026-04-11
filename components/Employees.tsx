import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { Modal } from './shared/Modal'
import { Stars } from './shared/Stars'
import { empName, empInitials, fmtMoney, entryHours } from './shared/utils'
import type { Employee, Department, Location, TimeEntry, PayrollEntry, Performance } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[]; setEmployees: (e: Employee[]) => void }

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
  const [editData, setEditData] = useState<Partial<Employee>>({})
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  const [addPerfOpen, setAddPerfOpen] = useState(false)
  const [newPerf, setNewPerf] = useState({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const filtered = employees.filter(e => {
    if (search && !empName(e).toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterDept && e.department_id !== filterDept) return false
    return true
  })

  async function openEmp(emp: Employee) {
    setSelectedEmp(emp); setEditData({ ...emp }); setTab(0); setModalOpen(true)
    const [te, pe, pf] = await Promise.all([
      supabase.from('time_entries').select('*').eq('employee_id', emp.id).order('clock_in', { ascending: false }).limit(30),
      supabase.from('payroll_entries').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
      supabase.from('performance').select('*').eq('employee_id', emp.id).order('created_at' as any, { ascending: false }),
    ])
    setEmpEntries(te.data || []); setEmpPayroll(pe.data || []); setEmpPerf(pf.data || [])
  }

  async function saveEmp() {
    if (!selectedEmp) return
    await supabase.from('employees').update(editData).eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setModalOpen(false)
  }

  async function addEmployee() {
    await supabase.from('employees').insert(newEmp)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setAddOpen(false)
    setNewEmp({ status: 'active', role: 'employee', language: 'en', employment_type: 'fulltime', geo_exempt: false })
  }

  async function deleteEmp() {
    if (!selectedEmp || !confirm('Delete this employee?')) return
    await supabase.from('employees').delete().eq('id', selectedEmp.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); setModalOpen(false)
  }

  async function addPerfReview() {
    if (!selectedEmp) return
    await supabase.from('performance').insert({ ...newPerf, employee_id: selectedEmp.id, reviewer_id: user.id })
    const { data } = await supabase.from('performance').select('*').eq('employee_id', selectedEmp.id)
    setEmpPerf(data || []); setAddPerfOpen(false)
    setNewPerf({ period: '', rating: 5, strengths: '', improvements: '', notes: '' })
  }

  const TABS = [t(lang, 'personalInfo'), t(lang, 'bankAccount_tab'), t(lang, 'timeAttendance'), t(lang, 'payrollHistory'), t(lang, 'performance_tab'), t(lang, 'internalNotes')]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder={t(lang, 'search') + '...'} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 120 }}>
          <option value="">{t(lang, 'all')}</option>
          <option value="active">{t(lang, 'active')}</option>
          <option value="inactive">{t(lang, 'inactive')}</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160 }}>
          <option value="">{t(lang, 'all')} Depts</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {canEdit && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAddOpen(true)}>{t(lang, 'addEmployee')}</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'employee')}</th><th>{t(lang, 'position')}</th><th>{t(lang, 'department')}</th>
                <th>Type</th><th>{t(lang, 'role')}</th><th>{t(lang, 'status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const dept = departments.find(d => d.id === e.department_id)
                return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => openEmp(e)}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar">{empInitials(e)}</div>
                      <div><div style={{ fontWeight: 600 }}>{empName(e)}</div><div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{e.email}</div></div>
                    </div></td>
                    <td>{e.position}</td>
                    <td>{dept ? <span className="badge" style={{ background: dept.color + '22', color: dept.color }}>{dept.name}</span> : '-'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.employment_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.role}</td>
                    <td><span className={`badge ${e.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{e.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selectedEmp ? empName(selectedEmp) : ''} size="modal-lg">
        <div className="modal-body">
          <div className="tabs">
            {TABS.map((label, i) => <button key={i} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{label}</button>)}
          </div>

          {tab === 0 && (
            <div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'firstName')}</label><input value={editData.first_name || ''} onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))} /></div>
                <div className="form-group"><label>{t(lang, 'lastName')}</label><input value={editData.last_name || ''} onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'email')}</label><input value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} /></div>
                <div className="form-group"><label>{t(lang, 'phone')}</label><input value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'position')}</label><input value={editData.position || ''} onChange={e => setEditData(d => ({ ...d, position: e.target.value }))} /></div>
                <div className="form-group"><label>{t(lang, 'department')}</label>
                  <select value={editData.department_id || ''} onChange={e => setEditData(d => ({ ...d, department_id: e.target.value }))}>
                    <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'location')}</label>
                  <select value={editData.location_id || ''} onChange={e => setEditData(d => ({ ...d, location_id: e.target.value }))}>
                    <option value="">None</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>{t(lang, 'hireDate')}</label><input type="date" value={editData.hire_date || ''} onChange={e => setEditData(d => ({ ...d, hire_date: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Type</label>
                  <select value={editData.employment_type || ''} onChange={e => setEditData(d => ({ ...d, employment_type: e.target.value }))}>
                    <option value="fulltime">Full Time</option><option value="parttime">Part Time</option><option value="contract">Contract</option>
                  </select>
                </div>
                <div className="form-group"><label>{t(lang, 'role')}</label>
                  <select value={editData.role || ''} onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}>
                    <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'hourlyRate')}</label><input type="number" step="0.01" value={editData.hourly_rate || 0} onChange={e => setEditData(d => ({ ...d, hourly_rate: Number(e.target.value) }))} /></div>
                <div className="form-group"><label>{t(lang, 'salaryAnnual')}</label><input type="number" value={editData.salary_annual || 0} onChange={e => setEditData(d => ({ ...d, salary_annual: Number(e.target.value) }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'status')}</label>
                  <select value={editData.status || ''} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group"><label>{t(lang, 'language')}</label>
                  <select value={editData.language || 'en'} onChange={e => setEditData(d => ({ ...d, language: e.target.value }))}>
                    <option value="en">English</option><option value="es">Espanol</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t(lang, 'pin')}</label><input type="password" maxLength={6} value={editData.pin || ''} onChange={e => setEditData(d => ({ ...d, pin: e.target.value }))} /></div>
                <div className="form-group"><label>{t(lang, 'geoExempt')}</label>
                  <select value={editData.geo_exempt ? 'true' : 'false'} onChange={e => setEditData(d => ({ ...d, geo_exempt: e.target.value === 'true' }))}>
                    <option value="false">No</option><option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>PTO Balance</label><input type="number" value={editData.pto_balance || 0} onChange={e => setEditData(d => ({ ...d, pto_balance: Number(e.target.value) }))} /></div>
            </div>
          )}

          {tab === 1 && (
            <div>
              <div className="form-group"><label>{t(lang, 'bankName')}</label><input value={editData.bank_name || ''} onChange={e => setEditData(d => ({ ...d, bank_name: e.target.value }))} /></div>
              <div className="form-group"><label>{t(lang, 'bankAccountType')}</label>
                <select value={editData.bank_account_type || ''} onChange={e => setEditData(d => ({ ...d, bank_account_type: e.target.value }))}>
                  <option value="">Select...</option><option value="checking">Checking</option><option value="savings">Savings</option>
                </select>
              </div>
              <div className="form-group"><label>{t(lang, 'bankRouting')}</label><input value={editData.bank_routing || ''} onChange={e => setEditData(d => ({ ...d, bank_routing: e.target.value }))} /></div>
              <div className="form-group"><label>{t(lang, 'bankAccount')}</label><input value={editData.bank_account || ''} onChange={e => setEditData(d => ({ ...d, bank_account: e.target.value }))} /></div>
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
              ))}</tbody>
            </table>
          )}

          {tab === 3 && (
            <table><thead><tr><th>Period</th><th>Gross</th><th>Net</th><th>Status</th></tr></thead>
              <tbody>{empPayroll.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.period_id?.slice(0, 8)}</td>
                  <td className="mono">{fmtMoney(p.gross_pay)}</td>
                  <td className="mono">{fmtMoney(p.net_pay)}</td>
                  <td><span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{p.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {tab === 4 && (
            <div>
              {canEdit && <div style={{ marginBottom: 12 }}><button className="btn btn-primary btn-sm" onClick={() => setAddPerfOpen(true)}>{t(lang, 'addReview')}</button></div>}
              {empPerf.map(p => (
                <div key={p.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{p.period}</strong><Stars value={p.rating} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}><strong>Strengths:</strong> {p.strengths}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}><strong>Improvements:</strong> {p.improvements}</div>
                </div>
              ))}
              {empPerf.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
              <Modal open={addPerfOpen} onClose={() => setAddPerfOpen(false)} title={t(lang, 'addReview')}>
                <div className="modal-body">
                  <div className="form-group"><label>{t(lang, 'period')}</label><input value={newPerf.period} onChange={e => setNewPerf(p => ({ ...p, period: e.target.value }))} placeholder="Q1 2025" /></div>
                  <div className="form-group"><label>{t(lang, 'rating')}</label><Stars value={newPerf.rating} onChange={v => setNewPerf(p => ({ ...p, rating: v }))} /></div>
                  <div className="form-group"><label>{t(lang, 'strengths')}</label><textarea value={newPerf.strengths} onChange={e => setNewPerf(p => ({ ...p, strengths: e.target.value }))} /></div>
                  <div className="form-group"><label>{t(lang, 'improvements')}</label><textarea value={newPerf.improvements} onChange={e => setNewPerf(p => ({ ...p, improvements: e.target.value }))} /></div>
                  <div className="form-group"><label>{t(lang, 'notes')}</label><textarea value={newPerf.notes} onChange={e => setNewPerf(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setAddPerfOpen(false)}>{t(lang, 'cancel')}</button>
                  <button className="btn btn-primary" onClick={addPerfReview}>{t(lang, 'save')}</button>
                </div>
              </Modal>
            </div>
          )}

          {tab === 5 && (
            <div>
              {canEdit
                ? <div className="form-group"><label>{t(lang, 'internalNotes')}</label><textarea value={editData.internal_notes || ''} onChange={e => setEditData(d => ({ ...d, internal_notes: e.target.value }))} style={{ minHeight: 150 }} /></div>
                : <div className="empty-state"><div className="empty-state-title">Access restricted</div></div>
              }
            </div>
          )}
        </div>
        <div className="modal-footer">
          {canEdit && user.role === 'admin' && <button className="btn btn-danger" onClick={deleteEmp}>{t(lang, 'delete')}</button>}
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</button>
          {canEdit && <button className="btn btn-primary" onClick={saveEmp}>{t(lang, 'save')}</button>}
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t(lang, 'addEmployee')}>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'firstName')}</label><input value={newEmp.first_name || ''} onChange={e => setNewEmp(d => ({ ...d, first_name: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'lastName')}</label><input value={newEmp.last_name || ''} onChange={e => setNewEmp(d => ({ ...d, last_name: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'email')}</label><input type="email" value={newEmp.email || ''} onChange={e => setNewEmp(d => ({ ...d, email: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'password')}</label><input type="password" value={newEmp.password_hash || ''} onChange={e => setNewEmp(d => ({ ...d, password_hash: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'position')}</label><input value={newEmp.position || ''} onChange={e => setNewEmp(d => ({ ...d, position: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'department')}</label>
              <select value={newEmp.department_id || ''} onChange={e => setNewEmp(d => ({ ...d, department_id: e.target.value }))}>
                <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'hourlyRate')}</label><input type="number" step="0.01" value={newEmp.hourly_rate || 0} onChange={e => setNewEmp(d => ({ ...d, hourly_rate: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>{t(lang, 'role')}</label>
              <select value={newEmp.role || 'employee'} onChange={e => setNewEmp(d => ({ ...d, role: e.target.value }))}>
                <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'pin')}</label><input type="password" maxLength={6} value={newEmp.pin || ''} onChange={e => setNewEmp(d => ({ ...d, pin: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'language')}</label>
              <select value={newEmp.language || 'en'} onChange={e => setNewEmp(d => ({ ...d, language: e.target.value }))}>
                <option value="en">English</option><option value="es">Espanol</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={addEmployee}>{t(lang, 'save')}</button>
        </div>
      </Modal>
    </div>
  )
}
