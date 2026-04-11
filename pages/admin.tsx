import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeptColor, hexToRgba, getShiftStyle, hasOverlap } from '../lib/colors'
import { format, startOfWeek, addDays, addWeeks, subWeeks, differenceInMinutes, endOfMonth, eachDayOfInterval, isToday, startOfMonth } from 'date-fns'
import { calculateHours, calculatePay, generateNACHA } from '../lib/payroll'
import { fmtMoney, empName, entryHours, downloadBlob } from '../components/shared/utils'
import type { Employee, Department, Location, Shift, TimeEntry, TimeOff, PayrollPeriod, PayrollEntry } from '../lib/store'

const OWNER_EMAIL_DEFAULT = 'rodriguezhaysel@gmail.com'
const OWNER_PASS_DEFAULT = 'sovel2026'

interface PanelUser { id: string; employee_id: string; email: string; password_hash: string; full_name: string; status: string; created_by: string; created_at: string; last_login_at: string }
interface AuditEntry { id: string; panel_user_email: string; panel_user_name: string; action: string; module: string; details: any; created_at: string }
type Mod = 'command'|'timesheets'|'timeoff'|'employees'|'payroll'|'reports'|'users'|'audit'|'settings'

async function logA(user: PanelUser, action: string, module: string, details?: any) {
  await supabase.from('panel_audit_log').insert({ panel_user_id: user.id, panel_user_email: user.email, panel_user_name: user.full_name, action, module, details: details || {}, created_at: new Date().toISOString() })
}

// Design tokens
const C = { bg: '#F0F4F8', sidebar: '#0D1B2A', accent: '#2563EB', accentLight: '#EFF6FF', accentBorder: '#BFDBFE', success: '#059669', successBg: '#D1FAE5', danger: '#DC2626', dangerBg: '#FEE2E2', warning: '#D97706', warningBg: '#FEF3C7', card: '#FFFFFF', border: '#E2E8F0', text: '#0F172A', textSub: '#64748B', textMuted: '#94A3B8' }

function Svg({ d, size = 16, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

const IC: Record<string,string> = {
  command: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  timesheets: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  timeoff: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  employees: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  payroll: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  reports: 'M18 20V10M12 20V4M6 20v-6',
  users: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  audit: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M12 12h.01M12 16h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus: 'M12 5v14M5 12h14', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  trend: 'M23 6l-9.5 9.5-5-5L1 18',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  schedule: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  bank: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
}

// Shared components
const Card = ({ children, style = {}, pad = 20 }: any) => <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: pad, ...style }}>{children}</div>
const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, full = false, style = {} }: any) => {
  const vs: any = { primary: { background: C.accent, color: '#fff', border: 'none' }, secondary: { background: '#F8FAFC', color: C.text, border: `1px solid ${C.border}` }, success: { background: C.success, color: '#fff', border: 'none' }, danger: { background: C.danger, color: '#fff', border: 'none' }, warning: { background: C.warning, color: '#fff', border: 'none' }, ghost: { background: 'transparent', color: C.accent, border: `1px solid ${C.accentBorder}` } }
  const ss: any = { sm: { padding: '5px 12px', fontSize: 12 }, md: { padding: '8px 18px', fontSize: 13 }, lg: { padding: '12px 28px', fontSize: 15 } }
  const v = vs[variant] || vs.primary
  return <button onClick={onClick} disabled={disabled} style={{ ...ss[size], ...v, borderRadius: 8, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap', width: full ? '100%' : undefined, justifyContent: full ? 'center' : undefined, ...style }}>{children}</button>
}
const Badge = ({ children, color = 'blue' }: any) => {
  const cs: any = { blue: [C.accentLight, C.accent], green: [C.successBg, C.success], red: [C.dangerBg, C.danger], yellow: [C.warningBg, C.warning], gray: ['#F1F5F9', C.textSub], purple: ['#F5F3FF', '#7C3AED'] }
  const [bg, text] = cs[color] || cs.blue
  return <span style={{ background: bg, color: text, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{children}</span>
}
const Inp = ({ label, type = 'text', value, onChange, placeholder = '', style = {}, rows = 0 }: any) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{label}</label>}
    {rows > 0
      ? <textarea rows={rows} value={value} onChange={onChange} placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any, color: C.text, resize: 'vertical' as any, ...style }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any, color: C.text, background: '#fff', ...style }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
    }
  </div>
)
const Sel = ({ label, value, onChange, children, style = {} }: any) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{label}</label>}
    <select value={value} onChange={onChange} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any, color: C.text, background: '#fff', ...style }}>{children}</select>
  </div>
)
const Th = ({ children }: any) => <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{children}</th>
const Td = ({ children, style = {} }: any) => <td style={{ padding: '11px 16px', fontSize: 13, color: C.text, borderBottom: `1px solid #F8FAFC`, verticalAlign: 'middle', ...style }}>{children}</td>
const PageHeader = ({ title, sub, children }: any) => <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}><div><div style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.5px' }}>{title}</div>{sub && <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}>{sub}</div>}</div>{children && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>}</div>
const Kpi = ({ label, value, sub, color, icon }: any) => <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 140, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>{icon && <div style={{ color: color || C.accent }}><Svg d={icon} size={18} color={color || C.accent} /></div>}</div><div style={{ fontSize: 26, fontWeight: 900, color: color || C.text, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{sub}</div>}</div>

const Popup = ({ open, onClose, title, children, wide = false }: any) => {
  if (!open) return null
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}><div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: wide ? 860 : 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}><div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub }}><Svg d={IC.x} size={18} /></button></div>{children}</div></div>
}

