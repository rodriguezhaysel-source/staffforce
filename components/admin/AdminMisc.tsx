// ── AdminAuditLog ──────────────────────────────────────────
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName } from '../../lib/utils'
import { ACard, APageHeader, AEmpty, AC } from './ui'
import type { Employee } from '../../types'

interface AuditProps { user: Employee; employees: Employee[] }

export function AdminAuditLog({ user, employees }: AuditProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  const actionColors: Record<string, string> = {
    INSERT: AC.success, UPDATE: AC.warning, DELETE: AC.danger,
    LOGIN: AC.accent, APPROVE: AC.success, REJECT: AC.danger,
  }

  return (
    <div>
      <APageHeader title="Audit Log" sub="Every change made in the system — who, what, when" />
      <ACard pad={0}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-th">Time</th>
                <th className="adm-th">User</th>
                <th className="adm-th">Action</th>
                <th className="adm-th">Table</th>
                <th className="adm-th">Record</th>
                <th className="adm-th">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const emp = employees.find(e => e.id === log.employee_id)
                const color = actionColors[log.action?.toUpperCase()] || AC.muted
                return (
                  <tr key={log.id} className="adm-tr">
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: AC.sub }}>
                      {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : '—'}
                    </td>
                    <td className="adm-td">
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{emp ? empName(emp) : log.employee_id?.slice(0, 8) || 'System'}</div>
                      {emp && <div style={{ fontSize: 10, color: AC.sub }}>{emp.role}</div>}
                    </td>
                    <td className="adm-td">
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: color + '18', color }}>{log.action?.toUpperCase() || '—'}</span>
                    </td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{log.table_name || '—'}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.sub }}>{log.record_id?.slice(0, 8) || '—'}</td>
                    <td className="adm-td" style={{ fontSize: 11, color: AC.sub, maxWidth: 200 }}>
                      {log.new_data ? JSON.stringify(log.new_data).slice(0, 80) + '...' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && logs.length === 0 && <AEmpty title="No audit logs yet" sub="Actions will be recorded here" />}
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: AC.muted }}>Loading...</div>}
        </div>
      </ACard>
    </div>
  )
}

// ── AdminSettings (owner panel) ────────────────────────────
interface SettingsProps { user: Employee }

