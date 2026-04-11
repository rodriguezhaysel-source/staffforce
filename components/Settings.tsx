import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { downloadBlob } from './shared/utils'
import { empName } from './shared/utils'
import type { Employee, AppConfig, Department } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; setEmployees: (e: Employee[]) => void }

export default function Settings({ user, lang, employees, departments, setEmployees }: Props) {
  const [config, setConfig] = useState<Partial<AppConfig>>({ company_name: 'StaffForce', geofencing_enabled: true })
  const [payrollCfg, setPayrollCfg] = useState({ daily_ot_threshold: 8, weekly_ot_threshold: 40, ot_multiplier: 1.5, federal_tax_rate: 0.12, fica_rate: 0.0765, state_tax_rate: 0.04, health_insurance_fixed: 50, retirement_401k_rate: 0.03 })
  const [theme, setTheme] = useState({ bg: '#F4F6F9', accent: '#0A6EBD', sidebar: '#0F1A2E', success: '#059669', danger: '#DC2626', warning: '#D97706' })
  const [depts, setDepts] = useState<Department[]>(departments)
  const [newDept, setNewDept] = useState({ name: '', color: '#0A6EBD' })
  const [saved, setSaved] = useState('')

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('*').limit(1)
    if (data && data.length > 0) {
      const cfg = data[0]
      setConfig(cfg)
      if (cfg.payroll_config) setPayrollCfg(cfg.payroll_config)
      if (cfg.theme) setTheme(cfg.theme)
    }
  }

  async function saveConfig() {
    const payload = { ...config, payroll_config: payrollCfg, theme }
    const { data: existing } = await supabase.from('app_config').select('id').limit(1)
    if (existing && existing.length > 0) {
      await supabase.from('app_config').update(payload).eq('id', existing[0].id)
    } else {
      await supabase.from('app_config').insert(payload)
    }
    applyTheme(theme)
    setSaved('Saved!'); setTimeout(() => setSaved(''), 2000)
  }

  function applyTheme(t: typeof theme) {
    const root = document.documentElement
    root.style.setProperty('--color-bg', t.bg)
    root.style.setProperty('--color-accent', t.accent)
    root.style.setProperty('--color-sidebar', t.sidebar)
    root.style.setProperty('--color-success', t.success)
    root.style.setProperty('--color-danger', t.danger)
    root.style.setProperty('--color-warning', t.warning)
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
    const { data } = await supabase.from('departments').select('*')
    setDepts(data || [])
  }

  async function exportEmployeesJson() {
    const { data } = await supabase.from('employees').select('*')
    downloadBlob(JSON.stringify(data, null, 2), 'employees.json', 'application/json')
  }

  async function exportTimesheetsJson() {
    const { data } = await supabase.from('time_entries').select('*')
    downloadBlob(JSON.stringify(data, null, 2), 'timesheets.json', 'application/json')
  }

  async function updateEmpRole(id: string, role: string) {
    await supabase.from('employees').update({ role }).eq('id', id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  const SectionTitle = ({ title }: { title: string }) => (
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid var(--color-border)' }}>{title}</div>
  )

  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Company */}
      <div className="card">
        <SectionTitle title="Company" />
        <div className="form-group"><label>{t(lang, 'companyName')}</label><input value={config.company_name || ''} onChange={e => setConfig(c => ({ ...c, company_name: e.target.value }))} /></div>
        <div className="form-group">
          <label>{t(lang, 'geofencingEnabled')}</label>
          <select value={config.geofencing_enabled ? 'true' : 'false'} onChange={e => setConfig(c => ({ ...c, geofencing_enabled: e.target.value === 'true' }))}>
            <option value="true">Enabled</option><option value="false">Disabled</option>
          </select>
        </div>
      </div>

      {/* Payroll Rules */}
      <div className="card">
        <SectionTitle title={t(lang, 'taxRates')} />
        <div className="form-row">
          <div className="form-group"><label>Daily OT After (hrs)</label><input type="number" step="0.5" value={payrollCfg.daily_ot_threshold} onChange={e => setPayrollCfg(p => ({ ...p, daily_ot_threshold: Number(e.target.value) }))} /></div>
          <div className="form-group"><label>Weekly OT After (hrs)</label><input type="number" value={payrollCfg.weekly_ot_threshold} onChange={e => setPayrollCfg(p => ({ ...p, weekly_ot_threshold: Number(e.target.value) }))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>OT Multiplier</label><input type="number" step="0.1" value={payrollCfg.ot_multiplier} onChange={e => setPayrollCfg(p => ({ ...p, ot_multiplier: Number(e.target.value) }))} /></div>
          <div className="form-group"><label>Federal Tax Rate</label><input type="number" step="0.01" value={payrollCfg.federal_tax_rate} onChange={e => setPayrollCfg(p => ({ ...p, federal_tax_rate: Number(e.target.value) }))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>FICA Rate</label><input type="number" step="0.0001" value={payrollCfg.fica_rate} onChange={e => setPayrollCfg(p => ({ ...p, fica_rate: Number(e.target.value) }))} /></div>
          <div className="form-group"><label>State Tax Rate</label><input type="number" step="0.01" value={payrollCfg.state_tax_rate} onChange={e => setPayrollCfg(p => ({ ...p, state_tax_rate: Number(e.target.value) }))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Health Insurance (fixed $)</label><input type="number" value={payrollCfg.health_insurance_fixed} onChange={e => setPayrollCfg(p => ({ ...p, health_insurance_fixed: Number(e.target.value) }))} /></div>
          <div className="form-group"><label>401k Rate</label><input type="number" step="0.01" value={payrollCfg.retirement_401k_rate} onChange={e => setPayrollCfg(p => ({ ...p, retirement_401k_rate: Number(e.target.value) }))} /></div>
        </div>
      </div>

      {/* Theme */}
      <div className="card">
        <SectionTitle title={t(lang, 'themeSettings')} />
        <div className="form-row">
          <div className="form-group"><label>Background</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.bg} onChange={e => { setTheme(t => ({ ...t, bg: e.target.value })); document.documentElement.style.setProperty('--color-bg', e.target.value) }} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.bg} onChange={e => setTheme(t => ({ ...t, bg: e.target.value }))} style={{ flex: 1 }} /></div></div>
          <div className="form-group"><label>Accent</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.accent} onChange={e => { setTheme(t => ({ ...t, accent: e.target.value })); document.documentElement.style.setProperty('--color-accent', e.target.value) }} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.accent} onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))} style={{ flex: 1 }} /></div></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Sidebar</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.sidebar} onChange={e => { setTheme(t => ({ ...t, sidebar: e.target.value })); document.documentElement.style.setProperty('--color-sidebar', e.target.value) }} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.sidebar} onChange={e => setTheme(t => ({ ...t, sidebar: e.target.value }))} style={{ flex: 1 }} /></div></div>
          <div className="form-group"><label>Success</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.success} onChange={e => setTheme(t => ({ ...t, success: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.success} onChange={e => setTheme(t => ({ ...t, success: e.target.value }))} style={{ flex: 1 }} /></div></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Danger</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.danger} onChange={e => setTheme(t => ({ ...t, danger: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.danger} onChange={e => setTheme(t => ({ ...t, danger: e.target.value }))} style={{ flex: 1 }} /></div></div>
          <div className="form-group"><label>Warning</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={theme.warning} onChange={e => setTheme(t => ({ ...t, warning: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} /><input value={theme.warning} onChange={e => setTheme(t => ({ ...t, warning: e.target.value }))} style={{ flex: 1 }} /></div></div>
        </div>
      </div>

      {/* Departments */}
      <div className="card">
        <SectionTitle title="Departments" />
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <input value={newDept.name} onChange={e => setNewDept(d => ({ ...d, name: e.target.value }))} placeholder="Department name" style={{ flex: 1 }} />
          <input type="color" value={newDept.color} onChange={e => setNewDept(d => ({ ...d, color: e.target.value }))} style={{ width: 44, height: 36, padding: 2 }} />
          <button className="btn btn-primary btn-sm" onClick={addDept}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {depts.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{d.name}</span>
              <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)} style={{ padding: '3px 8px', fontSize: 11 }}>Remove</button>
            </div>
          ))}
          {depts.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No departments yet</div>}
        </div>
      </div>

      {/* Users & Roles */}
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

      {/* Data Export */}
      <div className="card">
        <SectionTitle title={t(lang, 'exportData')} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportEmployeesJson}>{t(lang, 'exportEmployees')}</button>
          <button className="btn btn-secondary" onClick={exportTimesheetsJson}>{t(lang, 'exportTimesheets')}</button>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={saveConfig}>{t(lang, 'save')}</button>
        {saved && <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 13 }}>{saved}</span>}
      </div>
    </div>
  )
}