const EmpAvatar = ({ emp, size = 32, deptColor }: { emp?: Employee; size?: number; deptColor?: string }) => {
  const avUrl = (emp as any)?.avatar_url
  return <div style={{ width: size, height: size, borderRadius: '50%', background: avUrl ? 'transparent' : (deptColor || C.accent), overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${C.border}` }}>{avUrl ? <img src={avUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontSize: size * 0.35, fontWeight: 700 }}>{(emp?.first_name?.[0]||'')+(emp?.last_name?.[0]||'')}</span>}</div>
}

// LOGIN
function AdminLogin({ onLogin }: { onLogin: (u: PanelUser, isOwner: boolean) => void }) {
  const [tab, setTab] = useState<'owner'|'user'>('owner')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setErr(''); setLoading(true)
    if (tab === 'owner') {
      const { data } = await supabase.from('app_config').select('owner_email,owner_password').limit(1)
      const oe = data?.[0]?.owner_email || OWNER_EMAIL_DEFAULT
      const op = data?.[0]?.owner_password || OWNER_PASS_DEFAULT
      if (email.trim().toLowerCase() === oe && pass.trim() === op) {
        onLogin({ id: 'owner', employee_id: '', email: oe, password_hash: '', full_name: 'Owner', status: 'active', created_by: 'system', created_at: '', last_login_at: '' }, true)
      } else setErr('Invalid owner credentials')
    } else {
      const { data } = await supabase.from('panel_users').select('*').eq('email', email.trim().toLowerCase()).eq('status', 'active')
      const u = (data || []).find((x: PanelUser) => x.password_hash === pass.trim())
      if (u) {
        await supabase.from('panel_users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id)
        await supabase.from('panel_audit_log').insert({ panel_user_id: u.id, panel_user_email: u.email, panel_user_name: u.full_name, action: 'LOGIN', module: 'AUTH', details: {}, created_at: new Date().toISOString() })
        onLogin(u, false)
      } else setErr('Invalid credentials or account suspended')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-body)', background: `linear-gradient(135deg, ${C.sidebar} 0%, #1a2e42 60%, #0D2B4E 100%)` }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, color: '#fff' }}>
        <div style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}><Svg d={IC.shield} size={26} color="#fff" /></div>
            <div><div style={{ fontSize: 22, fontWeight: 900 }}>StaffForce</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Business Control Panel</div></div>
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1.5px' }}>Command Your<br /><span style={{ color: '#60A5FA' }}>Workforce</span></h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: 52 }}>The most complete workforce management control panel. Schedule, payroll, compliance, analytics with a complete audit trail.</p>
          {[{ i: IC.schedule, t: 'Visual scheduling with labor cost forecasting' }, { i: IC.payroll, t: 'Automated payroll with split direct deposit' }, { i: IC.shield, t: 'Full audit log of every admin action' }, { i: IC.reports, t: 'Real-time analytics and workforce insights' }].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Svg d={item.i} size={16} color="#60A5FA" /></div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{item.t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 520, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px', boxShadow: '-24px 0 80px rgba(0,0,0,0.3)' }}>
        <div style={{ marginBottom: 32 }}><h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 6, letterSpacing: '-0.5px' }}>Control Panel</h2><p style={{ fontSize: 14, color: C.textSub }}>Sign in to access business operations</p></div>
        <div style={{ display: 'flex', background: '#F8FAFC', borderRadius: 10, padding: 4, marginBottom: 28, border: `1px solid ${C.border}` }}>
          {(['owner','user'] as const).map(t => <button key={t} onClick={() => { setTab(t); setErr('') }} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: tab === t ? '#fff' : 'transparent', color: tab === t ? C.text : C.textMuted, boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{t === 'owner' ? 'Owner Access' : 'Panel User'}</button>)}
        </div>
        <Inp label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder={tab === 'owner' ? 'owner@company.com' : 'user@company.com'} />
        <Inp label="Password" type="password" value={pass} onChange={(e: any) => setPass(e.target.value)} placeholder="Your password" />
        {err && <div style={{ background: C.dangerBg, border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><Svg d={IC.alert} size={14} color={C.danger} /><span style={{ fontSize: 13, color: C.danger, fontWeight: 500 }}>{err}</span></div>}
        <Btn variant="primary" size="lg" onClick={submit} disabled={loading} full>{loading ? 'Verifying...' : 'Access Control Panel'}</Btn>
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}><a href="/" style={{ fontSize: 13, color: C.textSub, textDecoration: 'none', fontWeight: 500 }}>Back to Employee App</a></div>
      </div>
    </div>
  )
}

// COMMAND CENTER
function CommandCenter({ employees, departments, panelUser }: { employees: Employee[]; departments: Department[]; panelUser: PanelUser }) {
  const [active, setActive] = useState<TimeEntry[]>([])
  const [pendingTs, setPendingTs] = useState<TimeEntry[]>([])
  const [pendingPto, setPendingPto] = useState<TimeOff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [laborToday, setLaborToday] = useState(0)
  const [laborWeek, setLaborWeek] = useState(0)
  const [schedView, setSchedView] = useState<'week'|'2w'|'month'>('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t) }, [])
  useEffect(() => { load() }, [weekStart, schedView])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = schedView === 'month' ? format(endOfMonth(weekStart), 'yyyy-MM-dd') : schedView === '2w' ? format(addDays(weekStart, 13), 'yyyy-MM-dd') : format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [a, pts, pto, sh, te, we2] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('time_entries').select('*').eq('status', 'pending'),
      supabase.from('time_off').select('*').eq('status', 'pending'),
      supabase.from('shifts').select('*').gte('start_time', ws).lte('start_time', we + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', today).not('clock_out', 'is', null),
      supabase.from('time_entries').select('*').gte('clock_in', ws),
    ])
    setActive(a.data || []); setPendingTs(pts.data || []); setPendingPto(pto.data || []); setShifts(sh.data || [])
    const cc = (arr: TimeEntry[]) => arr.reduce((s, e) => { const emp = employees.find(em => em.id === e.employee_id); if (!emp) return s; const r = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0); return s + entryHours(e) * r }, 0)
    setLaborToday(cc(te.data || [])); setLaborWeek(cc(we2.data || []))
  }

  async function approveTsInline(id: string) { await supabase.from('time_entries').update({ status: 'approved', approved_by: panelUser.id }).eq('id', id); await logA(panelUser, 'APPROVE_TIMESHEET', 'timesheets', { id }); load() }
  async function rejectTsInline(id: string) { await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id); load() }
  async function approvePto(r: TimeOff) {
    await supabase.from('time_off').update({ status: 'approved', reviewed_by: panelUser.id, reviewed_at: new Date().toISOString() }).eq('id', r.id)
    if (r.type === 'vacation') { const emp = employees.find(e => e.id === r.employee_id); if (emp) await supabase.from('employees').update({ pto_balance: Math.max(0, (emp.pto_balance||0) - r.days) }).eq('id', emp.id) }
    await supabase.from('notifications').insert({ employee_id: r.employee_id, title: 'Time Off Approved', message: 'Your request has been approved.', type: 'success', read: false })
    await logA(panelUser, 'APPROVE_TIME_OFF', 'timeoff', { id: r.id }); load()
  }
  async function denyPto(r: TimeOff) {
    await supabase.from('time_off').update({ status: 'rejected', reviewed_by: panelUser.id, reviewed_at: new Date().toISOString() }).eq('id', r.id)
    await supabase.from('notifications').insert({ employee_id: r.employee_id, title: 'Time Off Denied', message: 'Your request was denied.', type: 'error', read: false }); load()
  }
  async function publishDrafts() {
    setPublishing(true)
    const drafts = shifts.filter(s => s.status === 'draft')
    for (const s of drafts) await supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)
    const eids = [...new Set(drafts.map(s => s.employee_id))]
    for (const eid of eids) await supabase.from('notifications').insert({ employee_id: eid, title: 'Schedule Published', message: 'Your schedule has been published.', type: 'info', read: false })
    await logA(panelUser, 'PUBLISH_SCHEDULE', 'schedule', { count: drafts.length })
    setPublishing(false); setPubMsg(`${drafts.length} shifts published`); setTimeout(() => setPubMsg(''), 3000); load()
  }

  const totalActive = employees.filter(e => e.status === 'active').length
  const draftCount = shifts.filter(s => s.status === 'draft').length
  const pendingAll = pendingTs.length + pendingPto.length
  const days = schedView === '2w' ? Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)) : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const alerts: { sev: 'red'|'yellow'; msg: string; time?: string }[] = []
  const today = format(new Date(), 'yyyy-MM-dd')
  shifts.filter(s => s.start_time.slice(0,10) === today).forEach(s => {
    const emp = employees.find(e => e.id === s.employee_id)
    if (!active.find(e => e.employee_id === s.employee_id) && differenceInMinutes(now, new Date(s.start_time)) > 15)
      alerts.push({ sev: 'red', msg: `${empName(emp)} is ${differenceInMinutes(now, new Date(s.start_time))}m late`, time: format(new Date(s.start_time), 'HH:mm') })
  })

  function renderGrid() {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 90, padding: '8px 12px', background: '#F8FAFC', border: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textSub, textAlign: 'left' }}>DEPT</th>
              {days.map(d => {
                const ds = shifts.filter(s => s.start_time.slice(0,10) === format(d,'yyyy-MM-dd'))
                const covered = new Set(ds.map(s => s.employee_id)).size
                const pct = totalActive === 0 ? 100 : Math.round(covered/totalActive*100)
                const cc = pct >= 70 ? C.success : pct >= 40 ? C.warning : C.danger
                const cb = pct >= 70 ? C.successBg : pct >= 40 ? C.warningBg : C.dangerBg
                return <th key={d.toISOString()} style={{ padding: '8px 4px', background: isToday(d) ? C.accentLight : '#F8FAFC', border: `1px solid ${C.border}`, textAlign: 'center', minWidth: schedView === '2w' ? 70 : 90 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday(d) ? C.accent : C.textSub }}>{format(d,'EEE')}</div>
                  <div style={{ fontSize: schedView === '2w' ? 14 : 17, fontWeight: 900, color: isToday(d) ? C.accent : C.text }}>{format(d,'d')}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: cc, background: cb, borderRadius: 4, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>{covered}/{totalActive}</div>
                </th>
              })}
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => {
              const deptShifts = shifts.filter(s => s.department_id === dept.id)
              if (!deptShifts.length) return null
              return <tr key={dept.id}>
                <td style={{ padding: '5px 12px', border: `1px solid ${C.border}`, background: dept.color + '10' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color, flexShrink: 0 }} /><span style={{ fontSize: 11, fontWeight: 600, color: C.textSub }}>{dept.name}</span></div>
                </td>
                {days.map(d => {
                  const ds = deptShifts.filter(s => s.start_time.slice(0,10) === format(d,'yyyy-MM-dd'))
                  return <td key={d.toISOString()} style={{ padding: 3, border: `1px solid ${C.border}`, background: isToday(d) ? '#F0F7FF' : '#fff', verticalAlign: 'top' }}>
                    {ds.map(s => { const emp = employees.find(e => e.id === s.employee_id); const color = getDeptColor(s.department_id, departments); const draft = s.status === 'draft'; return <div key={s.id} style={{ padding: '3px 6px', borderRadius: 5, marginBottom: 2, fontSize: 10, background: hexToRgba(color, 0.12), color: color, borderLeft: `3px ${draft?'dashed':'solid'} ${color}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                      <div style={{ fontWeight: 800 }}>{format(new Date(s.start_time),'HH:mm')}-{format(new Date(s.end_time),'HH:mm')}</div>
                      <div style={{ opacity: 0.85, color: '#374151' }}>{emp ? emp.first_name + ' ' + (emp.last_name?.[0]||'') + '.' : '-'}</div>
                      {draft && <div style={{ fontSize: 8, opacity: 0.7, fontWeight: 700, color: '#D97706' }}>DRAFT</div>}
                    </div>})}
                  </td>
                })}
              </tr>
            })}
            {!departments.some(dept => shifts.some(s => s.department_id === dept.id)) && <tr><td colSpan={days.length+1} style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 13 }}>No shifts for this period</td></tr>}
          </tbody>
        </table>
      </div>
    )
  }

  function renderMonth() {
    const ms = startOfMonth(weekStart); const me = endOfMonth(weekStart)
    const mdays = eachDayOfInterval({ start: ms, end: me })
    const pad = Array(ms.getDay() === 0 ? 6 : ms.getDay()-1).fill(null)
    return <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '5px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {pad.map((_,i) => <div key={'p'+i} />)}
        {mdays.map(day => {
          const ds = shifts.filter(s => s.start_time.slice(0,10) === format(day,'yyyy-MM-dd'))
          const pub = ds.filter(s => s.status !== 'draft').length; const draft = ds.filter(s => s.status === 'draft').length
          return <div key={day.toISOString()} style={{ minHeight: 72, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 7px', background: isToday(day) ? C.accentLight : '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: isToday(day) ? C.accent : C.text, marginBottom: 5 }}>{format(day,'d')}</div>
            {pub > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: C.successBg, color: C.success, borderRadius: 3, padding: '1px 5px', marginBottom: 2 }}>{pub} shift{pub > 1 ? 's' : ''}</div>}
            {draft > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: C.warningBg, color: C.warning, borderRadius: 3, padding: '1px 5px', border: `1px dashed ${C.warning}` }}>{draft} draft</div>}
          </div>
        })}
      </div>
    </div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        <Kpi label="Clocked In" value={active.length} sub={`of ${totalActive}`} color={active.length > 0 ? C.success : C.textMuted} icon={IC.clock} />
        <Kpi label="Not Clocked" value={totalActive-active.length} color={totalActive-active.length > 3 ? C.warning : C.success} icon={IC.alert} />
        <Kpi label="Labor Today" value={fmtMoney(laborToday)} color={C.accent} icon={IC.dollar} />
        <Kpi label="Labor Week" value={fmtMoney(laborWeek)} color={C.accent} icon={IC.trend} />
        <Kpi label="Draft Shifts" value={draftCount} color={draftCount > 0 ? C.warning : C.textMuted} icon={IC.schedule} />
        <Kpi label="Approvals" value={pendingAll} color={pendingAll > 0 ? C.danger : C.success} icon={IC.check} />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>Schedule</div>
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {([['week','Week'],['2w','2 Weeks'],['month','Month']] as const).map(([v,l]) => <button key={v} onClick={() => setSchedView(v)} style={{ padding: '5px 14px', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: schedView === v ? C.accent : 'transparent', color: schedView === v ? '#fff' : C.textSub }}>{l}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(subWeeks(weekStart,1))}><Svg d={IC.chevL} size={13} /></Btn>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 170, textAlign: 'center' }}>{schedView === 'month' ? format(weekStart,'MMMM yyyy') : `${format(weekStart,'MMM d')} — ${format(schedView==='2w'?addDays(weekStart,13):addDays(weekStart,6),'MMM d, yyyy')}`}</span>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(addWeeks(weekStart,1))}><Svg d={IC.chevR} size={13} /></Btn>
            <Btn variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(),{weekStartsOn:1}))}>Today</Btn>
            <div style={{ display: 'flex', gap: 10, marginLeft: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSub }}><div style={{ width: 10, height: 10, border: `1.5px dashed ${C.textSub}`, borderRadius: 2 }} />Draft ({draftCount})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSub }}><div style={{ width: 10, height: 10, background: C.accent, borderRadius: 2 }} />Published</div>
            </div>
            {draftCount > 0 && <Btn variant="success" size="sm" onClick={publishDrafts} disabled={publishing}><Svg d={IC.check} size={13} />{publishing ? 'Publishing...' : `Publish ${draftCount}`}</Btn>}
            {pubMsg && <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>{pubMsg}</span>}
          </div>
        </div>
        {departments.length > 0 && <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>{departments.map(d => <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSub, fontWeight: 600 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />{d.name}</div>)}</div>}
        {schedView === 'month' ? renderMonth() : renderGrid()}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 14 }}>Active Alerts ({alerts.length})</div>
          {alerts.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textMuted, fontSize: 13 }}>No alerts</div>
            : alerts.map((a,i) => <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: a.sev==='red'?C.dangerBg:C.warningBg, border: `1px solid ${a.sev==='red'?'#FECACA':'#FDE68A'}`, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.sev==='red'?C.danger:C.warning, marginTop: 5, flexShrink: 0 }} />
              <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{a.msg}</div>{a.time && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Shift at {a.time}</div>}</div>
            </div>)
          }
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 14 }}>Pending Approvals ({pendingAll})</div>
          {pendingAll === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textMuted, fontSize: 13 }}>All caught up</div>
            : <>
              {pendingTs.slice(0,3).map(e => { const emp = employees.find(em => em.id === e.employee_id); return <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid #F8FAFC` }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{empName(emp)}</div><div style={{ fontSize: 11, color: C.textMuted }}>Timesheet · {e.clock_in?.slice(0,10)} · {entryHours(e).toFixed(1)}h</div></div><Btn variant="success" size="sm" onClick={() => approveTsInline(e.id)}>Approve</Btn><Btn variant="danger" size="sm" onClick={() => rejectTsInline(e.id)}>Reject</Btn></div> })}
              {pendingPto.slice(0,3).map(r => { const emp = employees.find(em => em.id === r.employee_id); return <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid #F8FAFC` }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{empName(emp)}</div><div style={{ fontSize: 11, color: C.textMuted }}>Time Off ({r.type}) · {r.start_date} · {r.days}d</div></div><Btn variant="success" size="sm" onClick={() => approvePto(r)}>Approve</Btn><Btn variant="danger" size="sm" onClick={() => denyPto(r)}>Deny</Btn></div> })}
            </>
          }
        </Card>
      </div>
    </div>
  )
}

// TIMESHEETS
function TimesheetsModule({ employees, panelUser }: { employees: Employee[]; panelUser: PanelUser }) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filterEmp, setFilterEmp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editEntry, setEditEntry] = useState<TimeEntry|null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => { load() }, [filterEmp, filterStatus, filterDate])

  async function load() {
    let q = supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
    if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterDate) q = q.gte('clock_in', filterDate).lte('clock_in', filterDate + 'T23:59:59')
    const { data } = await q; setEntries(data || [])
  }

  async function approve(id: string) { await supabase.from('time_entries').update({ status: 'approved', approved_by: panelUser.id }).eq('id', id); await logA(panelUser,'APPROVE_TIMESHEET','timesheets',{id}); load() }
  async function reject(id: string) { await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id); load() }
  async function approveAll() { const p = entries.filter(e => e.status === 'pending'); for (const e of p) await supabase.from('time_entries').update({ status: 'approved', approved_by: panelUser.id }).eq('id', e.id); await logA(panelUser,'APPROVE_ALL','timesheets',{count:p.length}); load() }
  async function saveEdit() { if (!editEntry) return; await supabase.from('time_entries').update({ clock_in: editEntry.clock_in, clock_out: editEntry.clock_out, break_mins: editEntry.break_mins, notes: editEntry.notes }).eq('id', editEntry.id); await logA(panelUser,'EDIT_TIMESHEET','timesheets',{id:editEntry.id}); setEditOpen(false); load() }

  const totalHours = entries.reduce((s,e) => s + entryHours(e), 0)
  const pending = entries.filter(e => e.status === 'pending').length

  return (
    <div>
      <PageHeader title="Timesheets" sub="Review and approve employee time entries">
        <Btn variant="secondary" size="sm" onClick={() => { const rows=[['Employee','Date','In','Out','Break','Hours','Status']]; entries.forEach(e => { const emp=employees.find(em=>em.id===e.employee_id); rows.push([empName(emp),e.clock_in?.slice(0,10)||'',e.clock_in?format(new Date(e.clock_in),'HH:mm'):'',e.clock_out?format(new Date(e.clock_out),'HH:mm'):'',String(e.break_mins||0),entryHours(e).toFixed(2),e.status]) }); downloadBlob(rows.map(r=>r.join(',')).join('\n'),'timesheets.csv','text/csv') }}><Svg d={IC.download} size={13} />Export</Btn>
        {pending > 0 && <Btn variant="success" size="sm" onClick={approveAll}><Svg d={IC.check} size={13} />Approve All ({pending})</Btn>}
      </PageHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <Kpi label="Total" value={entries.length} icon={IC.timesheets} />
        <Kpi label="Hours" value={totalHours.toFixed(1)} icon={IC.clock} />
        <Kpi label="Pending" value={pending} color={pending>0?C.warning:C.success} icon={IC.alert} />
        <Kpi label="Approved" value={entries.filter(e=>e.status==='approved').length} color={C.success} icon={IC.check} />
      </div>
      <Card style={{ marginBottom:16, padding:14 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:180 }}><Sel label="Employee" value={filterEmp} onChange={(e:any)=>setFilterEmp(e.target.value)} style={{marginBottom:0}}><option value="">All Employees</option>{employees.map(e=><option key={e.id} value={e.id}>{empName(e)}</option>)}</Sel></div>
          <div style={{ width:140 }}><Sel label="Status" value={filterStatus} onChange={(e:any)=>setFilterStatus(e.target.value)} style={{marginBottom:0}}><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Sel></div>
          <div style={{ width:160 }}><Inp label="Date" type="date" value={filterDate} onChange={(e:any)=>setFilterDate(e.target.value)} style={{marginBottom:0}} /></div>
          <Btn variant="secondary" size="sm" onClick={()=>{setFilterEmp('');setFilterStatus('');setFilterDate('')}}>Clear</Btn>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr><Th>Employee</Th><Th>Date</Th><Th>Clock In</Th><Th>Clock Out</Th><Th>Break</Th><Th>Hours</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {entries.map(e => {
              const emp = employees.find(em=>em.id===e.employee_id)
              const hrs = entryHours(e); const ot = hrs > 8
              return <tr key={e.id} onMouseEnter={ev=>(ev.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={ev=>(ev.currentTarget as any).style.background=''}>
                <Td><div style={{display:'flex',alignItems:'center',gap:10}}><EmpAvatar emp={emp} /><div><div style={{fontWeight:700,fontSize:13}}>{emp?.first_name} {emp?.last_name?.[0]}.</div><div style={{fontSize:11,color:C.textMuted}}>{emp?.position}</div></div></div></Td>
                <Td>{e.clock_in?.slice(0,10)||'-'}</Td>
                <Td style={{fontFamily:'var(--font-mono)',fontSize:13}}>{e.clock_in?format(new Date(e.clock_in),'HH:mm'):'-'}</Td>
                <Td style={{fontFamily:'var(--font-mono)',fontSize:13}}>{e.clock_out?format(new Date(e.clock_out),'HH:mm'):<span style={{color:C.success,fontWeight:700}}>Active</span>}</Td>
                <Td>{e.break_mins||0}m</Td>
                <Td style={{fontFamily:'var(--font-mono)',fontWeight:700,color:ot?C.warning:C.text}}>{hrs.toFixed(2)}{ot?' OT':''}</Td>
                <Td><Badge color={e.status==='approved'?'green':e.status==='rejected'?'red':'yellow'}>{e.status}</Badge></Td>
                <Td><div style={{display:'flex',gap:5}}>
                  <Btn variant="secondary" size="sm" onClick={()=>{setEditEntry(e);setEditOpen(true)}}><Svg d={IC.edit} size={12} /></Btn>
                  {e.status==='pending'&&<><Btn variant="success" size="sm" onClick={()=>approve(e.id)}><Svg d={IC.check} size={12} /></Btn><Btn variant="danger" size="sm" onClick={()=>reject(e.id)}><Svg d={IC.x} size={12} /></Btn></>}
                </div></Td>
              </tr>
            })}
          </tbody>
        </table>
        {entries.length===0&&<div style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>No entries found</div>}
      </Card>
      <Popup open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Time Entry">
        {editEntry&&<><div style={{padding:'20px 24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Inp label="Clock In" type="datetime-local" value={editEntry.clock_in?.slice(0,16)||''} onChange={(e:any)=>setEditEntry(en=>en?{...en,clock_in:e.target.value}:en)} />
            <Inp label="Clock Out" type="datetime-local" value={editEntry.clock_out?.slice(0,16)||''} onChange={(e:any)=>setEditEntry(en=>en?{...en,clock_out:e.target.value}:en)} />
          </div>
          <Inp label="Break (minutes)" type="number" value={editEntry.break_mins||0} onChange={(e:any)=>setEditEntry(en=>en?{...en,break_mins:Number(e.target.value)}:en)} />
          <Inp label="Notes" value={editEntry.notes||''} onChange={(e:any)=>setEditEntry(en=>en?{...en,notes:e.target.value}:en)} rows={2} />
        </div><div style={{display:'flex',gap:10,justifyContent:'flex-end',padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
          <Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveEdit}>Save</Btn>
        </div></>}
      </Popup>
    </div>
  )
}

// TIME OFF
function TimeOffModule({ employees, panelUser }: { employees: Employee[]; panelUser: PanelUser }) {
  const [requests, setRequests] = useState<TimeOff[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { load() }, [filterStatus, filterType])

  async function load() {
    let q = supabase.from('time_off').select('*').order('created_at' as any, { ascending: false })
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterType) q = q.eq('type', filterType)
    const { data } = await q; setRequests(data || [])
  }

  async function approve(r: TimeOff) {
    await supabase.from('time_off').update({ status:'approved', reviewed_by:panelUser.id, reviewed_at:new Date().toISOString() }).eq('id', r.id)
    if (r.type==='vacation') { const emp=employees.find(e=>e.id===r.employee_id); if(emp) await supabase.from('employees').update({ pto_balance:Math.max(0,(emp.pto_balance||0)-r.days) }).eq('id',emp.id) }
    await supabase.from('notifications').insert({ employee_id:r.employee_id, title:'Time Off Approved', message:`Your ${r.type} request approved.`, type:'success', read:false })
    await logA(panelUser,'APPROVE_TIME_OFF','timeoff',{id:r.id}); load()
  }
  async function deny(r: TimeOff) {
    await supabase.from('time_off').update({ status:'rejected', reviewed_by:panelUser.id, reviewed_at:new Date().toISOString() }).eq('id', r.id)
    await supabase.from('notifications').insert({ employee_id:r.employee_id, title:'Time Off Denied', message:'Your request was denied.', type:'error', read:false })
    load()
  }

  const pending = requests.filter(r=>r.status==='pending').length

  return (
    <div>
      <PageHeader title="Time Off" sub="Manage employee time off requests" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <Kpi label="Total" value={requests.length} icon={IC.timeoff} />
        <Kpi label="Pending" value={pending} color={pending>0?C.warning:C.success} icon={IC.alert} />
        <Kpi label="Approved" value={requests.filter(r=>r.status==='approved').length} color={C.success} icon={IC.check} />
        <Kpi label="Denied" value={requests.filter(r=>r.status==='rejected').length} color={C.danger} icon={IC.x} />
      </div>
      <Card style={{ marginBottom:16, padding:14 }}>
        <div style={{ display:'flex', gap:10 }}>
          <Sel label="Status" value={filterStatus} onChange={(e:any)=>setFilterStatus(e.target.value)} style={{marginBottom:0,width:150}}><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Sel>
          <Sel label="Type" value={filterType} onChange={(e:any)=>setFilterType(e.target.value)} style={{marginBottom:0,width:150}}><option value="">All Types</option><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="unpaid">Unpaid</option></Sel>
          <Btn variant="secondary" size="sm" onClick={()=>{setFilterStatus('');setFilterType('')}}>Clear</Btn>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr><Th>Employee</Th><Th>Type</Th><Th>From</Th><Th>To</Th><Th>Days</Th><Th>Reason</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {requests.map(r => {
              const emp = employees.find(e=>e.id===r.employee_id)
              return <tr key={r.id} onMouseEnter={e=>(e.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                <Td><div style={{display:'flex',alignItems:'center',gap:10}}><EmpAvatar emp={emp} /><div><div style={{fontWeight:700,fontSize:13}}>{emp?.first_name} {emp?.last_name?.[0]}.</div><div style={{fontSize:11,color:C.textMuted}}>PTO: {emp?.pto_balance||0}d</div></div></div></Td>
                <Td><Badge color="gray">{r.type}</Badge></Td>
                <Td>{r.start_date}</Td><Td>{r.end_date}</Td>
                <Td style={{fontWeight:700}}>{r.days}</Td>
                <Td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.textSub}}>{r.reason||'-'}</Td>
                <Td><Badge color={r.status==='approved'?'green':r.status==='rejected'?'red':'yellow'}>{r.status}</Badge></Td>
                <Td>{r.status==='pending'&&<div style={{display:'flex',gap:5}}><Btn variant="success" size="sm" onClick={()=>approve(r)}>Approve</Btn><Btn variant="danger" size="sm" onClick={()=>deny(r)}>Deny</Btn></div>}</Td>
              </tr>
            })}
          </tbody>
        </table>
        {requests.length===0&&<div style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>No requests found</div>}
      </Card>
    </div>
  )
}

// EMPLOYEES
function EmployeesModule({ employees, departments, locations, setEmployees, panelUser }: { employees: Employee[]; departments: Department[]; locations: Location[]; setEmployees: (e:Employee[])=>void; panelUser: PanelUser }) {
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [selected, setSelected] = useState<Employee|null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState<Partial<Employee>>({})
  const [tab, setTab] = useState(0)
  const [inviteMsg, setInviteMsg] = useState('')
  const [recentActivations, setRecentActivations] = useState<any[]>([])

  // Realtime: reload employees when any employee row changes (activation)
  useEffect(() => {
    const ch = supabase.channel('admin-employees-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, async () => {
        const { data } = await supabase.from('employees').select('*').order('first_name')
        setEmployees(data || [])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panel_audit_log', filter: `module=eq.employees` }, (payload) => {
        if (payload.new?.action === 'EMPLOYEE_ACTIVATED') {
          setRecentActivations(prev => [payload.new, ...prev].slice(0, 5))
        }
      })
      .subscribe()
    loadRecentActivations()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadRecentActivations() {
    const { data } = await supabase.from('panel_audit_log')
      .select('*')
      .eq('module', 'employees')
      .eq('action', 'EMPLOYEE_ACTIVATED')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentActivations(data || [])
  }

  const filtered = employees.filter(e => {
    if (search && !empName(e).toLowerCase().includes(search.toLowerCase()) && !e.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDept && e.department_id !== filterDept) return false
    if (filterStatus && e.status !== filterStatus) return false
    return true
  })

  async function openEmp(emp: Employee) { setSelected(emp); setEditData({...emp}); setTab(0); setModalOpen(true); setInviteMsg('') }
  async function save() {
    if (!selected) return
    await supabase.from('employees').update(editData).eq('id', selected.id)
    await logA(panelUser,'UPDATE_EMPLOYEE','employees',{id:selected.id})
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data||[]); setModalOpen(false)
  }
  async function sendInvite(empId: string) {
    setInviteMsg('Sending...')
    const res = await fetch('/api/invite', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ employee_id:empId, base_url:window.location.origin }) })
    const data = await res.json()
    setInviteMsg(data.success ? 'Sent!' : 'Error'); setTimeout(()=>setInviteMsg(''), 3000)
  }

  const TABS = ['Personal','Employment','Bank','Notes']

  return (
    <div>
      <PageHeader title="Employees" sub={`${employees.filter(e=>e.status==='active').length} active`} />

      {/* Recent activations feed */}
      {recentActivations.length > 0 && (
        <Card style={{ marginBottom: 16, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            Recent Account Activations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentActivations.map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                <Svg d={IC.check} size={14} color="#059669" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.details?.name}</div>
                  <div style={{ fontSize: 11, color: C.textSub }}>{a.details?.email} · {a.details?.position}</div>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>
                  {a.created_at ? format(new Date(a.created_at), 'MMM d HH:mm') : ''}
                </div>
                <Badge color="green">Activated</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <Kpi label="Total" value={employees.length} icon={IC.employees} />
        <Kpi label="Active" value={employees.filter(e=>e.status==='active').length} color={C.success} icon={IC.check} />
        <Kpi label="Pending" value={employees.filter(e=>e.status==='pending_activation').length} color={C.warning} icon={IC.alert} />
        <Kpi label="Inactive" value={employees.filter(e=>e.status==='inactive').length} color={C.textMuted} icon={IC.x} />
      </div>
      <Card style={{ marginBottom:16, padding:14 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Inp label="" value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Search name or email..." style={{marginBottom:0,width:220}} />
          <Sel label="" value={filterDept} onChange={(e:any)=>setFilterDept(e.target.value)} style={{marginBottom:0,width:180}}><option value="">All Departments</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Sel>
          <Sel label="" value={filterStatus} onChange={(e:any)=>setFilterStatus(e.target.value)} style={{marginBottom:0,width:150}}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending_activation">Pending</option></Sel>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr><Th>Employee</Th><Th>Position</Th><Th>Department</Th><Th>Type</Th><Th>Rate</Th><Th>PTO</Th><Th>Status</Th></tr></thead>
          <tbody>
            {filtered.map(e => {
              const dept = departments.find(d=>d.id===e.department_id)
              return <tr key={e.id} style={{cursor:'pointer'}} onClick={()=>openEmp(e)} onMouseEnter={ev=>(ev.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={ev=>(ev.currentTarget as any).style.background=''}>
                <Td><div style={{display:'flex',alignItems:'center',gap:10}}><EmpAvatar emp={e} deptColor={dept?.color} /><div><div style={{fontWeight:700,fontSize:13}}>{e.first_name} {e.last_name?.[0]}.</div><div style={{fontSize:11,color:C.textMuted}}>{e.email}</div></div></div></Td>
                <Td>{e.position||'-'}</Td>
                <Td>{dept?<Badge color="blue">{dept.name}</Badge>:'-'}</Td>
                <Td style={{textTransform:'capitalize'}}>{e.employment_type}</Td>
                <Td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{e.hourly_rate?'$'+e.hourly_rate+'/hr':e.salary_annual?fmtMoney(e.salary_annual)+'/yr':'-'}</Td>
                <Td>{e.pto_balance>0?<span style={{fontFamily:'var(--font-mono)',fontSize:12}}>{e.pto_balance}d</span>:<span style={{color:C.textMuted}}>-</span>}</Td>
                <Td><Badge color={e.status==='active'?'green':e.status==='pending_activation'?'yellow':'gray'}>{e.status?.replace('_',' ')}</Badge></Td>
              </tr>
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>No employees found</div>}
      </Card>
      <Popup open={modalOpen} onClose={()=>setModalOpen(false)} title={selected?empName(selected):''} wide>
        {selected&&<>
          <div style={{padding:'16px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:16}}>
            <EmpAvatar emp={selected} size={56} />
            <div style={{flex:1}}><div style={{fontWeight:900,fontSize:18}}>{empName(selected)}</div><div style={{color:C.textSub,fontSize:13}}>{selected.position} · {selected.email}</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <Btn variant="ghost" size="sm" onClick={()=>sendInvite(selected.id)}>Resend Invite</Btn>
              {inviteMsg&&<span style={{fontSize:12,fontWeight:700,color:inviteMsg.includes('Error')?C.danger:C.success}}>{inviteMsg}</span>}
            </div>
          </div>
          <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,padding:'0 24px'}}>
            {TABS.map((t,i)=><button key={i} onClick={()=>setTab(i)} style={{padding:'12px 16px',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:tab===i?700:500,color:tab===i?C.accent:C.textSub,borderBottom:tab===i?`2px solid ${C.accent}`:'2px solid transparent',fontFamily:'inherit'}}>{t}</button>)}
          </div>
          <div style={{padding:'20px 24px'}}>
            {tab===0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Inp label="First Name" value={editData.first_name||''} onChange={(e:any)=>setEditData(d=>({...d,first_name:e.target.value}))} />
              <Inp label="Last Name" value={editData.last_name||''} onChange={(e:any)=>setEditData(d=>({...d,last_name:e.target.value}))} />
              <Inp label="Email" type="email" value={editData.email||''} onChange={(e:any)=>setEditData(d=>({...d,email:e.target.value}))} />
              <Inp label="Phone" value={editData.phone||''} onChange={(e:any)=>setEditData(d=>({...d,phone:e.target.value}))} />
              <Inp label="Position" value={editData.position||''} onChange={(e:any)=>setEditData(d=>({...d,position:e.target.value}))} />
              <Sel label="Department" value={editData.department_id||''} onChange={(e:any)=>setEditData(d=>({...d,department_id:e.target.value}))}><option value="">None</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Sel>
              <Inp label="Hire Date" type="date" value={editData.hire_date||''} onChange={(e:any)=>setEditData(d=>({...d,hire_date:e.target.value}))} />
              <Sel label="Language" value={editData.language||'en'} onChange={(e:any)=>setEditData(d=>({...d,language:e.target.value}))}><option value="en">English</option><option value="es">Espanol</option></Sel>
            </div>}
            {tab===1&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="Employment Type" value={editData.employment_type||''} onChange={(e:any)=>setEditData(d=>({...d,employment_type:e.target.value}))}><option value="fulltime">Full Time</option><option value="parttime">Part Time</option><option value="contract">Contract</option></Sel>
              <Sel label="Location" value={editData.location_id||''} onChange={(e:any)=>setEditData(d=>({...d,location_id:e.target.value}))}><option value="">None</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel>
              <Inp label="Hourly Rate ($)" type="number" value={editData.hourly_rate||0} onChange={(e:any)=>setEditData(d=>({...d,hourly_rate:Number(e.target.value)}))} />
              <Inp label="Annual Salary ($)" type="number" value={editData.salary_annual||0} onChange={(e:any)=>setEditData(d=>({...d,salary_annual:Number(e.target.value)}))} />
              <Inp label="PTO Balance (days)" type="number" value={editData.pto_balance||0} onChange={(e:any)=>setEditData(d=>({...d,pto_balance:Number(e.target.value)}))} />
              <Sel label="Status" value={editData.status||''} onChange={(e:any)=>setEditData(d=>({...d,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending_activation">Pending</option></Sel>
            </div>}
            {tab===2&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Inp label="Bank Name" value={editData.bank_name||''} onChange={(e:any)=>setEditData(d=>({...d,bank_name:e.target.value}))} />
              <Sel label="Account Type" value={editData.bank_account_type||''} onChange={(e:any)=>setEditData(d=>({...d,bank_account_type:e.target.value}))}><option value="">Select...</option><option value="checking">Checking</option><option value="savings">Savings</option></Sel>
              <Inp label="Routing Number" value={editData.bank_routing||''} onChange={(e:any)=>setEditData(d=>({...d,bank_routing:e.target.value}))} />
              <Inp label="Account Number" value={editData.bank_account||''} onChange={(e:any)=>setEditData(d=>({...d,bank_account:e.target.value}))} />
            </div>}
            {tab===3&&<Inp label="Internal Notes" value={editData.internal_notes||''} onChange={(e:any)=>setEditData(d=>({...d,internal_notes:e.target.value}))} rows={5} />}
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
            <Btn variant="secondary" onClick={()=>setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save}>Save Changes</Btn>
          </div>
        </>}
      </Popup>
    </div>
  )
}

// PAYROLL
function PayrollModule({ employees, panelUser }: { employees: Employee[]; panelUser: PanelUser }) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [selected, setSelected] = useState<PayrollPeriod|null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [paystubOpen, setPaystubOpen] = useState(false)
  const [paystubEntry, setPaystubEntry] = useState<PayrollEntry|null>(null)
  const [newPeriod, setNewPeriod] = useState({ frequency:'biweekly', start_date:'', end_date:'', pay_date:'' })
  const [running, setRunning] = useState(false)

  useEffect(() => { loadPeriods() }, [])
  async function loadPeriods() { const { data } = await supabase.from('payroll_periods').select('*').order('start_date',{ascending:false}); setPeriods(data||[]) }
  async function loadEntries(p: PayrollPeriod) { setSelected(p); const { data } = await supabase.from('payroll_entries').select('*').eq('period_id',p.id); setEntries(data||[]) }

  async function createPeriod() {
    await supabase.from('payroll_periods').insert({...newPeriod,status:'draft'})
    await logA(panelUser,'CREATE_PAYROLL_PERIOD','payroll',{...newPeriod})
    setCreateOpen(false); setNewPeriod({frequency:'biweekly',start_date:'',end_date:'',pay_date:''}); loadPeriods()
  }

  async function runPayroll(p: PayrollPeriod) {
    setRunning(true)
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in',p.start_date).lte('clock_in',p.end_date+'T23:59:59').eq('status','approved')
    for (const emp of employees.filter(e=>e.status==='active')) {
      const empEntries = (te||[]).filter(e=>e.employee_id===emp.id)
      const { regular, overtime } = calculateHours(empEntries)
      const pay = calculatePay(emp, regular, overtime)
      await supabase.from('payroll_entries').upsert({ period_id:p.id, employee_id:emp.id, ...pay, bank_routing:emp.bank_routing||'', bank_account:emp.bank_account||'', bank_account_type:emp.bank_account_type||'', bank_name:emp.bank_name||'', status:'pending' }, { onConflict:'period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({status:'processed'}).eq('id',p.id)
    await logA(panelUser,'RUN_PAYROLL','payroll',{period_id:p.id})
    setRunning(false); loadPeriods(); loadEntries(p)
  }

  async function markPaid(p: PayrollPeriod) {
    await supabase.from('payroll_periods').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',p.id)
    await supabase.from('payroll_entries').update({status:'paid'}).eq('period_id',p.id)
    await logA(panelUser,'MARK_PAYROLL_PAID','payroll',{period_id:p.id})
    loadPeriods(); if(selected?.id===p.id) loadEntries(p)
  }

  const totalGross = entries.reduce((s,e)=>s+e.gross_pay,0)
  const totalNet = entries.reduce((s,e)=>s+e.net_pay,0)

  return (
    <div>
      <PageHeader title="Payroll" sub="Process and manage employee payroll">
        <Btn variant="primary" size="sm" onClick={()=>setCreateOpen(true)}><Svg d={IC.plus} size={13} />New Period</Btn>
      </PageHeader>
      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, alignItems:'start' }}>
        <Card pad={0}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:800,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Pay Periods</div>
          {periods.map(p=><div key={p.id} onClick={()=>loadEntries(p)} style={{padding:'13px 16px',borderBottom:`1px solid #F8FAFC`,cursor:'pointer',background:selected?.id===p.id?C.accentLight:'transparent',borderLeft:selected?.id===p.id?`3px solid ${C.accent}`:'3px solid transparent',transition:'all 0.15s'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontWeight:700,fontSize:13}}>{p.start_date} — {p.end_date}</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Pay: {p.pay_date} · {p.frequency}</div></div>
              <Badge color={p.status==='paid'?'green':p.status==='processed'?'blue':'gray'}>{p.status}</Badge>
            </div>
          </div>)}
          {periods.length===0&&<div style={{textAlign:'center',padding:'32px 0',color:C.textMuted,fontSize:13}}>No periods yet</div>}
        </Card>
        <div>
          {selected?<>
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
              <Btn variant="primary" size="sm" onClick={()=>runPayroll(selected)} disabled={running}><Svg d={IC.refresh} size={13} />{running?'Running...':'Run Payroll'}</Btn>
              <Btn variant="success" size="sm" onClick={()=>markPaid(selected)}>Mark as Paid</Btn>
              <Btn variant="secondary" size="sm" onClick={()=>downloadBlob(generateNACHA(entries,employees,selected.id),'payroll.ach')}><Svg d={IC.download} size={13} />NACHA</Btn>
              <Btn variant="secondary" size="sm" onClick={()=>{ const rows=[['Employee','Reg Hrs','OT Hrs','Gross','Federal','FICA','State','Net','Status']]; entries.forEach(e=>{const emp=employees.find(em=>em.id===e.employee_id);rows.push([empName(emp),String(e.regular_hours),String(e.overtime_hours),String(e.gross_pay),String(e.federal_tax),String(e.fica),String(e.state_tax),String(e.net_pay),e.status])}); downloadBlob(rows.map(r=>r.join(',')).join('\n'),'payroll.csv','text/csv') }}><Svg d={IC.download} size={13} />CSV</Btn>
            </div>
            {entries.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
              <Kpi label="Total Gross" value={fmtMoney(totalGross)} color={C.accent} icon={IC.dollar} />
              <Kpi label="Total Net" value={fmtMoney(totalNet)} color={C.success} icon={IC.bank} />
              <Kpi label="Employees" value={entries.length} icon={IC.employees} />
            </div>}
            <Card pad={0}><div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><Th>Employee</Th><Th>Reg</Th><Th>OT</Th><Th>Gross</Th><Th>Fed Tax</Th><Th>FICA</Th><Th>State</Th><Th>Net Pay</Th><Th>Status</Th><Th></Th></tr></thead>
                <tbody>
                  {entries.map(e=>{const emp=employees.find(em=>em.id===e.employee_id); return <tr key={e.id} onMouseEnter={ev=>(ev.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={ev=>(ev.currentTarget as any).style.background=''}>
                    <Td><div style={{fontWeight:700,fontSize:13}}>{emp?.first_name} {emp?.last_name?.[0]}.</div><div style={{fontSize:11,color:C.textMuted}}>{emp?.position}</div></Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{e.regular_hours}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:12,color:e.overtime_hours>0?C.warning:C.text,fontWeight:e.overtime_hours>0?700:400}}>{e.overtime_hours}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{fmtMoney(e.gross_pay)}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:11,color:C.textSub}}>{fmtMoney(e.federal_tax)}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:11,color:C.textSub}}>{fmtMoney(e.fica)}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:11,color:C.textSub}}>{fmtMoney(e.state_tax)}</Td>
                    <Td style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:800,color:C.success}}>{fmtMoney(e.net_pay)}</Td>
                    <Td><Badge color={e.status==='paid'?'green':'gray'}>{e.status}</Badge></Td>
                    <Td><Btn variant="ghost" size="sm" onClick={()=>{setPaystubEntry(e);setPaystubOpen(true)}}>Paystub</Btn></Td>
                  </tr>})}
                </tbody>
              </table>
              {entries.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:C.textMuted,fontSize:13}}>Run payroll to generate entries</div>}
            </div></Card>
          </>:<Card style={{textAlign:'center',padding:'60px 0'}}><Svg d={IC.payroll} size={48} color={C.border} /><div style={{marginTop:16,fontSize:16,fontWeight:700,color:C.text}}>Select a pay period</div><div style={{fontSize:13,color:C.textMuted,marginTop:6}}>Choose from the left or create a new one</div></Card>}
        </div>
      </div>

      <Popup open={createOpen} onClose={()=>setCreateOpen(false)} title="Create Pay Period">
        <div style={{padding:'20px 24px'}}>
          <Sel label="Frequency" value={newPeriod.frequency} onChange={(e:any)=>setNewPeriod(p=>({...p,frequency:e.target.value}))}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="semimonthly">Semi-monthly</option><option value="monthly">Monthly</option></Sel>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Inp label="Start Date" type="date" value={newPeriod.start_date} onChange={(e:any)=>setNewPeriod(p=>({...p,start_date:e.target.value}))} />
            <Inp label="End Date" type="date" value={newPeriod.end_date} onChange={(e:any)=>setNewPeriod(p=>({...p,end_date:e.target.value}))} />
          </div>
          <Inp label="Pay Date" type="date" value={newPeriod.pay_date} onChange={(e:any)=>setNewPeriod(p=>({...p,pay_date:e.target.value}))} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
          <Btn variant="secondary" onClick={()=>setCreateOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={createPeriod}>Create</Btn>
        </div>
      </Popup>

      {paystubEntry&&<Popup open={paystubOpen} onClose={()=>setPaystubOpen(false)} title="Pay Statement">
        <div style={{padding:'24px 28px'}}>
          {(()=>{ const emp=employees.find(e=>e.id===paystubEntry.employee_id); const period=periods.find(p=>p.id===paystubEntry.period_id); return <>
            <div style={{textAlign:'center',marginBottom:24,paddingBottom:20,borderBottom:`2px solid ${C.border}`}}>
              <div style={{fontSize:24,fontWeight:900,color:C.text}}>StaffForce</div>
              <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Pay Statement</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
              <div><div style={{fontWeight:700,marginBottom:4,fontSize:12,color:C.textMuted,textTransform:'uppercase'}}>Employee</div><div style={{fontWeight:700}}>{empName(emp)}</div><div style={{fontSize:12,color:C.textSub}}>{emp?.position}</div><div style={{fontSize:12,color:C.textSub}}>{emp?.email}</div></div>
              <div><div style={{fontWeight:700,marginBottom:4,fontSize:12,color:C.textMuted,textTransform:'uppercase'}}>Pay Period</div><div>{period?.start_date} to {period?.end_date}</div><div style={{fontSize:12,color:C.textSub}}>Pay Date: {period?.pay_date}</div></div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
              <thead><tr style={{borderBottom:`2px solid ${C.border}`}}><th style={{textAlign:'left',padding:'6px 0',fontSize:11,color:C.textMuted}}>Description</th><th style={{textAlign:'right',fontSize:11,color:C.textMuted}}>Hours</th><th style={{textAlign:'right',fontSize:11,color:C.textMuted}}>Amount</th></tr></thead>
              <tbody>
                <tr style={{borderBottom:`1px solid #F8FAFC`}}><td style={{padding:'8px 0'}}>Regular Pay</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:13}}>{paystubEntry.regular_hours}</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:13}}>{fmtMoney(paystubEntry.regular_pay)}</td></tr>
                {paystubEntry.overtime_hours>0&&<tr style={{borderBottom:`1px solid #F8FAFC`}}><td style={{padding:'8px 0'}}>Overtime (1.5x)</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:13}}>{paystubEntry.overtime_hours}</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:13}}>{fmtMoney(paystubEntry.overtime_pay)}</td></tr>}
                <tr style={{borderTop:`2px solid ${C.border}`}}><td colSpan={2} style={{padding:'8px 0',fontWeight:700}}>Gross Pay</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700}}>{fmtMoney(paystubEntry.gross_pay)}</td></tr>
              </tbody>
            </table>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20}}>
              <thead><tr style={{borderBottom:`2px solid ${C.border}`}}><th style={{textAlign:'left',padding:'6px 0',fontSize:11,color:C.textMuted}}>Deductions</th><th style={{textAlign:'right',fontSize:11,color:C.textMuted}}>Amount</th></tr></thead>
              <tbody>
                {[['Federal Tax (12%)',paystubEntry.federal_tax],['FICA (7.65%)',paystubEntry.fica],['State Tax (4%)',paystubEntry.state_tax],['Health Insurance',paystubEntry.health_insurance],['401(k) (3%)',paystubEntry.retirement_401k]].map(([l,a])=><tr key={l as string} style={{borderBottom:`1px solid #F8FAFC`}}><td style={{padding:'7px 0',color:C.textSub}}>{l}</td><td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:13,color:C.textSub}}>-{fmtMoney(a as number)}</td></tr>)}
              </tbody>
            </table>
            <div style={{background:C.successBg,padding:'16px 20px',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:800,color:C.success}}>Net Pay</span>
              <span style={{fontSize:26,fontFamily:'var(--font-mono)',fontWeight:900,color:C.success}}>{fmtMoney(paystubEntry.net_pay)}</span>
            </div>
            {paystubEntry.bank_name&&<div style={{marginTop:12,fontSize:12,color:C.textMuted,textAlign:'center'}}>Direct Deposit to {paystubEntry.bank_name} ****{paystubEntry.bank_account?.slice(-4)}</div>}
          </>})()}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
          <Btn variant="secondary" onClick={()=>setPaystubOpen(false)}>Close</Btn>
          <Btn variant="primary" onClick={()=>window.print()}>Print</Btn>
        </div>
      </Popup>}
    </div>
  )
}

