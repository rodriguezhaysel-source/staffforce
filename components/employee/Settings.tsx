import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Btn, Inp, Sel, C, Toggle, Alert, PageHeader, SectionLabel } from '../ui'
import type { Employee, Department } from '../../types'

interface Props { user: Employee; lang: string; departments: Department[] }

export default function Settings({ user, lang, departments }: Props) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [testEmail, setTestEmail] = useState(user.email || '')
  const [tab, setTab] = useState(0)
  const TABS = ['Company', 'Payroll', 'Email & SMTP', 'Automation', 'Modules']

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('app_config').select('*').limit(1)
    if (data?.[0]) setCfg(data[0])
    else {
      const def = { company_name: 'StaffForce', geofencing_enabled: true, payroll_config: {}, smtp_config: {}, email_template: {}, auto_config: {}, auto_rules: {}, employee_modules: {} }
      await supabase.from('app_config').insert(def)
      setCfg(def)
    }
  }

  async function save() {
    setSaving(true)
    if (cfg.id) await supabase.from('app_config').update(cfg).eq('id', cfg.id)
    else await supabase.from('app_config').insert(cfg)
    setSaving(false)
    setTestResult('Settings saved.')
    setTimeout(() => setTestResult(''), 3000)
  }

  async function sendTestEmail() {
    if (!testEmail) return
    setTestingEmail(true)
    setTestResult('')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: 'StaffForce — SMTP Test',
          html: `<p>This is a test email from StaffForce. Your SMTP configuration is working correctly.</p>`
        })
      })
      const data = await res.json()
      setTestResult(data.success ? '✓ Test email sent successfully!' : '✗ Error: ' + (data.error || 'Failed'))
    } catch (e: any) {
      setTestResult('✗ Error: ' + e.message)
    }
    setTestingEmail(false)
  }

  function updateSmtp(key: string, val: any) {
    setCfg((c: any) => ({ ...c, smtp_config: { ...c.smtp_config, [key]: val } }))
  }
  function updatePayroll(key: string, val: any) {
    setCfg((c: any) => ({ ...c, payroll_config: { ...c.payroll_config, [key]: val } }))
  }
  function updateAuto(key: string, val: any) {
    setCfg((c: any) => ({ ...c, auto_config: { ...c.auto_config, [key]: val } }))
  }
  function updateModules(key: string, val: any) {
    setCfg((c: any) => ({ ...c, employee_modules: { ...c.employee_modules, [key]: val } }))
  }
  function updateEmailTpl(key: string, val: any) {
    setCfg((c: any) => ({ ...c, email_template: { ...c.email_template, [key]: val } }))
  }

  if (!cfg) return <div style={{ padding: 40, textAlign: 'center', color: C.textSub }}>Loading settings...</div>

  return (
    <div>
      <PageHeader title="Settings" sub="Configure your StaffForce workspace">
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</Btn>
      </PageHeader>

      {testResult && <Alert type={testResult.startsWith('✓') ? 'success' : testResult.startsWith('✗') ? 'error' : 'info'}>{testResult}</Alert>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '10px 18px', border: 'none', borderBottom: tab === i ? `2px solid ${C.accent}` : '2px solid transparent', background: 'transparent', fontSize: 13, fontWeight: tab === i ? 800 : 500, color: tab === i ? C.accent : C.textSub, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as any }}>
            {t}
          </button>
        ))}
      </div>

      {/* COMPANY */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionLabel>Company Information</SectionLabel>
            <Inp label="Company Name" value={cfg.company_name || ''} onChange={e => setCfg((c: any) => ({ ...c, company_name: e.target.value }))} />
            <Inp label="Owner Email" value={cfg.owner_email || ''} onChange={e => setCfg((c: any) => ({ ...c, owner_email: e.target.value }))} />
          </Card>
          <Card>
            <SectionLabel>Features</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Toggle value={!!cfg.geofencing_enabled} onChange={v => setCfg((c: any) => ({ ...c, geofencing_enabled: v }))} label="GPS Geofencing for Clock In/Out" />
            </div>
          </Card>
        </div>
      )}

      {/* PAYROLL */}
      {tab === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionLabel>Overtime Rules</SectionLabel>
            <Inp label="Daily OT Threshold (hours)" type="number" value={cfg.payroll_config?.daily_ot_threshold ?? 8} onChange={e => updatePayroll('daily_ot_threshold', Number(e.target.value))} />
            <Inp label="Weekly OT Threshold (hours)" type="number" value={cfg.payroll_config?.weekly_ot_threshold ?? 40} onChange={e => updatePayroll('weekly_ot_threshold', Number(e.target.value))} />
            <Inp label="OT Multiplier (e.g. 1.5)" type="number" value={cfg.payroll_config?.ot_multiplier ?? 1.5} onChange={e => updatePayroll('ot_multiplier', Number(e.target.value))} />
          </Card>
          <Card>
            <SectionLabel>Tax & Deduction Rates</SectionLabel>
            <Inp label="Federal Tax Rate (e.g. 0.12)" type="number" value={cfg.payroll_config?.federal_tax_rate ?? 0.12} onChange={e => updatePayroll('federal_tax_rate', Number(e.target.value))} />
            <Inp label="FICA Rate (e.g. 0.0765)" type="number" value={cfg.payroll_config?.fica_rate ?? 0.0765} onChange={e => updatePayroll('fica_rate', Number(e.target.value))} />
            <Inp label="State Tax Rate (e.g. 0.04)" type="number" value={cfg.payroll_config?.state_tax_rate ?? 0.04} onChange={e => updatePayroll('state_tax_rate', Number(e.target.value))} />
            <Inp label="Health Insurance Fixed ($)" type="number" value={cfg.payroll_config?.health_insurance_fixed ?? 50} onChange={e => updatePayroll('health_insurance_fixed', Number(e.target.value))} />
            <Inp label="401k Rate (e.g. 0.03)" type="number" value={cfg.payroll_config?.retirement_401k_rate ?? 0.03} onChange={e => updatePayroll('retirement_401k_rate', Number(e.target.value))} />
          </Card>
        </div>
      )}

      {/* EMAIL & SMTP */}
      {tab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionLabel>SMTP Server Configuration</SectionLabel>
            <Inp label="SMTP Host" value={cfg.smtp_config?.host || ''} onChange={e => updateSmtp('host', e.target.value)} placeholder="smtp.sendgrid.net" />
            <Inp label="SMTP Port" type="number" value={cfg.smtp_config?.port || 587} onChange={e => updateSmtp('port', Number(e.target.value))} />
            <Inp label="Username / API Key" value={cfg.smtp_config?.user || ''} onChange={e => updateSmtp('user', e.target.value)} placeholder="apikey" />
            <Inp label="Password" type="password" value={cfg.smtp_config?.pass || ''} onChange={e => updateSmtp('pass', e.target.value)} placeholder="••••••••" />
            <Inp label="Sender Name" value={cfg.smtp_config?.sender_name || ''} onChange={e => updateSmtp('sender_name', e.target.value)} placeholder="StaffForce" />
            <Inp label="Sender Email" value={cfg.smtp_config?.sender_email || ''} onChange={e => updateSmtp('sender_email', e.target.value)} placeholder="noreply@company.com" />
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <SectionLabel>Email Template</SectionLabel>
              <Inp label="Accent Color (hex)" value={cfg.email_template?.accent_color || '#0A6EBD'} onChange={e => updateEmailTpl('accent_color', e.target.value)} placeholder="#0A6EBD" />
              <Inp label="Logo URL" value={cfg.email_template?.logo_url || ''} onChange={e => updateEmailTpl('logo_url', e.target.value)} placeholder="https://..." />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>Welcome Message</label>
                <textarea value={cfg.email_template?.welcome_message || ''} onChange={e => updateEmailTpl('welcome_message', e.target.value)} rows={3} placeholder="You have been invited to join..." style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any }} />
              </div>
              <Inp label="Email Signature" value={cfg.email_template?.signature || ''} onChange={e => updateEmailTpl('signature', e.target.value)} placeholder="The HR Team" />
            </Card>
            <Card>
              <SectionLabel>Test SMTP Connection</SectionLabel>
              <Inp label="Send test to email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" />
              <Btn variant="primary" onClick={sendTestEmail} disabled={testingEmail} full>{testingEmail ? 'Sending...' : 'Send Test Email'}</Btn>
            </Card>
          </div>
        </div>
      )}

      {/* AUTOMATION */}
      {tab === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionLabel>Automatic Actions</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Toggle value={!!cfg.auto_config?.auto_clockout} onChange={v => updateAuto('auto_clockout', v)} label="Auto clock-out at shift end" />
              <Toggle value={!!cfg.auto_config?.overtime_alert} onChange={v => updateAuto('overtime_alert', v)} label="Alert manager when employee exceeds daily OT" />
              <Toggle value={!!cfg.auto_config?.late_alert} onChange={v => updateAuto('late_alert', v)} label="Alert manager when employee is late" />
              <Toggle value={!!cfg.auto_config?.pto_auto_approve} onChange={v => updateAuto('pto_auto_approve', v)} label="Auto-approve PTO requests" />
              <Toggle value={!!cfg.auto_config?.send_schedule_notifications} onChange={v => updateAuto('send_schedule_notifications', v)} label="Send email when schedule is published" />
              <Toggle value={!!cfg.auto_config?.daily_mood_reminder} onChange={v => updateAuto('daily_mood_reminder', v)} label="Send daily mood check-in reminder" />
            </div>
          </Card>
          <Card>
            <SectionLabel>Thresholds</SectionLabel>
            <Inp label="Late alert after (minutes)" type="number" value={cfg.auto_config?.late_threshold_mins ?? 15} onChange={e => updateAuto('late_threshold_mins', Number(e.target.value))} />
            <Inp label="OT alert after (hours/day)" type="number" value={cfg.auto_config?.ot_alert_hours ?? 8} onChange={e => updateAuto('ot_alert_hours', Number(e.target.value))} />
            <Inp label="PTO auto-approve under (days)" type="number" value={cfg.auto_config?.pto_auto_days ?? 2} onChange={e => updateAuto('pto_auto_days', Number(e.target.value))} />
          </Card>
        </div>
      )}

      {/* MODULES */}
      {tab === 4 && (
        <Card>
          <SectionLabel>Employee Portal Modules</SectionLabel>
          <p style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>Control which modules are visible to employees in their sidebar.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['clock', 'Clock In/Out'],
              ['schedule', 'Schedule'],
              ['timesheets', 'Timesheets'],
              ['timeoff', 'Time Off'],
              ['availability', 'Availability'],
              ['shiftswap', 'Shift Swap'],
              ['payroll', 'Payroll (self)'],
              ['documents', 'Documents'],
              ['messaging', 'Messaging'],
              ['recognitions', 'Recognitions'],
              ['announcements', 'Announcements'],
              ['moodcheckin', 'Mood Check-in'],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                value={cfg.employee_modules?.[key] !== false}
                onChange={v => updateModules(key, v)}
                label={label}
              />
            ))}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</Btn>
      </div>
    </div>
  )
}
