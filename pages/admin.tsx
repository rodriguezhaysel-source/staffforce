import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  format, startOfWeek, addDays, addWeeks, subWeeks,
  differenceInMinutes, endOfMonth, eachDayOfInterval,
  isToday, startOfMonth
} from 'date-fns'
import { calculateHours, calculatePay, generateNACHA } from '../lib/payroll'
import { fmtMoney, empName, entryHours, downloadBlob } from '../components/shared/utils'
import type {
  Employee, Department, Location, Shift,
  TimeEntry, TimeOff, PayrollPeriod, PayrollEntry
} from '../lib/store'

// ─── Owner creds (changeable from panel) ─────────────────
const DEFAULT_OWNER_EMAIL = 'rodriguezhaysel@gmail.com'
const DEFAULT_OWNER_PASSWORD = 'sovel2026'

// ─── Types ───────────────────────────────────────────────
interface PanelUser {
  id: string
  employee_id: string
  email: string
  password_hash: string
  full_name: string
  status: string
  created_by: string
  created_at: string
  last_login_at: string
}

interface AuditEntry {
  id: string
  panel_user_email: string
  panel_user_name: string
  action: string
  module: string
  details: any
  created_at: string
}

type Mod = 'command' | 'schedule' | 'timesheets' | 'timeoff' |
  'employees' | 'payroll' | 'reports' | 'users' | 'audit' | 'settings'

// ─── Audit helper ─────────────────────────────────────────
async function logAudit(user: PanelUser, action: string, module: string, details?: any) {
  await supabase.from('panel_audit_log').insert({
    panel_user_id: user.id,
    panel_user_email: user.email,
    panel_user_name: user.full_name,
    action, module,
    details: details || {},
    created_at: new Date().toISOString(),
  })
}

// ─── Inline SVG icons ─────────────────────────────────────
function Svg({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

const IC: Record<string, string> = {
  command:    'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  schedule:   'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  timesheets: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  timeoff:    'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z',
  employees:  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  payroll:    'M2 7h20v14H2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4',
  reports:    'M18 20V10M12 20V4M6 20v-6',
  users:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  audit:      'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  settings:   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  logout:     'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus:       'M12 5v14M5 12h14',
  check:      'M20 6L9 17l-5-5',
  x:          'M18 6L6 18M6 6l12 12',
  eye:        'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  shield:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  key:        'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  download:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  refresh:    'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  alert:      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  clock:      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  chevL:      'M15 18l-6-6 6-6',
  chevR:      'M9 18l6-6-6-6',
  ban:        'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636',
}

// ─── Shared UI ────────────────────────────────────────────
const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, style = {} }: any) => {
  const variants: any = {
    primary:   { background: '#2563EB', color: '#fff', border: 'none' },
    secondary: { background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0' },
    success:   { background: '#059669', color: '#fff', border: 'none' },
    danger:    { background: '#DC2626', color: '#fff', border: 'none' },
    warning:   { background: '#D97706', color: '#fff', border: 'none' },
    ghost:     { background: 'transparent', color: '#2563EB', border: '1px solid #2563EB' },
  }
  const sizes: any = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 18px', fontSize: 13 },
    lg: { padding: '12px 28px', fontSize: 15 },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...variants[variant], ...sizes[size],
      borderRadius: 7, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center',
      gap: 6, fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  )
}

const Card = ({ children, style = {} }: any) => (
  <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>
    {children}
  </div>
)

const SectionTitle = ({ children }: any) => (
  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>{children}</div>
)

const Input = ({ label, type = 'text', value, onChange, placeholder = '', style = {} }: any) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#111', ...style }}
      onFocus={e => e.target.style.borderColor = '#2563EB'}
      onBlur={e => e.target.style.borderColor = '#E2E8F0'}
    />
  </div>
)