// REPORTS
function ReportsModule({ employees, departments, panelUser }: { employees: Employee[]; departments: Department[]; panelUser: PanelUser }) {
  const [type, setType] = useState<'hours'|'labor'|'attendance'|'overtime'>('hours')
  const [from, setFrom] = useState(format(addDays(new Date(),-30),'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(),'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in',from).lte('clock_in',to+'T23:59:59')
    const entries: TimeEntry[] = te || []

    if (type==='hours') {
      setData(employees.map(e=>({ name:`${e.first_name} ${e.last_name?.[0]}.`, dept:departments.find(d=>d.id===e.department_id)?.name||'-', hours:entries.filter(x=>x.employee_id===e.id).reduce((s,x)=>s+entryHours(x),0), count:entries.filter(x=>x.employee_id===e.id).length })).filter(r=>r.hours>0).sort((a,b)=>b.hours-a.hours))
    } else if (type==='labor') {
      setData(employees.map(e=>{ const hrs=entries.filter(x=>x.employee_id===e.id).reduce((s,x)=>s+entryHours(x),0); const rate=e.hourly_rate||(e.salary_annual?e.salary_annual/52/40:0); return { name:`${e.first_name} ${e.last_name?.[0]}.`, dept:departments.find(d=>d.id===e.department_id)?.name||'-', hours:hrs, rate, cost:hrs*rate } }).filter(r=>r.hours>0).sort((a,b)=>b.cost-a.cost))
    } else if (type==='attendance') {
      const { data: sh } = await supabase.from('shifts').select('*').gte('start_time',from).lte('start_time',to+'T23:59:59')
      const allShifts: Shift[] = sh || []
      setData(employees.map(e=>({ name:`${e.first_name} ${e.last_name?.[0]}.`, dept:departments.find(d=>d.id===e.department_id)?.name||'-', scheduled:allShifts.filter(s=>s.employee_id===e.id).length, present:entries.filter(x=>x.employee_id===e.id&&x.clock_out).length, absent:Math.max(0,allShifts.filter(s=>s.employee_id===e.id).length-entries.filter(x=>x.employee_id===e.id&&x.clock_out).length) })).filter(r=>r.scheduled>0))
    } else {
      setData(employees.map(e=>{ const empEntries=entries.filter(x=>x.employee_id===e.id); const { regular,overtime }=calculateHours(empEntries); return { name:`${e.first_name} ${e.last_name?.[0]}.`, dept:departments.find(d=>d.id===e.department_id)?.name||'-', regular, overtime, total:regular+overtime } }).filter(r=>r.total>0).sort((a,b)=>b.overtime-a.overtime))
    }
    await logA(panelUser,'GENERATE_REPORT','reports',{type,from,to}); setLoading(false)
  }

  const maxVal = data.length>0 ? Math.max(...data.map(r=>r.hours||r.cost||r.scheduled||r.total||1)) : 1
  const COLORS = [C.accent,'#7C3AED',C.success,C.warning,C.danger,'#0891B2','#DB2777']

  return (
    <div>
      <PageHeader title="Reports" sub="Analytics and workforce insights">
        {data.length>0&&<Btn variant="secondary" size="sm" onClick={()=>{ const rows=[Object.keys(data[0])]; data.forEach(r=>rows.push(Object.values(r).map(String))); downloadBlob(rows.map(r=>r.join(',')).join('\n'),`report_${type}.csv`,'text/csv') }}><Svg d={IC.download} size={13} />Export CSV</Btn>}
      </PageHeader>
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
            {([['hours','Hours'],['labor','Labor Cost'],['attendance','Attendance'],['overtime','Overtime']] as const).map(([v,l])=><button key={v} onClick={()=>setType(v)} style={{padding:'7px 16px',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:type===v?C.accent:'transparent',color:type===v?'#fff':C.textSub}}>{l}</button>)}
          </div>
          <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.textSub,marginBottom:4}}>FROM</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'7px 10px',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none'}} /></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.textSub,marginBottom:4}}>TO</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'7px 10px',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none'}} /></div>
            <Btn variant="primary" onClick={generate} disabled={loading}>{loading?'Generating...':'Generate'}</Btn>
          </div>
        </div>
      </Card>

      {data.length>0&&<>
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:16}}>Chart Overview</div>
          <div style={{overflowX:'auto'}}>
            <svg width={Math.max(700,data.length*70)} height={300} style={{display:'block'}}>
              {[0.25,0.5,0.75,1].map(pct=><g key={pct}>
                <line x1="60" y1={240-pct*200} x2={Math.max(700,data.length*70)-20} y2={240-pct*200} stroke="#F1F5F9" strokeWidth="1" />
                <text x="55" y={244-pct*200} textAnchor="end" fontSize="10" fill={C.textMuted}>{type==='labor'?'$'+Math.round(maxVal*pct):Math.round(maxVal*pct*10)/10}</text>
              </g>)}
              {data.map((r,i)=>{
                const val=r.hours||r.cost||r.scheduled||r.total||0
                const h=Math.max(4,(val/maxVal)*200); const x=70+i*70; const col=COLORS[i%COLORS.length]
                return <g key={i}>
                  <rect x={x-20} y={240-h} width={40} height={h} rx={5} fill={col} opacity={0.85} />
                  <text x={x} y={240-h-6} textAnchor="middle" fontSize="11" fill={C.text} fontFamily="var(--font-mono)" fontWeight="700">{type==='labor'?'$'+Math.round(val):Math.round(val*10)/10}</text>
                  <text x={x} y={258} textAnchor="middle" fontSize="10" fill={C.textSub}>{r.name.split(' ')[0]}</text>
                  <text x={x} y={270} textAnchor="middle" fontSize="9" fill={C.textMuted}>{r.dept}</text>
                </g>
              })}
              <line x1="60" y1="240" x2={Math.max(700,data.length*70)-20} y2="240" stroke={C.border} strokeWidth="1.5" />
            </svg>
          </div>
        </Card>
        <Card pad={0}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <Th>Employee</Th><Th>Department</Th>
              {type==='hours'&&<><Th>Hours</Th><Th>Entries</Th></>}
              {type==='labor'&&<><Th>Hours</Th><Th>Rate</Th><Th>Labor Cost</Th></>}
              {type==='attendance'&&<><Th>Scheduled</Th><Th>Present</Th><Th>Absent</Th><Th>Rate</Th></>}
              {type==='overtime'&&<><Th>Regular</Th><Th>Overtime</Th><Th>Total</Th></>}
            </tr></thead>
            <tbody>
              {data.map((r,i)=><tr key={i} onMouseEnter={e=>(e.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                <Td style={{fontWeight:700}}>{r.name}</Td>
                <Td><Badge color="gray">{r.dept}</Badge></Td>
                {type==='hours'&&<><Td style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{r.hours.toFixed(2)}</Td><Td>{r.count}</Td></>}
                {type==='labor'&&<><Td style={{fontFamily:'var(--font-mono)'}}>{r.hours.toFixed(2)}</Td><Td style={{fontFamily:'var(--font-mono)'}}>{fmtMoney(r.rate)}/hr</Td><Td style={{fontFamily:'var(--font-mono)',fontWeight:800,color:C.accent}}>{fmtMoney(r.cost)}</Td></>}
                {type==='attendance'&&<><Td>{r.scheduled}</Td><Td style={{color:C.success,fontWeight:700}}>{r.present}</Td><Td style={{color:r.absent>0?C.danger:C.text,fontWeight:r.absent>0?700:400}}>{r.absent}</Td><Td style={{fontWeight:700,color:r.scheduled>0&&r.present/r.scheduled>=0.8?C.success:C.warning}}>{r.scheduled>0?Math.round(r.present/r.scheduled*100)+'%':'-'}</Td></>}
                {type==='overtime'&&<><Td style={{fontFamily:'var(--font-mono)'}}>{r.regular.toFixed(2)}</Td><Td style={{fontFamily:'var(--font-mono)',fontWeight:700,color:r.overtime>0?C.warning:C.text}}>{r.overtime.toFixed(2)}</Td><Td style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{r.total.toFixed(2)}</Td></>}
              </tr>)}
            </tbody>
          </table>
        </Card>
      </>}
      {data.length===0&&!loading&&<Card style={{textAlign:'center',padding:'60px 0'}}><Svg d={IC.reports} size={48} color={C.border} /><div style={{marginTop:16,fontSize:16,fontWeight:700,color:C.text}}>Select a report type and date range</div><div style={{fontSize:13,color:C.textMuted,marginTop:6}}>Then click Generate to view analytics</div></Card>}
    </div>
  )
}