export function AdminSettings({ user }: SettingsProps) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [testEmail, setTestEmail] = useState(user.email || '')
  const [tab, setTab] = useState(0)
  const TABS = ['Company', 'Payroll', 'Email & SMTP', 'Automation', 'Departments']

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('app_config').select('*').limit(1)
    if (data?.[0]) setCfg(data[0])
    else {
      const def = { company_name: 'StaffForce', geofencing_enabled: true, payroll_config: {}, smtp_config: {}, email_template: {}, auto_config: {} }
      await supabase.from('app_config').insert(def)
      setCfg(def)
    }
  }

  async function save() {
    setSaving(true)
    if (cfg.id) await supabase.from('app_config').update(cfg).eq('id', cfg.id)
    setSaving(false)
    setTestResult('✓ Settings saved.')
    setTimeout(() => setTestResult(''), 3000)
  }

  async function sendTest() {
    if (!testEmail) return
    setTestingEmail(true)
    try {
      const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: testEmail, subject: 'StaffForce — SMTP Test', html: '<p>SMTP is working correctly.</p>' }) })
      const d = await res.json()
      setTestResult(d.success ? '✓ Test email sent!' : '✗ ' + d.error)
    } catch (e: any) { setTestResult('✗ ' + e.message) }
    setTestingEmail(false)
  }

  function upd(key: string, val: any) { setCfg((c: any) => ({ ...c, [key]: val })) }
  function updSub(root: string, key: string, val: any) { setCfg((c: any) => ({ ...c, [root]: { ...c[root], [key]: val } })) }

  if (!cfg) return <div style={{ padding: 40, textAlign: 'center', color: AC.muted }}>Loading settings...</div>

  return (
    <div>
      <APageHeader title="Settings" sub="System-wide configuration">
        <button onClick={save} disabled={saving} className="adm-btn adm-btn-primary">
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </APageHeader>

      {testResult && (
        <div className={`adm-alert ${testResult.startsWith('✓') ? 'adm-alert-success' : 'adm-alert-error'}`}>{testResult}</div>
      )}

      <div className="adm-tabs">
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`adm-tab${tab === i ? ' active' : ''}`}>{t}</button>)}
      </div>

      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Company</div>
            <div className="adm-form-group"><label className="adm-label">Company Name</label><input className="adm-input" value={cfg.company_name || ''} onChange={e => upd('company_name', e.target.value)} /></div>
            <div className="adm-form-group"><label className="adm-label">Owner Email</label><input className="adm-input" value={cfg.owner_email || ''} onChange={e => upd('owner_email', e.target.value)} /></div>
          </ACard>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'GPS Geofencing', key: 'geofencing_enabled' },
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{f.label}</span>
                  <div onClick={() => upd(f.key, !cfg[f.key])} style={{ width: 44, height: 24, borderRadius: 12, background: cfg[f.key] ? AC.accent : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: cfg[f.key] ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </ACard>
        </div>
      )}

      {tab === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Overtime Rules</div>
            {[
              { label: 'Daily OT Threshold (hrs)', key: 'daily_ot_threshold', default: 8 },
              { label: 'Weekly OT Threshold (hrs)', key: 'weekly_ot_threshold', default: 40 },
              { label: 'OT Multiplier (e.g. 1.5)', key: 'ot_multiplier', default: 1.5 },
            ].map(f => (
              <div key={f.key} className="adm-form-group">
                <label className="adm-label">{f.label}</label>
                <input className="adm-input" type="number" value={cfg.payroll_config?.[f.key] ?? f.default} onChange={e => updSub('payroll_config', f.key, Number(e.target.value))} />
              </div>
            ))}
          </ACard>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Tax & Deductions</div>
            {[
              { label: 'Federal Tax Rate', key: 'federal_tax_rate', default: 0.12 },
              { label: 'FICA Rate', key: 'fica_rate', default: 0.0765 },
              { label: 'State Tax Rate', key: 'state_tax_rate', default: 0.04 },
              { label: 'Health Insurance Fixed ($)', key: 'health_insurance_fixed', default: 50 },
              { label: '401k Rate', key: 'retirement_401k_rate', default: 0.03 },
            ].map(f => (
              <div key={f.key} className="adm-form-group">
                <label className="adm-label">{f.label}</label>
                <input className="adm-input" type="number" value={cfg.payroll_config?.[f.key] ?? f.default} onChange={e => updSub('payroll_config', f.key, Number(e.target.value))} />
              </div>
            ))}
          </ACard>
        </div>
      )}

      {tab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>SMTP Server</div>
            {[
              { label: 'SMTP Host', key: 'host', placeholder: 'smtp.sendgrid.net' },
              { label: 'SMTP Port', key: 'port', placeholder: '587' },
              { label: 'Username / API Key', key: 'user', placeholder: 'apikey' },
              { label: 'Password', key: 'pass', placeholder: '••••••••' },
              { label: 'Sender Name', key: 'sender_name', placeholder: 'StaffForce' },
              { label: 'Sender Email', key: 'sender_email', placeholder: 'noreply@company.com' },
            ].map(f => (
              <div key={f.key} className="adm-form-group">
                <label className="adm-label">{f.label}</label>
                <input className="adm-input" type={f.key === 'pass' ? 'password' : 'text'} value={cfg.smtp_config?.[f.key] || ''} onChange={e => updSub('smtp_config', f.key, e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
          </ACard>
          <ACard>
            <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Test Connection</div>
            <div className="adm-form-group"><label className="adm-label">Send Test To</label><input className="adm-input" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} /></div>
            <button onClick={sendTest} disabled={testingEmail} className="adm-btn adm-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {testingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
          </ACard>
        </div>
      )}

      {tab === 3 && (
        <ACard>
          <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 14 }}>Automatic Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Auto clock-out at shift end', key: 'auto_clockout' },
              { label: 'Alert when employee late', key: 'late_alert' },
              { label: 'Alert on daily overtime', key: 'overtime_alert' },
              { label: 'Auto-approve PTO requests', key: 'pto_auto_approve' },
              { label: 'Email when schedule published', key: 'send_schedule_notifications' },
              { label: 'Daily mood check-in reminder', key: 'daily_mood_reminder' },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid #F3F4F6` }}>
                <span style={{ fontSize: 13 }}>{f.label}</span>
                <div onClick={() => updSub('auto_config', f.key, !cfg.auto_config?.[f.key])} style={{ width: 44, height: 24, borderRadius: 12, background: cfg.auto_config?.[f.key] ? AC.accent : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: cfg.auto_config?.[f.key] ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            ))}
          </div>
        </ACard>
      )}

      {tab === 4 && <DepartmentManager />}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} className="adm-btn adm-btn-primary">{saving ? 'Saving...' : 'Save All Settings'}</button>
      </div>
    </div>
  )
}

// ── DepartmentManager ──────────────────────────────────────
function DepartmentManager() {
  const [depts, setDepts] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', color: '#2563EB' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
  }
  async function add() {
    if (!form.name) return
    await supabase.from('departments').insert(form)
    setForm({ name: '', color: '#2563EB' }); setAdding(false); load()
  }
  async function del(id: string) {
    if (!confirm('Delete this department?')) return
    await supabase.from('departments').delete().eq('id', id); load()
  }
  async function updateColor(id: string, color: string) {
    await supabase.from('departments').update({ color }).eq('id', id); load()
  }

  return (
    <ACard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px' }}>Departments</div>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '12px', background: '#F9FAFB', borderRadius: 8 }}>
          <input placeholder="Department name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="adm-input" style={{ flex: 1 }} />
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 40, height: 38, borderRadius: 6, border: `1.5px solid ${AC.border}`, cursor: 'pointer', padding: 2 }} />
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={add}>Add</button>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {depts.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${AC.border}`, borderRadius: 8 }}>
            <input type="color" value={d.color || '#2563EB'} onChange={e => updateColor(d.id, e.target.value)} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 2 }} />
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{d.name}</div>
            <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => del(d.id)}>Delete</button>
          </div>
        ))}
      </div>
    </ACard>
  )
}