const Badge = ({ children, color = 'blue' }: any) => {
  const colors: any = {
    blue:   { bg: '#DBEAFE', text: '#1D4ED8' },
    green:  { bg: '#D1FAE5', text: '#065F46' },
    red:    { bg: '#FEE2E2', text: '#991B1B' },
    yellow: { bg: '#FEF3C7', text: '#92400E' },
    gray:   { bg: '#F1F5F9', text: '#475569' },
  }
  const c = colors[color] || colors.blue
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
      {children}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════
function AdminLogin({ onLogin }: { onLogin: (user: PanelUser, isOwner: boolean) => void }) {
  const [tab, setTab] = useState<'owner' | 'user'>('owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleOwnerLogin() {
    setError(''); setLoading(true)
    const { data: cfg } = await supabase.from('app_config').select('owner_email,owner_password').limit(1)
    const ownerEmail = cfg?.[0]?.owner_email || DEFAULT_OWNER_EMAIL
    const ownerPass = cfg?.[0]?.owner_password || DEFAULT_OWNER_PASSWORD
    if (email.trim().toLowerCase() === ownerEmail && password.trim() === ownerPass) {
      onLogin({ id: 'owner', employee_id: '', email: ownerEmail, password_hash: '', full_name: 'Owner', status: 'active', created_by: 'system', created_at: '', last_login_at: '' }, true)
    } else {
      setError('Invalid owner credentials')
    }
    setLoading(false)
  }

  async function handlePanelLogin() {
    setError(''); setLoading(true)
    const { data } = await supabase.from('panel_users').select('*').eq('email', email.trim().toLowerCase()).eq('status', 'active')
    const users: PanelUser[] = data || []
    const user = users.find(u => u.password_hash === password.trim())
    if (user) {
      await supabase.from('panel_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
      await supabase.from('panel_audit_log').insert({ panel_user_id: user.id, panel_user_email: user.email, panel_user_name: user.full_name, action: 'LOGIN', module: 'AUTH', details: {}, created_at: new Date().toISOString() })
      onLogin(user, false)
    } else {
      setError('Invalid credentials or account suspended')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)', fontFamily: "'Inter', sans-serif" }}>
      {/* Left branding */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', color: '#fff' }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 56 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
              <Svg path={IC.shield} size={24} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>StaffForce</div>
              <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Control Panel</div>
            </div>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1.5px' }}>
            Business<br /><span style={{ color: '#60A5FA' }}>Command Center</span>
          </h1>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.8, marginBottom: 52 }}>
            Full control over your workforce operations. Schedule, payroll, team management and complete audit trail of every action.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { icon: IC.shield, text: 'Role-based access control with audit log' },
              { icon: IC.reports, text: 'Real-time labor analytics and reporting' },
              { icon: IC.payroll, text: 'Automated payroll processing and direct deposit' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', flexShrink: 0 }}>
                  <Svg path={item.icon} size={16} />
                </div>
                <span style={{ fontSize: 14, color: '#CBD5E1', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div style={{ width: 500, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 52px', boxShadow: '-24px 0 80px rgba(0,0,0,0.3)' }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', marginBottom: 6, letterSpacing: '-0.5px' }}>Panel Access</h2>
          <p style={{ fontSize: 14, color: '#64748B' }}>Sign in to manage your business operations</p>
        </div>

        {/* Tab */}
        <div style={{ display: 'flex', background: '#F8FAFC', borderRadius: 10, padding: 4, marginBottom: 28, border: '1px solid #E2E8F0' }}>
          {(['owner', 'user'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }} style={{
              flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#0F172A' : '#94A3B8',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{t === 'owner' ? 'Owner Access' : 'Panel User'}</button>
          ))}
        </div>

        <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder={tab === 'owner' ? 'owner@company.com' : 'user@company.com'} />
        <Input label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Your password" />

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Svg path={IC.alert} size={15} />
            <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <button onClick={tab === 'owner' ? handleOwnerLogin : handlePanelLogin} disabled={loading}
          onKeyDown={(e: any) => e.key === 'Enter' && (tab === 'owner' ? handleOwnerLogin() : handlePanelLogin())}
          style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(37,99,235,0.4)', letterSpacing: '0.2px' }}>
          {loading ? 'Verifying...' : 'Access Control Panel'}
        </button>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 13, color: '#94A3B8', textDecoration: 'none', fontWeight: 500 }}>Back to Employee App</a>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// COMMAND CENTER
// ═══════════════════════════════════════════════════════════
function CommandCenter({ employees, departments, locations, panelUser }: { employees: Employee[]; departments: Department[]; locations: Location[]; panelUser: PanelUser }) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [pendingTimesheets, setPendingTimesheets] = useState<TimeEntry[]>([])
  const [pendingTimeOff, setPendingTimeOff] = useState<TimeOff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [laborToday, setLaborToday] = useState(0)
  const [laborWeek, setLaborWeek] = useState(0)
  const [now, setNow] = useState(new Date())
  const [scheduleView, setScheduleView] = useState<'week' | 'twoweeks' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { load() }, [weekStart, scheduleView])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = scheduleView === 'month'
      ? format(endOfMonth(weekStart), 'yyyy-MM-dd')
      : scheduleView === 'twoweeks'
        ? format(addDays(weekStart, 13), 'yyyy-MM-dd')
        : format(addDays(weekStart, 6), 'yyyy-MM-dd')

    const [ae, pts, pto, sh, te, we2] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('time_entries').select('*').eq('status', 'pending'),
      supabase.from('time_off').select('*').eq('status', 'pending'),
      supabase.from('shifts').select('*').gte('start_time', ws).lte('start_time', we + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', today).not('clock_out', 'is', null),
      supabase.from('time_entries').select('*').gte('clock_in', ws),
    ])
    setActiveEntries(ae.data || [])
    setPendingTimesheets(pts.data || [])
    setPendingTimeOff(pto.data || [])
    setShifts(sh.data || [])

    const todayCost = (te.data || []).reduce((s, e) => {
      const emp = employees.find(em => em.id === e.employee_id)
      if (!emp) return s
      const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
      return s + entryHours(e) * rate
    }, 0)
    setLaborToday(todayCost)

    const weekCost = (we2.data || []).reduce((s, e) => {
      const emp = employees.find(em => em.id === e.employee_id)
      if (!emp) return s
      const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
      return s + entryHours(e) * rate
    }, 0)
    setLaborWeek(weekCost)
  }

  async function approveTimesheet(id: string) {
    await supabase.from('time_entries').update({ status: 'approved', approved_by: panelUser.id }).eq('id', id)
    await logAudit(panelUser, 'APPROVE_TIMESHEET', 'timesheets', { id })
    load()
  }

  async function rejectTimesheet(id: string) {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id)
    await logAudit(panelUser, 'REJECT_TIMESHEET', 'timesheets', { id })
    load()
  }

  async function approveTimeOff(id: string, empId: string, days: number, type: string) {
    await supabase.from('time_off').update({ status: 'approved', reviewed_by: panelUser.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (type === 'vacation') {
      const emp = employees.find(e => e.id === empId)
      if (emp) await supabase.from('employees').update({ pto_balance: Math.max(0, (emp.pto_balance || 0) - days) }).eq('id', empId)
    }
    await supabase.from('notifications').insert({ employee_id: empId, title: 'Time Off Approved', message: 'Your time off request has been approved.', type: 'success', read: false })
    await logAudit(panelUser, 'APPROVE_TIME_OFF', 'timeoff', { id, empId, days })
    load()
  }

  async function rejectTimeOff(id: string, empId: string) {
    await supabase.from('time_off').update({ status: 'rejected', reviewed_by: panelUser.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('notifications').insert({ employee_id: empId, title: 'Time Off Denied', message: 'Your time off request was denied.', type: 'error', read: false })
    await logAudit(panelUser, 'REJECT_TIME_OFF', 'timeoff', { id, empId })
    load()
  }

  async function publishDrafts() {
    setPublishing(true)
    const drafts = shifts.filter(s => s.status === 'draft')
    for (const s of drafts) await supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)
    const empIds = [...new Set(drafts.map(s => s.employee_id))]
    for (const eid of empIds) await supabase.from('notifications').insert({ employee_id: eid, title: 'Schedule Published', message: 'Your schedule has been published.', type: 'info', read: false })
    await logAudit(panelUser, 'PUBLISH_SCHEDULE', 'schedule', { count: drafts.length })
    setPublishing(false)
    setPubMsg(`${drafts.length} shifts published`)
    setTimeout(() => setPubMsg(''), 3000)
    load()
  }

  const draftCount = shifts.filter(s => s.status === 'draft').length
  const totalActive = employees.filter(e => e.status === 'active').length
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const twoWeekDays = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i))
  const pendingAll = pendingTimesheets.length + pendingTimeOff.length

  function renderScheduleGrid(days: Date[]) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 80, padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Dept</th>
              {days.map(d => {
                const dayShifts = shifts.filter(s => s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd'))
                const covered = new Set(dayShifts.map(s => s.employee_id)).size
                const pct = totalActive === 0 ? 100 : Math.round(covered / totalActive * 100)
                const coverColor = pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626'
                const coverBg = pct >= 70 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#FEE2E2'
                return (
                  <th key={d.toISOString()} style={{ padding: '8px 6px', background: isToday(d) ? '#EFF6FF' : '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isToday(d) ? '#2563EB' : '#64748B' }}>{format(d, 'EEE')}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: isToday(d) ? '#2563EB' : '#0F172A' }}>{format(d, 'd')}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: coverColor, background: coverBg, borderRadius: 4, padding: '1px 6px', marginTop: 3, display: 'inline-block' }}>{covered}/{totalActive}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => {
              const deptShifts = shifts.filter(s => s.department_id === dept.id)
              if (deptShifts.length === 0) return null
              return (
                <tr key={dept.id}>
                  <td style={{ padding: '6px 12px', border: '1px solid #E2E8F0', background: dept.color + '10' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{dept.name}</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const dayShifts = deptShifts.filter(s => s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd'))
                    return (
                      <td key={d.toISOString()} style={{ padding: 4, border: '1px solid #E2E8F0', background: isToday(d) ? '#F0F7FF' : '#fff', verticalAlign: 'top', minHeight: 52 }}>
                        {dayShifts.map(s => {
                          const emp = employees.find(e => e.id === s.employee_id)
                          const isDraft = s.status === 'draft'
                          return (
                            <div key={s.id} style={{
                              padding: '4px 7px', borderRadius: 5, marginBottom: 3, fontSize: 11,
                              background: isDraft ? 'transparent' : dept.color + '18',
                              color: dept.color,
                              border: isDraft ? `1.5px dashed ${dept.color}` : `1px solid ${dept.color}30`,
                              opacity: isDraft ? 0.8 : 1,
                            }}>
                              <div style={{ fontWeight: 800, fontSize: 10 }}>{format(new Date(s.start_time), 'HH:mm')}-{format(new Date(s.end_time), 'HH:mm')}</div>
                              <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>{emp ? emp.first_name + ' ' + (emp.last_name?.[0] || '') + '.' : '-'}</div>
                              {isDraft && <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 700 }}>DRAFT</div>}
                            </div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function renderMonthView() {
    const ms = startOfMonth(weekStart)
    const me = endOfMonth(weekStart)
    const days = eachDayOfInterval({ start: ms, end: me })
    const pad = Array(ms.getDay() === 0 ? 6 : ms.getDay() - 1).fill(null)
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', padding: '6px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {pad.map((_,i) => <div key={'p'+i} />)}
          {days.map(day => {
            const ds = shifts.filter(s => s.start_time.slice(0,10) === format(day,'yyyy-MM-dd'))
            const pub = ds.filter(s => s.status !== 'draft').length
            const draft = ds.filter(s => s.status === 'draft').length
            return (
              <div key={day.toISOString()} style={{ minHeight: 70, border: '1px solid #E2E8F0', borderRadius: 7, padding: '6px 7px', background: isToday(day) ? '#EFF6FF' : '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isToday(day) ? '#2563EB' : '#374151', marginBottom: 5 }}>{format(day,'d')}</div>
                {pub > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', borderRadius: 3, padding: '1px 5px', marginBottom: 2 }}>{pub} shifts</div>}
                {draft > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 3, padding: '1px 5px', border: '1px dashed #FCD34D' }}>{draft} draft</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const todayAlerts: { sev: 'red'|'yellow'; msg: string; time?: string }[] = []
  const today = format(new Date(), 'yyyy-MM-dd')
  shifts.filter(s => s.start_time.slice(0,10) === today).forEach(s => {
    const clocked = activeEntries.find(e => e.employee_id === s.employee_id)
    const emp = employees.find(e => e.id === s.employee_id)
    const lateBy = differenceInMinutes(now, new Date(s.start_time))
    if (!clocked && lateBy > 15) todayAlerts.push({ sev: 'red', msg: `${empName(emp)} is ${lateBy}m late`, time: format(new Date(s.start_time), 'HH:mm') })
  })
  pendingTimesheets.slice(0, 3).forEach(e => {
    const emp = employees.find(em => em.id === e.employee_id)
    todayAlerts.push({ sev: 'yellow', msg: `Timesheet pending — ${empName(emp)}` })
  })
  pendingTimeOff.slice(0, 3).forEach(r => {
    const emp = employees.find(em => em.id === r.employee_id)
    todayAlerts.push({ sev: 'yellow', msg: `Time off request — ${empName(emp)}` })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        {[
          { label: 'Clocked In', value: activeEntries.length, sub: `of ${totalActive}`, color: '#059669' },
          { label: 'Not In', value: totalActive - activeEntries.length, sub: 'active employees', color: totalActive - activeEntries.length > 0 ? '#D97706' : '#059669' },
          { label: 'Labor Today', value: fmtMoney(laborToday), sub: 'accrued', color: '#2563EB', mono: true },
          { label: 'Labor Week', value: fmtMoney(laborWeek), sub: 'current week', color: '#2563EB', mono: true },
          { label: 'Draft Shifts', value: draftCount, sub: 'unpublished', color: draftCount > 0 ? '#D97706' : '#94A3B8' },
          { label: 'Approvals', value: pendingAll, sub: 'pending', color: pendingAll > 0 ? '#DC2626' : '#059669' },
        ].map((k, i) => (
          <Card key={i} style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, fontFamily: (k as any).mono ? 'var(--font-mono)' : 'inherit', lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Schedule Block */}
      <Card style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>Schedule</div>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 7, overflow: 'hidden' }}>
              {(['week','twoweeks','month'] as const).map(v => (
                <button key={v} onClick={() => setScheduleView(v)} style={{ padding: '5px 14px', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: scheduleView === v ? '#2563EB' : 'transparent', color: scheduleView === v ? '#fff' : '#64748B' }}>
                  {v === 'week' ? 'Week' : v === 'twoweeks' ? '2 Weeks' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><Svg path={IC.chevL} size={13} /></Btn>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 170, textAlign: 'center' }}>
              {scheduleView === 'month' ? format(weekStart, 'MMMM yyyy') : `${format(weekStart, 'MMM d')} — ${format(scheduleView === 'twoweeks' ? addDays(weekStart,13) : addDays(weekStart,6), 'MMM d, yyyy')}`}
            </span>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><Svg path={IC.chevR} size={13} /></Btn>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Btn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94A3B8' }}>
                <div style={{ width: 10, height: 10, border: '1.5px dashed #94A3B8', borderRadius: 2 }} />Draft ({draftCount})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94A3B8' }}>
                <div style={{ width: 10, height: 10, background: '#2563EB', borderRadius: 2 }} />Published
              </div>
            </div>
            {draftCount > 0 && (
              <Btn variant="success" size="sm" onClick={publishDrafts} disabled={publishing}>
                <Svg path={IC.check} size={13} />
                {publishing ? 'Publishing...' : `Publish ${draftCount} Drafts`}
              </Btn>
            )}
            {pubMsg && <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{pubMsg}</span>}
          </div>
        </div>

        {/* Dept legend */}
        {departments.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            {departments.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />{d.name}
              </div>
            ))}
          </div>
        )}

        {shifts.length === 0
          ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8', fontSize: 13 }}>No shifts for this period. Go to Schedule to add shifts.</div>
          : scheduleView === 'month' ? renderMonthView()
            : scheduleView === 'twoweeks' ? renderScheduleGrid(twoWeekDays)
              : renderScheduleGrid(weekDays)
        }
      </Card>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Alerts */}
        <Card style={{ padding: '20px 22px' }}>
          <SectionTitle>Active Alerts ({todayAlerts.length})</SectionTitle>
          {todayAlerts.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>No active alerts</div>
            : todayAlerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: a.sev === 'red' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${a.sev === 'red' ? '#FECACA' : '#FDE68A'}`, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.sev === 'red' ? '#DC2626' : '#D97706', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{a.msg}</div>
                  {a.time && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Shift started at {a.time}</div>}
                </div>
              </div>
            ))
          }
        </Card>

        {/* Pending Approvals */}
        <Card style={{ padding: '20px 22px' }}>
          <SectionTitle>Pending Approvals ({pendingAll})</SectionTitle>
          {pendingAll === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>All caught up</div>
            : <>
              {pendingTimesheets.slice(0, 4).map(e => {
                const emp = employees.find(em => em.id === e.employee_id)
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{empName(emp)}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Timesheet · {e.clock_in?.slice(0,10)} · {entryHours(e).toFixed(1)}h</div>
                    </div>
                    <Btn variant="success" size="sm" onClick={() => approveTimesheet(e.id)}>Approve</Btn>
                    <Btn variant="danger" size="sm" onClick={() => rejectTimesheet(e.id)}>Reject</Btn>
                  </div>
                )
              })}
              {pendingTimeOff.slice(0, 4).map(r => {
                const emp = employees.find(em => em.id === r.employee_id)
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{empName(emp)}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Time Off ({r.type}) · {r.start_date} · {r.days}d</div>
                    </div>
                    <Btn variant="success" size="sm" onClick={() => approveTimeOff(r.id, r.employee_id, r.days, r.type)}>Approve</Btn>
                    <Btn variant="danger" size="sm" onClick={() => rejectTimeOff(r.id, r.employee_id)}>Deny</Btn>
                  </div>
                )
              })}
            </>
          }
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PANEL USERS (Owner only)
// ═══════════════════════════════════════════════════════════
function PanelUsers({ employees, panelUsers, setPanelUsers, isOwner, panelUser }: { employees: Employee[]; panelUsers: PanelUser[]; setPanelUsers: (u: PanelUser[]) => void; isOwner: boolean; panelUser: PanelUser }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ employee_id: '', email: '', password_hash: '', full_name: '' })
  const [msg, setMsg] = useState('')

  async function reload() {
    const { data } = await supabase.from('panel_users').select('*').order('created_at', { ascending: false })
    setPanelUsers(data || [])
  }

  async function createUser() {
    if (!form.email || !form.password_hash || !form.full_name) { setMsg('All fields required'); return }
    await supabase.from('panel_users').insert({ ...form, status: 'active', created_by: panelUser.email })
    await logAudit(panelUser, 'CREATE_PANEL_USER', 'users', { email: form.email, name: form.full_name })
    setAddOpen(false)
    setForm({ employee_id: '', email: '', password_hash: '', full_name: '' })
    reload()
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === 'active' ? 'suspended' : 'active'
    await supabase.from('panel_users').update({ status: next }).eq('id', id)
    await logAudit(panelUser, next === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER', 'users', { id })
    reload()
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm('Delete this panel user?')) return
    await supabase.from('panel_users').delete().eq('id', id)
    await logAudit(panelUser, 'DELETE_PANEL_USER', 'users', { id, email })
    reload()
  }

  if (!isOwner) return (
    <Card style={{ padding: 40, textAlign: 'center' }}>
      <Svg path={IC.shield} size={40} />
      <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Owner Access Only</div>
      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 8 }}>Only the owner can manage panel users.</div>
    </Card>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>Panel Users</div>
        <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <Svg path={IC.plus} size={14} />Create Panel User
        </Btn>
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              {['Name','Email','Linked Employee','Created By','Created','Last Login','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px', background: '#F8FAFC' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panelUsers.map(u => {
              const emp = employees.find(e => e.id === u.employee_id)
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{u.full_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{emp ? empName(emp) : <span style={{ color: '#CBD5E1' }}>None</span>}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#94A3B8' }}>{u.created_by}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#94A3B8' }}>{u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#94A3B8' }}>{u.last_login_at ? format(new Date(u.last_login_at), 'MMM d HH:mm') : 'Never'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge color={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant={u.status === 'active' ? 'warning' : 'success'} size="sm" onClick={() => toggleStatus(u.id, u.status)}>
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => deleteUser(u.id, u.email)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              )
            })}
            {panelUsers.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>No panel users created yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Add Modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Create Panel User</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>This user will have full access to the control panel.</div>
            <Input label="Full Name" value={form.full_name} onChange={(e: any) => setForm(f => ({ ...f, full_name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" value={form.password_hash} onChange={(e: any) => setForm(f => ({ ...f, password_hash: e.target.value }))} />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Link to Employee (optional)</label>
              <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111' }}>
                <option value="">Not linked</option>
                {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
              </select>
            </div>
            {msg && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => { setAddOpen(false); setMsg('') }}>Cancel</Btn>
              <Btn variant="primary" onClick={createUser}>Create User</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════
function AuditLog({ isOwner }: { isOwner: boolean }) {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filterModule, setFilterModule] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterModule, filterUser])

  async function load() {
    setLoading(true)
    let q = supabase.from('panel_audit_log').select('*').order('created_at', { ascending: false }).limit(200)
    if (filterModule) q = q.eq('module', filterModule)
    if (filterUser) q = q.ilike('panel_user_email', `%${filterUser}%`)
    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }

  const modules = ['AUTH', 'timesheets', 'timeoff', 'schedule', 'payroll', 'employees', 'users', 'settings']

  const actionColor: Record<string, string> = {
    LOGIN: 'blue', CREATE_PANEL_USER: 'green', DELETE_PANEL_USER: 'red',
    SUSPEND_USER: 'yellow', ACTIVATE_USER: 'green', APPROVE_TIMESHEET: 'green',
    REJECT_TIMESHEET: 'red', APPROVE_TIME_OFF: 'green', REJECT_TIME_OFF: 'red',
    PUBLISH_SCHEDULE: 'blue', RUN_PAYROLL: 'blue', MARK_PAID: 'green',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', flex: 1 }}>Audit Log</div>
        <input value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="Filter by user..." style={{ padding: '7px 12px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 200 }} />
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)} style={{ padding: '7px 12px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
          <option value="">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <Btn variant="secondary" size="sm" onClick={load}><Svg path={IC.refresh} size={13} />Refresh</Btn>
        <Btn variant="secondary" size="sm" onClick={() => {
          const rows = [['Date', 'User', 'Email', 'Action', 'Module', 'Details']]
          logs.forEach(l => rows.push([l.created_at, l.panel_user_name, l.panel_user_email, l.action, l.module, JSON.stringify(l.details)]))
          downloadBlob(rows.map(r => r.join(',')).join('\n'), 'audit_log.csv', 'text/csv')
        }}>
          <Svg path={IC.download} size={13} />Export CSV
        </Btn>
      </div>
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              {['Date & Time', 'User', 'Action', 'Module', 'Details'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px', background: '#F8FAFC' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>No audit records found</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{l.created_at ? format(new Date(l.created_at), 'MMM d, yyyy HH:mm:ss') : '-'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.panel_user_name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{l.panel_user_email}</div>
                </td>
                <td style={{ padding: '10px 16px' }}><Badge color={actionColor[l.action] as any || 'gray'}>{l.action.replace(/_/g, ' ')}</Badge></td>
                <td style={{ padding: '10px 16px' }}><Badge color="gray">{l.module}</Badge></td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', maxWidth: 300 }}>
                  {l.details && Object.keys(l.details).length > 0 ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{JSON.stringify(l.details)}</span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// OWNER SETTINGS (change credentials)
// ═══════════════════════════════════════════════════════════
function OwnerSettings({ panelUser, isOwner }: { panelUser: PanelUser; isOwner: boolean }) {
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success'|'error'>('success')

  async function saveCredentials() {
    setMsg('')
    if (newPassword && newPassword !== confirmPassword) { setMsg('Passwords do not match'); setMsgType('error'); return }
    if (!newEmail && !newPassword) { setMsg('Enter at least one field to update'); setMsgType('error'); return }

    const { data: existing } = await supabase.from('app_config').select('id,owner_email,owner_password').limit(1)
    const payload: any = {}
    if (newEmail) payload.owner_email = newEmail.trim().toLowerCase()
    if (newPassword) payload.owner_password = newPassword.trim()

    if (existing && existing.length > 0) {
      await supabase.from('app_config').update(payload).eq('id', existing[0].id)
    } else {
      await supabase.from('app_config').insert({ ...payload, company_name: 'StaffForce' })
    }

    await supabase.from('panel_audit_log').insert({
      panel_user_id: panelUser.id,
      panel_user_email: panelUser.email,
      panel_user_name: panelUser.full_name,
      action: 'UPDATE_OWNER_CREDENTIALS',
      module: 'settings',
      details: { email_changed: !!newEmail, password_changed: !!newPassword },
      created_at: new Date().toISOString(),
    })

    setNewEmail(''); setNewPassword(''); setConfirmPassword('')
    setMsg('Credentials updated successfully. Use new credentials on next login.'); setMsgType('success')
  }

  if (!isOwner) return (
    <Card style={{ padding: 40, textAlign: 'center' }}>
      <Svg path={IC.shield} size={40} />
      <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700 }}>Owner Access Only</div>
    </Card>
  )

  return (
    <div style={{ maxWidth: 540 }}>
      <Card style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Owner Credentials</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>Change your owner email and password for the control panel. Leave blank to keep current value.</div>
        <Input label="New Email" type="email" value={newEmail} onChange={(e: any) => setNewEmail(e.target.value)} placeholder="new@email.com" />
        <Input label="New Password" type="password" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} placeholder="New password" />
        <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
        {msg && (
          <div style={{ background: msgType === 'success' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msgType === 'success' ? '#BBF7D0' : '#FECACA'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: msgType === 'success' ? '#065F46' : '#DC2626', fontWeight: 500, marginBottom: 16 }}>
            {msg}
          </div>
        )}
        <Btn variant="primary" onClick={saveCredentials}><Svg path={IC.key} size={14} />Update Credentials</Btn>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ADMIN SHELL
// ═══════════════════════════════════════════════════════════
export default function AdminPanel() {
  const [panelUser, setPanelUser] = useState<PanelUser | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [activeModule, setActiveModule] = useState<Mod>('command')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [panelUsers, setPanelUsers] = useState<PanelUser[]>([])

  useEffect(() => {
    if (panelUser) loadGlobal()
  }, [panelUser])

  async function loadGlobal() {
    const [e, d, l, pu] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('panel_users').select('*').order('created_at', { ascending: false }),
    ])
    setEmployees(e.data || [])
    setDepartments(d.data || [])
    setLocations(l.data || [])
    setPanelUsers(pu.data || [])
  }

  function handleLogin(user: PanelUser, owner: boolean) {
    setPanelUser(user)
    setIsOwner(owner)
  }

  function handleLogout() {
    if (panelUser && panelUser.id !== 'owner') {
      supabase.from('panel_audit_log').insert({ panel_user_id: panelUser.id, panel_user_email: panelUser.email, panel_user_name: panelUser.full_name, action: 'LOGOUT', module: 'AUTH', details: {}, created_at: new Date().toISOString() })
    }
    setPanelUser(null)
    setIsOwner(false)
  }

  if (!panelUser) return <AdminLogin onLogin={handleLogin} />

  const NAV_SECTIONS = [
    {
      section: 'OPERATIONS',
      items: [
        { key: 'command' as Mod, label: 'Command Center', icon: IC.command },
        { key: 'schedule' as Mod, label: 'Schedule', icon: IC.schedule },
        { key: 'timesheets' as Mod, label: 'Timesheets', icon: IC.timesheets },
        { key: 'timeoff' as Mod, label: 'Time Off', icon: IC.timeoff },
      ]
    },
    {
      section: 'TEAM',
      items: [
        { key: 'employees' as Mod, label: 'Employees', icon: IC.employees },
      ]
    },
    {
      section: 'BUSINESS',
      items: [
        { key: 'payroll' as Mod, label: 'Payroll', icon: IC.payroll },
        { key: 'reports' as Mod, label: 'Reports', icon: IC.reports },
      ]
    },
    {
      section: 'SYSTEM',
      items: [
        ...(isOwner ? [{ key: 'users' as Mod, label: 'Panel Users', icon: IC.users }] : []),
        { key: 'audit' as Mod, label: 'Audit Log', icon: IC.audit },
        ...(isOwner ? [{ key: 'settings' as Mod, label: 'Owner Settings', icon: IC.settings }] : []),
      ]
    },
  ]

  const MODULE_LABELS: Record<Mod, string> = {
    command: 'Command Center', schedule: 'Schedule', timesheets: 'Timesheets',
    timeoff: 'Time Off', employees: 'Employees', payroll: 'Payroll',
    reports: 'Reports', users: 'Panel Users', audit: 'Audit Log', settings: 'Owner Settings',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', var(--font-body), sans-serif", background: '#F1F5F9' }}>

      {/* Sidebar */}
      <aside style={{ width: 240, minWidth: 240, background: '#0F172A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Logo */}
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Svg path={IC.shield} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.3px' }}>StaffForce</div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Control Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.section} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 22px 5px' }}>{section.section}</div>
              {section.items.map(item => (
                <button key={item.key} onClick={() => setActiveModule(item.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 22px',
                  border: 'none', background: activeModule === item.key ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: activeModule === item.key ? '#60A5FA' : '#94A3B8',
                  fontSize: 13, fontWeight: activeModule === item.key ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
                  borderLeft: activeModule === item.key ? '3px solid #2563EB' : '3px solid transparent',
                }}>
                  <Svg path={item.icon} size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: isOwner ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Svg path={isOwner ? IC.key : IC.users} size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panelUser.full_name}</div>
              <div style={{ fontSize: 10, color: isOwner ? '#A78BFA' : '#60A5FA', fontWeight: 600 }}>{isOwner ? 'OWNER' : 'PANEL USER'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, background: 'rgba(255,255,255,0.04)', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            <Svg path={IC.logout} size={13} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{ height: 56, minHeight: 56, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', flex: 1 }}>{MODULE_LABELS[activeModule]}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{format(new Date(), 'EEE, MMM d yyyy · HH:mm')}</div>
          <a href="/" style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', border: '1px solid #BFDBFE', borderRadius: 7, background: '#EFF6FF' }}>
            Back to Employee App
          </a>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {activeModule === 'command' && <CommandCenter employees={employees} departments={departments} locations={locations} panelUser={panelUser} />}
          {activeModule === 'users' && <PanelUsers employees={employees} panelUsers={panelUsers} setPanelUsers={setPanelUsers} isOwner={isOwner} panelUser={panelUser} />}
          {activeModule === 'audit' && <AuditLog isOwner={isOwner} />}
          {activeModule === 'settings' && <OwnerSettings panelUser={panelUser} isOwner={isOwner} />}
          {['schedule','timesheets','timeoff','employees','payroll','reports'].includes(activeModule) && (
            <Card style={{ padding: '48px', textAlign: 'center' }}>
              <Svg path={IC.command} size={48} />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{MODULE_LABELS[activeModule]}</div>
              <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>Full module coming in next build.</div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