// PANEL USERS
function PanelUsersModule({ employees, panelUsers, setPanelUsers, isOwner, panelUser }: { employees: Employee[]; panelUsers: PanelUser[]; setPanelUsers:(u:PanelUser[])=>void; isOwner:boolean; panelUser:PanelUser }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ employee_id:'', email:'', password_hash:'', full_name:'' })
  const [msg, setMsg] = useState('')

  async function reload() { const { data } = await supabase.from('panel_users').select('*').order('created_at',{ascending:false}); setPanelUsers(data||[]) }
  async function create() {
    if (!form.email||!form.password_hash||!form.full_name) { setMsg('All fields required'); return }
    await supabase.from('panel_users').insert({...form,status:'active',created_by:panelUser.email})
    await logA(panelUser,'CREATE_PANEL_USER','users',{email:form.email,name:form.full_name})
    setAddOpen(false); setForm({employee_id:'',email:'',password_hash:'',full_name:''}); reload()
  }
  async function toggle(id:string,current:string) { const next=current==='active'?'suspended':'active'; await supabase.from('panel_users').update({status:next}).eq('id',id); await logA(panelUser,next==='suspended'?'SUSPEND_USER':'ACTIVATE_USER','users',{id}); reload() }
  async function del(id:string,email:string) { if(!confirm('Delete this user?')) return; await supabase.from('panel_users').delete().eq('id',id); await logA(panelUser,'DELETE_PANEL_USER','users',{id,email}); reload() }

  if (!isOwner) return <Card style={{textAlign:'center',padding:'60px 0'}}><Svg d={IC.shield} size={48} color={C.border} /><div style={{marginTop:16,fontSize:16,fontWeight:700}}>Owner Access Only</div><div style={{fontSize:13,color:C.textMuted,marginTop:6}}>Only the owner can manage panel users</div></Card>

  return (
    <div>
      <PageHeader title="Panel Users" sub="Manage who has access to this control panel">
        <Btn variant="primary" size="sm" onClick={()=>setAddOpen(true)}><Svg d={IC.plus} size={13} />Create User</Btn>
      </PageHeader>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <Kpi label="Total Users" value={panelUsers.length} icon={IC.users} />
        <Kpi label="Active" value={panelUsers.filter(u=>u.status==='active').length} color={C.success} icon={IC.check} />
        <Kpi label="Suspended" value={panelUsers.filter(u=>u.status==='suspended').length} color={C.danger} icon={IC.x} />
      </div>
      <Card pad={0}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><Th>User</Th><Th>Linked Employee</Th><Th>Created By</Th><Th>Created</Th><Th>Last Login</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {panelUsers.map(u=>{const emp=employees.find(e=>e.id===u.employee_id); return <tr key={u.id} onMouseEnter={e=>(e.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
              <Td><div style={{fontWeight:700,fontSize:13}}>{u.full_name}</div><div style={{fontSize:11,color:C.textMuted}}>{u.email}</div></Td>
              <Td>{emp?`${emp.first_name} ${emp.last_name?.[0]}.`:<span style={{color:C.textMuted}}>Not linked</span>}</Td>
              <Td style={{fontSize:12,color:C.textSub}}>{u.created_by}</Td>
              <Td style={{fontSize:12,color:C.textSub}}>{u.created_at?format(new Date(u.created_at),'MMM d, yyyy'):'-'}</Td>
              <Td style={{fontSize:12,color:C.textSub}}>{u.last_login_at?format(new Date(u.last_login_at),'MMM d HH:mm'):<span style={{color:C.textMuted}}>Never</span>}</Td>
              <Td><Badge color={u.status==='active'?'green':'red'}>{u.status}</Badge></Td>
              <Td><div style={{display:'flex',gap:6}}><Btn variant={u.status==='active'?'warning':'success'} size="sm" onClick={()=>toggle(u.id,u.status)}>{u.status==='active'?'Suspend':'Activate'}</Btn><Btn variant="danger" size="sm" onClick={()=>del(u.id,u.email)}>Delete</Btn></div></Td>
            </tr>})}
            {panelUsers.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>No panel users yet</td></tr>}
          </tbody>
        </table>
      </Card>
      <Popup open={addOpen} onClose={()=>setAddOpen(false)} title="Create Panel User">
        <div style={{padding:'20px 24px'}}>
          <div style={{background:C.accentLight,border:`1px solid ${C.accentBorder}`,borderRadius:8,padding:'10px 14px',marginBottom:18,fontSize:13,color:C.accent}}>This user will have full access to the control panel. All their actions will be logged in the audit trail.</div>
          <Inp label="Full Name" value={form.full_name} onChange={(e:any)=>setForm(f=>({...f,full_name:e.target.value}))} />
          <Inp label="Email" type="email" value={form.email} onChange={(e:any)=>setForm(f=>({...f,email:e.target.value}))} />
          <Inp label="Password" type="password" value={form.password_hash} onChange={(e:any)=>setForm(f=>({...f,password_hash:e.target.value}))} />
          <Sel label="Link to Employee (optional)" value={form.employee_id} onChange={(e:any)=>setForm(f=>({...f,employee_id:e.target.value}))}><option value="">Not linked</option>{employees.map(e=><option key={e.id} value={e.id}>{empName(e)}</option>)}</Sel>
          {msg&&<div style={{background:C.dangerBg,border:'1px solid #FECACA',borderRadius:7,padding:'8px 12px',fontSize:13,color:C.danger}}>{msg}</div>}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
          <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={create}>Create User</Btn>
        </div>
      </Popup>
    </div>
  )
}

// AUDIT LOG
function AuditModule({ panelUser }: { panelUser: PanelUser }) {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filterModule, setFilterModule] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterModule, filterUser])
  async function load() {
    setLoading(true)
    let q = supabase.from('panel_audit_log').select('*').order('created_at',{ascending:false}).limit(300)
    if (filterModule) q = q.eq('module',filterModule)
    if (filterUser) q = q.ilike('panel_user_email',`%${filterUser}%`)
    const { data } = await q; setLogs(data||[]); setLoading(false)
  }

  const actionColors: Record<string,string> = { LOGIN:'blue',LOGOUT:'gray',CREATE_PANEL_USER:'green',DELETE_PANEL_USER:'red',SUSPEND_USER:'yellow',ACTIVATE_USER:'green',APPROVE_TIMESHEET:'green',REJECT_TIMESHEET:'red',APPROVE_ALL:'green',APPROVE_TIME_OFF:'green',DENY_TIME_OFF:'red',PUBLISH_SCHEDULE:'blue',RUN_PAYROLL:'purple',MARK_PAYROLL_PAID:'green',GENERATE_REPORT:'blue',UPDATE_EMPLOYEE:'blue',UPDATE_OWNER_CREDENTIALS:'purple',EDIT_TIMESHEET:'yellow',CREATE_PAYROLL_PERIOD:'blue' }

  return (
    <div>
      <PageHeader title="Audit Log" sub="Complete record of all control panel actions">
        <Btn variant="secondary" size="sm" onClick={load}><Svg d={IC.refresh} size={13} />Refresh</Btn>
        <Btn variant="secondary" size="sm" onClick={()=>{ const rows=[['Date','User','Email','Action','Module','Details']]; logs.forEach(l=>rows.push([l.created_at,l.panel_user_name,l.panel_user_email,l.action,l.module,JSON.stringify(l.details)])); downloadBlob(rows.map(r=>r.join(',')).join('\n'),'audit_log.csv','text/csv') }}><Svg d={IC.download} size={13} />Export</Btn>
      </PageHeader>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        <Kpi label="Total Records" value={logs.length} icon={IC.audit} />
        <Kpi label="Today" value={logs.filter(l=>l.created_at?.slice(0,10)===format(new Date(),'yyyy-MM-dd')).length} color={C.accent} icon={IC.clock} />
        <Kpi label="Approvals" value={logs.filter(l=>l.action.includes('APPROVE')).length} color={C.success} icon={IC.check} />
        <Kpi label="Changes" value={logs.filter(l=>l.action.includes('UPDATE')||l.action.includes('EDIT')).length} color={C.warning} icon={IC.edit} />
      </div>
      <Card style={{marginBottom:16,padding:14}}>
        <div style={{display:'flex',gap:10}}>
          <Inp label="" value={filterUser} onChange={(e:any)=>setFilterUser(e.target.value)} placeholder="Filter by user email..." style={{marginBottom:0,flex:1}} />
          <Sel label="" value={filterModule} onChange={(e:any)=>setFilterModule(e.target.value)} style={{marginBottom:0,width:160}}><option value="">All Modules</option>{['AUTH','timesheets','timeoff','schedule','payroll','employees','users','reports','settings'].map(m=><option key={m} value={m}>{m}</option>)}</Sel>
          <Btn variant="secondary" size="sm" onClick={()=>{setFilterUser('');setFilterModule('')}}>Clear</Btn>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><Th>Date & Time</Th><Th>User</Th><Th>Action</Th><Th>Module</Th><Th>Details</Th></tr></thead>
          <tbody>
            {loading?<tr><td colSpan={5} style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>Loading...</td></tr>
              :logs.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'48px 0',color:C.textMuted}}>No records found</td></tr>
              :logs.map(l=><tr key={l.id} onMouseEnter={e=>(e.currentTarget as any).style.background='#F8FAFC'} onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                <Td style={{fontFamily:'var(--font-mono)',fontSize:12,whiteSpace:'nowrap'}}>{l.created_at?format(new Date(l.created_at),'MMM d, yyyy HH:mm:ss'):'-'}</Td>
                <Td><div style={{fontWeight:700,fontSize:13}}>{l.panel_user_name}</div><div style={{fontSize:11,color:C.textMuted}}>{l.panel_user_email}</div></Td>
                <Td><Badge color={actionColors[l.action] as any||'gray'}>{l.action.replace(/_/g,' ')}</Badge></Td>
                <Td><Badge color="gray">{l.module}</Badge></Td>
                <Td style={{maxWidth:280}}>{l.details&&Object.keys(l.details).length>0?<span style={{fontFamily:'var(--font-mono)',fontSize:11,color:C.textSub}}>{JSON.stringify(l.details)}</span>:<span style={{color:C.textMuted}}>-</span>}</Td>
              </tr>)}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// OWNER SETTINGS
