import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { downloadBlob, empName } from './shared/utils'
import type { Employee, Department } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; setEmployees: (e: Employee[]) => void }

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clock', label: 'Clock In/Out' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'timesheets', label: 'Timesheets' },
  { key: 'timeoff', label: 'Time Off' },
  { key: 'availability', label: 'Availability' },
  { key: 'shiftswap', label: 'Shift Swap' },
  { key: 'messaging', label: 'Messaging' },
  { key: 'documents', label: 'Documents' },
  { key: 'notifications', label: 'Notifications' },
]

const DEFAULT_EMPLOYEE_MODULES = ['dashboard','clock','schedule','timesheets','timeoff','availability','shiftswap','messaging','documents','notifications']

export default function Settings({ user, lang, employees, departments, setEmployees }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [config, setConfig] = useState<any>({ company_name: 'StaffForce', geofencing_enabled: true })
  const [payrollCfg, setPayrollCfg] = useState({ daily_ot_threshold: 8, weekly_ot_threshold: 40, ot_multiplier: 1.5, federal_tax_rate: 0.12, fica_rate: 0.0765, state_tax_rate: 0.04, health_insurance_fixed: 50, retirement_401k_rate: 0.03 })
  const [theme, setTheme] = useState({ bg: '#F4F6F9', accent: '#0A6EBD', sidebar: '#0F1A2E', success: '#059669', danger: '#DC2626', warning: '#D97706' })
  const [smtpCfg, setSmtpCfg] = useState({ host: '', port: 587, email: '', password: '', sender_name: '' })
  const [emailTemplate, setEmailTemplate] = useState({ logo_url: '', accent_color: '#0A6EBD', welcome_message: '', signature: '' })
  const [timeoffCfg, setTimeoffCfg] = useState({ min_advance_days: 3, max_simultaneous: 2, max_consecutive_days: 14 })
  const [autoCfg, setAutoCfg] = useState({ scheduling: false, timesheets: false, payroll: false, timeoff: false })
  const [autoRules, setAutoRules] = useState({ timesheet_tolerance_mins: 15, timeoff_min_coverage_pct: 50 })
  const [payPeriodCfg, setPayPeriodCfg] = useState({ frequency: 'biweekly', pay_day: 'friday', custom_pay_dates: '' })
  const [employeeModules, setEmployeeModules] = useState<string[]>(DEFAULT_EMPLOYEE_MODULES)
  const [depts, setDepts] = useState<Department[]>(departments)
  const [newDept, setNewDept] = useState({ name: '', color: '#0A6EBD' })
  const [saved, setSaved] = useState('')
  const [testEmailMsg, setTestEmailMsg] = useState('')
  const [emailPreview, setEmailPreview] = useState(false)
  const [configId, setConfigId] = useState<number | null>(null)

  useEffect(() => { loadConfig(); setDepts(departments) }, [departments])

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('*').limit(1)
    if (data && data.length > 0) {
      const cfg = data[0]
      setConfigId(cfg.id)
      setConfig(cfg)
      if (cfg.payroll_config) setPayrollCfg(cfg.payroll_config)
      if (cfg.theme) setTheme(cfg.theme)
      if (cfg.smtp_config) setSmtpCfg(cfg.smtp_config)
      if (cfg.email_template) setEmailTemplate(cfg.email_template)
      if (cfg.timeoff_config) setTimeoffCfg(cfg.timeoff_config)
      if (cfg.auto_config) setAutoCfg(cfg.auto_config)
      if (cfg.auto_rules) setAutoRules(cfg.auto_rules)
      if (cfg.pay_period_config) setPayPeriodCfg(cfg.pay_period_config)
      if (cfg.employee_modules) setEmployeeModules(cfg.employee_modules)
    }
  }

  async function saveConfig() {
    const payload = {
      company_name: config.company_name,
      geofencing_enabled: config.geofencing_enabled,
      payroll_config: payrollCfg,
      theme,
      smtp_config: smtpCfg,
      email_template: emailTemplate,
      timeoff_config: timeoffCfg,
      auto_config: autoCfg,
      auto_rules: autoRules,
      pay_period_config: payPeriodCfg,
      employee_modules: employeeModules,
    }
    if (configId) {
      await supabase.from('app_config').update(payload).eq('id', configId)
    } else {
      const { data } = await supabase.from('app_config').insert(payload).select('id')
      if (data?.[0]) setConfigId(data[0].id)
    }
    applyTheme(theme)
    setSaved('Saved!'); setTimeout(() => setSaved(''), 2500)
  }

  function applyTheme(th: typeof theme) {
    const r = document.documentElement
    r.style.setProperty('--color-bg', th.bg)
    r.style.setProperty('--color-accent', th.accent)
    r.style.setProperty('--color-sidebar', th.sidebar)
    r.style.setProperty('--color-success', th.success)
    r.style.setProperty('--color-danger', th.danger)
    r.style.setProperty('--color-warning', th.warning)
  }

  async function sendTestEmail() {
    setTestEmailMsg('Sending...')
    const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
    const data = await res.json()
    setTestEmailMsg(data.success ? 'Test email sent!' : 'Error: ' + data.error)
    setTimeout(() => setTestEmailMsg(''), 4000)
  }

  async function addDept() {
    if (!newDept.name) return
    await supabase.from('departments').insert(newDept)
    const { data } = await supabase.from('departments').select('*')
    setDepts(data || [])
    setNewDept({ name: '', color: '#0A6EBD' })
  }

  async function deleteDept(id: string) {
    await supabase.from('departments').delete().eq('id', id)
    setDepts(prev => prev.filter(d => d.id !== id))
  }

  async function updateEmpRole(id: string, role: string) {
    await supabase.from('employees').update({ role }).eq('id', id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  function toggleModule(key: string) {
    setEmployeeModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
  }

  const ColorRow = ({ label, key: k }: { label: string; key: keyof typeof theme }) => (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={theme[k]} onChange={e => { const v = e.target.value; setTheme(th => ({ ...th, [k]: v })); document.documentElement.style.setProperty(`--color-${k === 'bg' ? 'bg' : k === 'accent' ? 'accent' : k === 'sidebar' ? 'sidebar' : k}`, v) }} style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 4 }} />
        <input value={theme[k]} onChange={e => setTheme(th => ({ ...th, [k]: e.target.value }))} style={{ flex: 1 }} />
      </div>
    </div>
  )

  const SectionTitle = ({ title }: { title: string }) => (
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid var(--color-border)' }}>{title}</div>
  )

  const TABS = ['General', 'Payroll', 'Scheduling', 'Time Off', 'Email', 'Theme', 'Permissions', 'Data']

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map((label, i) => <button key={i} className={`tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>{label}</button>)}
      </div>

      <div style={{ maxWidth: 720 }}>

        {/* GENERAL */}
        {activeTab === 0 && (
          <div className="card">
            <SectionTitle title="Company Settings" />
            <div className="form-group"><label>Company Name</label><input value={config.company_name || ''} onChange={e => setConfig((c: any) => ({ ...c, company_name: e.target.value }))} /></div>
            <div className="form-group">
              <label>Geofencing</label>
              <select value={config.geofencing_enabled ? 'true' : 'false'} onChange={e => setConfig((c: any) => ({ ...c, geofencing_enabled: e.target.value === 'true' }))}>
                <option value="true">Enabled</option><option value="false">Disabled</option>
              </select>
            </div>
            <SectionTitle title="Departments" />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newDept.name} onChange={e => setNewDept(d => ({ ...d, name: e.target.value }))} placeholder="Department name" style={{ flex: 1 }} />
              <input type="color" value={newDept.color} onChange={e => setNewDept(d => ({ ...d, color: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} />
              <button className="btn btn-primary btn-sm" onClick={addDept}>Add</button>
            </div>
            {depts.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 6, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: d.color }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)} style={{ padding: '3px 8px', fontSize: 11 }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* PAYROLL */}
        {activeTab === 1 && (
          <div className="card">
            <SectionTitle title="Pay Period Configuration" />
            <div className="form-row">
              <div className="form-group">
                <label>Frequency</label>
                <select value={payPeriodCfg.frequency} onChange={e => setPayPeriodCfg(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semi-monthly (1st and 15th)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Pay Day</label>
                <select value={payPeriodCfg.pay_day} onChange={e => setPayPeriodCfg(p => ({ ...p, pay_day: e.target.value }))}>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>
            </div>
            <SectionTitle title="Overtime Rules" />
            <div className="form-row">
              <div className="form-group"><label>Daily OT After (hrs)</label><input type="number" step="0.5" value={payrollCfg.daily_ot_threshold} onChange={e => setPayrollCfg(p => ({ ...p, daily_ot_threshold: Number(e.target.value) }))} /></div>
              <div className="form-group"><label>Weekly OT After (hrs)</label><input type="number" value={payrollCfg.weekly_ot_threshold} onChange={e => setPayrollCfg(p => ({ ...p, weekly_ot_threshold: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>OT Multiplier</label><input type="number" step="0.1" value={payrollCfg.ot_multiplier} onChange={e => setPayrollCfg(p => ({ ...p, ot_multiplier: Number(e.target.value) }))} /></div>
            </div>
            <SectionTitle title="Tax & Deductions" />
            <div className="form-row">
              <div className="form-group"><label>Federal Tax</label><input type="number" step="0.01" value={payrollCfg.federal_tax_rate} onChange={e => setPayrollCfg(p => ({ ...p, federal_tax_rate: Number(e.target.value) }))} /></div>
              <div className="form-group"><label>FICA</label><input type="number" step="0.0001" value={payrollCfg.fica_rate} onChange={e => setPayrollCfg(p => ({ ...p, fica_rate: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>State Tax</label><input type="number" step="0.01" value={payrollCfg.state_tax_rate} onChange={e => setPayrollCfg(p => ({ ...p, state_tax_rate: Number(e.target.value) }))} /></div>
              <div className="form-group"><label>Health Insurance ($)</label><input type="number" value={payrollCfg.health_insurance_fixed} onChange={e => setPayrollCfg(p => ({ ...p, health_insurance_fixed: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-group" style={{ maxWidth: 200 }}><label>401k Rate</label><input type="number" step="0.01" value={payrollCfg.retirement_401k_rate} onChange={e => setPayrollCfg(p => ({ ...p, retirement_401k_rate: Number(e.target.value) }))} /></div>
          </div>
        )}

        {/* SCHEDULING AUTO */}
        {activeTab === 2 && (
          <div className="card">
            <SectionTitle title="Automation Mode" />
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>When Auto is enabled, the system handles the task automatically. Admin still reviews and approves before changes go live.</p>
            {(['scheduling','timesheets','payroll','timeoff'] as const).map(module => (
              <div key={module} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{module}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {module === 'scheduling' && 'Auto-generate schedules based on availability and hours'}
                    {module === 'timesheets' && 'Auto-approve timesheets within tolerance window'}
                    {module === 'payroll' && 'Auto-calculate payroll at period end, admin approves'}
                    {module === 'timeoff' && 'Auto-approve requests if coverage requirements are met'}
                  </div>
                </div>
                <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                  <button onClick={() => setAutoCfg(a => ({ ...a, [module]: false }))} style={{ padding: '6px 16px', border: 'none', background: !autoCfg[module] ? 'var(--color-text)' : 'transparent', color: !autoCfg[module] ? '#fff' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Manual</button>
                  <button onClick={() => setAutoCfg(a => ({ ...a, [module]: true }))} style={{ padding: '6px 16px', border: 'none', background: autoCfg[module] ? 'var(--color-accent)' : 'transparent', color: autoCfg[module] ? '#fff' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Auto</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 20 }}>
              <SectionTitle title="Auto Rules" />
              <div className="form-row">
                <div className="form-group"><label>Timesheet tolerance (minutes)</label><input type="number" value={autoRules.timesheet_tolerance_mins} onChange={e => setAutoRules(r => ({ ...r, timesheet_tolerance_mins: Number(e.target.value) }))} /></div>
                <div className="form-group"><label>Time off min coverage (%)</label><input type="number" value={autoRules.timeoff_min_coverage_pct} onChange={e => setAutoRules(r => ({ ...r, timeoff_min_coverage_pct: Number(e.target.value) }))} /></div>
              </div>
            </div>
          </div>
        )}

        {/* TIME OFF */}
        {activeTab === 3 && (
          <div className="card">
            <SectionTitle title="Time Off Rules" />
            <div className="form-group">
              <label>Minimum advance notice (days)</label>
              <select value={timeoffCfg.min_advance_days} onChange={e => setTimeoffCfg(c => ({ ...c, min_advance_days: Number(e.target.value) }))}>
                {[1,2,3,5,7,14,30].map(n => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Sick leave always bypasses this rule.</div>
            </div>
            <div className="form-group">
              <label>Max employees from same dept off simultaneously</label>
              <input type="number" min={1} value={timeoffCfg.max_simultaneous} onChange={e => setTimeoffCfg(c => ({ ...c, max_simultaneous: Number(e.target.value) }))} style={{ maxWidth: 100 }} />
            </div>
            <div className="form-group">
              <label>Max consecutive days per request</label>
              <input type="number" min={1} value={timeoffCfg.max_consecutive_days} onChange={e => setTimeoffCfg(c => ({ ...c, max_consecutive_days: Number(e.target.value) }))} style={{ maxWidth: 100 }} />
            </div>
          </div>
        )}

        {/* EMAIL */}
        {activeTab === 4 && (
          <div className="card">
            <SectionTitle title="SMTP Configuration" />
            <div className="form-row">
              <div className="form-group"><label>SMTP Host</label><input value={smtpCfg.host} onChange={e => setSmtpCfg(s => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
              <div className="form-group"><label>Port</label><input type="number" value={smtpCfg.port} onChange={e => setSmtpCfg(s => ({ ...s, port: Number(e.target.value) }))} style={{ maxWidth: 100 }} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Email Address</label><input type="email" value={smtpCfg.email} onChange={e => setSmtpCfg(s => ({ ...s, email: e.target.value }))} placeholder="noreply@yourcompany.com" /></div>
              <div className="form-group"><label>Password / App Password</label><input type="password" value={smtpCfg.password} onChange={e => setSmtpCfg(s => ({ ...s, password: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Sender Name</label><input value={smtpCfg.sender_name} onChange={e => setSmtpCfg(s => ({ ...s, sender_name: e.target.value }))} placeholder="StaffForce" /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
              <button className="btn btn-secondary" onClick={sendTestEmail}>Send Test Email</button>
              {testEmailMsg && <span style={{ fontSize: 13, color: testEmailMsg.includes('Error') ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>{testEmailMsg}</span>}
            </div>
            <SectionTitle title="Email Template" />
            <div className="form-group"><label>Logo URL</label><input value={emailTemplate.logo_url} onChange={e => setEmailTemplate(t => ({ ...t, logo_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="form-group">
              <label>Accent Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={emailTemplate.accent_color} onChange={e => setEmailTemplate(t => ({ ...t, accent_color: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} />
                <input value={emailTemplate.accent_color} onChange={e => setEmailTemplate(t => ({ ...t, accent_color: e.target.value }))} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group"><label>Welcome Message</label><textarea value={emailTemplate.welcome_message} onChange={e => setEmailTemplate(t => ({ ...t, welcome_message: e.target.value }))} placeholder="You have been invited to join our team..." /></div>
            <div className="form-group"><label>Signature</label><input value={emailTemplate.signature} onChange={e => setEmailTemplate(t => ({ ...t, signature: e.target.value }))} placeholder="The Management Team" /></div>
            <button className="btn btn-secondary btn-sm" onClick={() => setEmailPreview(true)}>Preview Email</button>
            {emailPreview && (
              <div style={{ marginTop: 16, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-bg)', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>EMAIL PREVIEW</div>
                <div style={{ padding: 16, background: '#F4F6F9' }}>
                  <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ background: emailTemplate.accent_color || '#0A6EBD', padding: '24px', textAlign: 'center' }}>
                      {emailTemplate.logo_url && <img src={emailTemplate.logo_url} style={{ height: 36, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />}
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{config.company_name || 'StaffForce'}</div>
                    </div>
                    <div style={{ padding: '24px 28px' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Welcome, John!</div>
                      <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{emailTemplate.welcome_message || `You have been added to ${config.company_name || 'StaffForce'}. Click the button below to activate your account.`}</p>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', background: emailTemplate.accent_color || '#0A6EBD', color: '#fff', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Activate My Account</div>
                      </div>
                    </div>
                    <div style={{ background: '#F9FAFB', padding: '14px 28px', textAlign: 'center', borderTop: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{emailTemplate.signature || (smtpCfg.sender_name || 'StaffForce') + ' Team'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEmailPreview(false)}>Close Preview</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* THEME */}
        {activeTab === 5 && (
          <div className="card">
            <SectionTitle title="Theme Settings" />
            <div className="form-row">
              <ColorRow label="Background" key="bg" />
              <ColorRow label="Accent" key="accent" />
            </div>
            <div className="form-row">
              <ColorRow label="Sidebar" key="sidebar" />
              <ColorRow label="Success" key="success" />
            </div>
            <div className="form-row">
              <ColorRow label="Danger" key="danger" />
              <ColorRow label="Warning" key="warning" />
            </div>
          </div>
        )}

        {/* PERMISSIONS */}
        {activeTab === 6 && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <SectionTitle title="Employee Module Visibility" />
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Choose which modules employees can see. Admins and Managers always have full access.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ALL_MODULES.map(m => (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontWeight: 500, fontSize: 13 }}>
                      <input type="checkbox" checked={employeeModules.includes(m.key)} onChange={() => toggleModule(m.key)} style={{ width: 16, height: 16 }} />
                      Visible to employees
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <SectionTitle title="Users and Roles" />
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Email</th><th>Role</th></tr></thead>
                  <tbody>
                    {employees.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{empName(e)}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{e.email}</td>
                        <td>
                          <select value={e.role} onChange={ev => updateEmpRole(e.id, ev.target.value)} style={{ width: 130 }}>
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DATA */}
        {activeTab === 7 && (
          <div className="card">
            <SectionTitle title="Export Data" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={async () => { const { data } = await supabase.from('employees').select('*'); downloadBlob(JSON.stringify(data, null, 2), 'employees.json', 'application/json') }}>Export Employees JSON</button>
              <button className="btn btn-secondary" onClick={async () => { const { data } = await supabase.from('time_entries').select('*'); downloadBlob(JSON.stringify(data, null, 2), 'timesheets.json', 'application/json') }}>Export Timesheets JSON</button>
              <button className="btn btn-secondary" onClick={async () => { const { data } = await supabase.from('payroll_entries').select('*'); downloadBlob(JSON.stringify(data, null, 2), 'payroll.json', 'application/json') }}>Export Payroll JSON</button>
            </div>
          </div>
        )}

        {/* Save button */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={saveConfig}>Save Settings</button>
          {saved && <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 13 }}>{saved}</span>}
        </div>
      </div>
    </div>
  )
}