function OwnerSettingsModule({ panelUser, isOwner }: { panelUser: PanelUser; isOwner: boolean }) {
  const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success'|'error'>('success')

  async function save() {
    setMsg('')
    if (newPass && newPass !== confirmPass) { setMsg('Passwords do not match'); setMsgType('error'); return }
    if (!newEmail && !newPass) { setMsg('Enter at least one field to update'); setMsgType('error'); return }
    const { data } = await supabase.from('app_config').select('id').limit(1)
    const payload: any = {}
    if (newEmail) payload.owner_email = newEmail.trim().toLowerCase()
    if (newPass) payload.owner_password = newPass.trim()
    if (data&&data.length>0) { await supabase.from('app_config').update(payload).eq('id',data[0].id) }
    else { await supabase.from('app_config').insert({...payload,company_name:'StaffForce'}) }
    await supabase.from('panel_audit_log').insert({ panel_user_id:panelUser.id, panel_user_email:panelUser.email, panel_user_name:panelUser.full_name, action:'UPDATE_OWNER_CREDENTIALS', module:'settings', details:{email_changed:!!newEmail,password_changed:!!newPass}, created_at:new Date().toISOString() })
    setNewEmail(''); setNewPass(''); setConfirmPass('')
    setMsg('Credentials updated. Use new credentials on next login.'); setMsgType('success')
  }

  if (!isOwner) return <Card style={{textAlign:'center',padding:'60px 0'}}><Svg d={IC.shield} size={48} color={C.border} /><div style={{marginTop:16,fontSize:16,fontWeight:700}}>Owner Access Only</div></Card>

  return (
    <div style={{maxWidth:540}}>
      <PageHeader title="Owner Settings" sub="Manage your control panel access credentials" />
      <Card>
        <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:6}}>Change Access Credentials</div>
        <div style={{fontSize:13,color:C.textSub,marginBottom:24}}>Leave blank to keep your current credentials unchanged.</div>
        <Inp label="New Email" type="email" value={newEmail} onChange={(e:any)=>setNewEmail(e.target.value)} placeholder="new@email.com" />
        <Inp label="New Password" type="password" value={newPass} onChange={(e:any)=>setNewPass(e.target.value)} placeholder="New password" />
        <Inp label="Confirm Password" type="password" value={confirmPass} onChange={(e:any)=>setConfirmPass(e.target.value)} placeholder="Repeat new password" />
        {msg&&<div style={{background:msgType==='success'?C.successBg:C.dangerBg,border:`1px solid ${msgType==='success'?'#BBF7D0':'#FECACA'}`,borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:13,color:msgType==='success'?C.success:C.danger,fontWeight:500}}>{msg}</div>}
        <Btn variant="primary" onClick={save}><Svg d={IC.key} size={14} />Update Credentials</Btn>
      </Card>
    </div>
  )
}

// ADMIN SHELL
export default function AdminPanel() {
  const [panelUser, setPanelUser] = useState<PanelUser|null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [mod, setMod] = useState<Mod>('command')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [panelUsers, setPanelUsers] = useState<PanelUser[]>([])

  useEffect(() => { if (panelUser) loadGlobal() }, [panelUser])

  async function loadGlobal() {
    const [e,d,l,pu] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('panel_users').select('*').order('created_at',{ascending:false}),
    ])
    setEmployees(e.data||[]); setDepartments(d.data||[]); setLocations(l.data||[]); setPanelUsers(pu.data||[])
  }

  function handleLogin(user: PanelUser, owner: boolean) { setPanelUser(user); setIsOwner(owner) }
  function handleLogout() {
    if (panelUser&&panelUser.id!=='owner') supabase.from('panel_audit_log').insert({ panel_user_id:panelUser.id, panel_user_email:panelUser.email, panel_user_name:panelUser.full_name, action:'LOGOUT', module:'AUTH', details:{}, created_at:new Date().toISOString() })
    setPanelUser(null); setIsOwner(false)
  }

  if (!panelUser) return <AdminLogin onLogin={handleLogin} />

  const NAV = [
    { section:'OPERATIONS', items:[
      { key:'command' as Mod, label:'Command Center', icon:IC.command },
      { key:'timesheets' as Mod, label:'Timesheets', icon:IC.timesheets },
      { key:'timeoff' as Mod, label:'Time Off', icon:IC.timeoff },
    ]},
    { section:'TEAM', items:[
      { key:'employees' as Mod, label:'Employees', icon:IC.employees },
    ]},
    { section:'BUSINESS', items:[
      { key:'payroll' as Mod, label:'Payroll', icon:IC.payroll },
      { key:'reports' as Mod, label:'Reports', icon:IC.reports },
    ]},
    { section:'SYSTEM', items:[
      ...(isOwner?[{ key:'users' as Mod, label:'Panel Users', icon:IC.users }]:[]),
      { key:'audit' as Mod, label:'Audit Log', icon:IC.audit },
      ...(isOwner?[{ key:'settings' as Mod, label:'Owner Settings', icon:IC.settings }]:[]),
    ]},
  ]

  const LABELS: Record<Mod,string> = { command:'Command Center', timesheets:'Timesheets', timeoff:'Time Off', employees:'Employees', payroll:'Payroll', reports:'Reports', users:'Panel Users', audit:'Audit Log', settings:'Owner Settings' }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'var(--font-body)', background:C.bg }}>
      {/* Sidebar */}
      <aside style={{ width:244, minWidth:244, background:C.sidebar, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg, #2563EB, #1D4ED8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(37,99,235,0.4)', flexShrink:0 }}>
              <Svg d={IC.shield} size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:900, color:'#F8FAFC', letterSpacing:'-0.3px' }}>StaffForce</div>
              <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>Control Panel</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
          {NAV.map(section=><div key={section.section} style={{ marginBottom:6 }}>
            <div style={{ fontSize:9, fontWeight:800, color:'#334155', textTransform:'uppercase', letterSpacing:'1px', padding:'10px 20px 4px' }}>{section.section}</div>
            {section.items.map(item=><button key={item.key} onClick={()=>setMod(item.key)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 20px', border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all 0.15s', background:mod===item.key?'rgba(37,99,235,0.15)':'transparent', color:mod===item.key?'#60A5FA':'#64748B', fontSize:13, fontWeight:mod===item.key?700:500, borderLeft:mod===item.key?'3px solid #2563EB':'3px solid transparent' }}>
              <Svg d={item.icon} size={15} color={mod===item.key?'#60A5FA':'#64748B'} />
              {item.label}
            </button>)}
          </div>)}
        </nav>

        <div style={{ padding:'14px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:isOwner?'linear-gradient(135deg,#7C3AED,#6D28D9)':'linear-gradient(135deg,#2563EB,#1D4ED8)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Svg d={isOwner?IC.key:IC.users} size={15} color="#fff" />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#F8FAFC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{panelUser.full_name}</div>
              <div style={{ fontSize:10, fontWeight:700, color:isOwner?'#A78BFA':'#60A5FA' }}>{isOwner?'OWNER':'PANEL USER'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, background:'rgba(255,255,255,0.03)', color:'#475569', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
            onMouseEnter={e=>{(e.currentTarget as any).style.color='#94A3B8'}} onMouseLeave={e=>{(e.currentTarget as any).style.color='#475569'}}>
            <Svg d={IC.logout} size={13} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <header style={{ height:56, minHeight:56, background:'#fff', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 28px', gap:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.text, flex:1 }}>{LABELS[mod]}</div>
          <div style={{ fontSize:12, color:C.textMuted, fontFamily:'var(--font-mono)' }}>{format(new Date(),'EEE, MMM d yyyy HH:mm')}</div>
          <a href="/" style={{ fontSize:12, color:C.accent, fontWeight:700, textDecoration:'none', padding:'6px 14px', border:`1px solid ${C.accentBorder}`, borderRadius:8, background:C.accentLight }}>Employee App</a>
        </header>
        <main style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
          {mod==='command'    && <CommandCenter employees={employees} departments={departments} panelUser={panelUser} />}
          {mod==='timesheets' && <TimesheetsModule employees={employees} panelUser={panelUser} />}
          {mod==='timeoff'    && <TimeOffModule employees={employees} panelUser={panelUser} />}
          {mod==='employees'  && <EmployeesModule employees={employees} departments={departments} locations={locations} setEmployees={setEmployees} panelUser={panelUser} />}
          {mod==='payroll'    && <PayrollModule employees={employees} panelUser={panelUser} />}
          {mod==='reports'    && <ReportsModule employees={employees} departments={departments} panelUser={panelUser} />}
          {mod==='users'      && <PanelUsersModule employees={employees} panelUsers={panelUsers} setPanelUsers={setPanelUsers} isOwner={isOwner} panelUser={panelUser} />}
          {mod==='audit'      && <AuditModule panelUser={panelUser} />}
          {mod==='settings'   && <OwnerSettingsModule panelUser={panelUser} isOwner={isOwner} />}
        </main>
      </div>
    </div>
  )
}
