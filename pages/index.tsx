import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useT, Lang } from '../lib/i18n'
import { checkGeofence, getCurrentPosition } from '../lib/geo'
import { calcPayrollRow, DeductionConfig } from '../lib/payroll'

// ── TYPES ────────────────────────────────────────────────────
type Role = 'admin' | 'manager' | 'employee'
interface User { id: string; email?: string; role: Role }
interface Employee {
  id: string; first: string; last: string; email?: string; phone?: string
  dept?: string; title?: string; location_id?: string; type?: string
  wage_type?: string; hourly_rate?: number; annual_salary?: number
  pin?: string; start_date?: string; status?: string
  pto_balance?: number; pto_used?: number; pto_accrual_rate?: number
  dob?: string; gender?: string; address?: string
  emergency_contact?: string; emergency_phone?: string
  notes?: string; permissions?: Record<string, boolean>
  lang?: Lang; geo_exempt?: boolean; avatar_color?: string
  auth_user_id?: string
}
interface Location {
  id: string; name: string; type?: string; address?: string
  phone?: string; email?: string; manager?: string
  geo_lat?: number; geo_lng?: number; geo_radius?: number; geo_enabled?: boolean
  currency_symbol?: string
}

// ── HELPERS ──────────────────────────────────────────────────
const initials = (e: Employee) => `${e.first[0]}${e.last[0]}`.toUpperCase()
const fmtDate = (d: string) => new Date(d).toLocaleDateString()
const fmtMoney = (n: number, sym = '$') => `${sym}${n.toFixed(2)}`
const weekDays = (lang: Lang) => lang === 'es'
  ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const COLORS = ['#6D28D9','#2563EB','#059669','#DC2626','#D97706','#0891B2','#BE185D','#4F46E5','#7C3AED']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-green', approved: 'badge-green', open: 'badge-blue', complete: 'badge-blue',
    paid: 'badge-green', processed: 'badge-violet', pending: 'badge-amber',
    inactive: 'badge-gray', terminated: 'badge-red', rejected: 'badge-red',
    draft: 'badge-gray', 'Full-time': 'badge-violet', 'Part-time': 'badge-blue',
    Contract: 'badge-amber', Seasonal: 'badge-cyan',
  }
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [lang, setLang] = useState<Lang>('en')
  const [page, setPage] = useState('dashboard')
  const [locations, setLocations] = useState<Location[]>([])
  const [config, setConfig] = useState<Record<string, string>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sidebarMini, setSidebarMini] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [clock, setClock] = useState('')
  const t = useT(lang)

  // Auth
  const [loginTab, setLoginTab] = useState<'email' | 'pin'>('email')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    loadLocations()
    loadConfig()
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (user) { loadEmployees(); loadNotifications() }
  }, [user])

  async function loadLocations() {
    const { data } = await supabase.from('locations').select('*').eq('active', true)
    if (data) setLocations(data)
  }

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('key,value')
    if (data) setConfig(Object.fromEntries(data.map((r: any) => [r.key, r.value])))
  }

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('*').neq('status', 'terminated')
    if (data) setEmployees(data)
  }

  async function loadNotifications() {
    if (!employee) return
    const { data } = await supabase.from('notifications').select('*').eq('emp_id', employee.id).eq('read', false).order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  // ── LOGIN ──
  async function doEmailLogin() {
    setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass })
    if (error || !data.user) { setLoginError(t('invalidCredentials')); return }
    // get role from metadata or employees table
    const meta = data.user.user_metadata
    const role: Role = meta?.role || 'employee'
    setUser({ id: data.user.id, email: data.user.email, role })
    if (meta?.emp_id) {
      const { data: emp } = await supabase.from('employees').select('*').eq('id', meta.emp_id).single()
      if (emp) { setEmployee(emp); setLang(emp.lang || 'en') }
    }
    setPage('dashboard')
  }

  async function doPinLogin() {
    const { data: emp, error } = await supabase.from('employees').select('*').eq('pin', pin).eq('status', 'active').single()
    if (error || !emp) { setLoginError(t('invalidPin')); setPin(''); return }
    setEmployee(emp)
    setUser({ id: emp.id, role: 'employee' })
    setLang(emp.lang || 'en')
    setPage('dashboard')
  }

  function doLogout() {
    supabase.auth.signOut()
    setUser(null); setEmployee(null); setPin(''); setLoginError('')
  }

  const hasPerm = (k: string) => {
    if (!user || user.role !== 'employee') return true
    return employee?.permissions?.[k] !== false
  }

  // ── NAV ──
  function navTo(p: string) {
    if (!hasPerm(p)) { setPage(p); return } // will show no-access
    setPage(p)
    setNotifOpen(false)
  }

  const curLoc = locations[0]
  const curSym = curLoc?.currency_symbol || config.currency_symbol || '$'

  // ── RENDER ──
  if (!user) return (
    <LoginScreen
      lang={lang} t={t} tab={loginTab} setTab={setLoginTab}
      email={loginEmail} setEmail={setLoginEmail}
      pass={loginPass} setPass={setLoginPass}
      pin={pin} setPin={setPin}
      error={loginError} setError={setLoginError}
      onEmailLogin={doEmailLogin} onPinLogin={doPinLogin}
      onLangToggle={() => setLang(l => l === 'en' ? 'es' : 'en')}
    />
  )

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="tb-brand">
          <div className="tb-mark">💼</div>
          <span>StaffForce</span>
        </div>
        <div className="tb-div" />
        <div className="tb-loc" onClick={() => navTo('locations')}>
          📍 <span>{curLoc?.name || '...'}</span>
        </div>
        <div className="tb-right">
          <div className="tb-clock">{clock}</div>
          <button className="lang-btn" onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}>
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
          <div className="tb-icon-btn" onClick={() => setNotifOpen(o => !o)}>
            🔔
            {notifications.length > 0 && <div className="tb-pip" />}
          </div>
          <div className="tb-avatar" style={{ background: employee?.avatar_color || '#6D28D9', color: '#fff' }}
            onClick={() => navTo('profile')}>
            {employee ? initials(employee) : 'ME'}
          </div>
        </div>
      </div>

      <div className="app-layout">
        {/* SIDEBAR */}
        <Sidebar
          lang={lang} t={t} page={page} navTo={navTo}
          role={user.role} perms={employee?.permissions || {}}
          mini={sidebarMini} setMini={setSidebarMini}
          onLogout={doLogout}
        />

        {/* MAIN */}
        <div className="app-main">
          {page === 'dashboard' && <DashboardPage t={t} lang={lang} employees={employees} employee={employee} user={user} />}
          {page === 'clockin' && <ClockPage t={t} lang={lang} employee={employee} locations={locations} config={config} />}
          {page === 'schedule' && <SchedulePage t={t} lang={lang} employees={employees} user={user} employee={employee} />}
          {page === 'employees' && <EmployeesPage t={t} lang={lang} employees={employees} locations={locations} onRefresh={loadEmployees} user={user} />}
          {page === 'timesheets' && <TimesheetsPage t={t} lang={lang} employees={employees} user={user} employee={employee} />}
          {page === 'payroll' && <PayrollPage t={t} lang={lang} employees={employees} config={config} sym={curSym} user={user} onConfigRefresh={loadConfig} />}
          {page === 'reports' && <ReportsPage t={t} lang={lang} employees={employees} sym={curSym} />}
          {page === 'timeoff' && <TimeOffPage t={t} lang={lang} employees={employees} user={user} employee={employee} />}
          {page === 'locations' && <LocationsPage t={t} lang={lang} locations={locations} onRefresh={loadLocations} />}
          {page === 'documents' && <DocumentsPage t={t} lang={lang} employees={employees} user={user} employee={employee} />}
          {page === 'settings' && <SettingsPage t={t} lang={lang} config={config} onRefresh={loadConfig} />}
          {page === 'profile' && <ProfilePage t={t} lang={lang} employee={employee} />}
        </div>

        {/* NOTIF PANEL */}
        {notifOpen && (
          <div style={{ position: 'fixed', top: 54, right: 0, width: 300, height: 'calc(100vh - 54px)', background: 'var(--surf)', borderLeft: '1px solid var(--b)', zIndex: 100, overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '.82rem' }}>{t('dashboard')} 🔔</span>
              <button className="btn btn-secondary btn-xs" onClick={async () => {
                await supabase.from('notifications').update({ read: true }).eq('emp_id', employee?.id || '')
                setNotifications([])
              }}>{t('save')}</button>
            </div>
            {notifications.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: '.78rem' }}>No notifications</div>
              : notifications.map(n => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--b)', background: 'var(--v-dim)' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 700 }}>{n.title || n.type}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--t2)', marginTop: 2 }}>{n.message}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── LOGIN SCREEN ──────────────────────────────────────────────
function LoginScreen({ lang, t, tab, setTab, email, setEmail, pass, setPass, pin, setPin, error, setError, onEmailLogin, onPinLogin, onLangToggle }: any) {
  function pinKey(k: string) {
    if (k === 'del') { setPin((p: string) => p.slice(0, -1)); return }
    if (k === 'ok') { onPinLogin(); return }
    if (pin.length >= 4) return
    const next = pin + k
    setPin(next)
    if (next.length === 4) setTimeout(onPinLogin, 200)
  }

  return (
    <div className="login-screen">
      <div className="login-box fade-up">
        <div className="login-logo-mark">💼</div>
        <div className="login-title">StaffForce</div>
        <div className="login-sub">{lang === 'es' ? 'Gestión de Personal' : 'Workforce Management'}</div>

        <div className="login-tabs">
          <div className={`login-tab ${tab === 'email' ? 'active' : ''}`} onClick={() => { setTab('email'); setError('') }}>{t('adminLogin')}</div>
          <div className={`login-tab ${tab === 'pin' ? 'active' : ''}`} onClick={() => { setTab('pin'); setError('') }}>{t('employeePin')}</div>
        </div>

        {tab === 'email' ? (
          <div>
            <div className="form-group">
              <label className="form-label">{t('email')}</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" onKeyDown={e => e.key === 'Enter' && onEmailLogin()} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('password')}</label>
              <input className="form-input" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && onEmailLogin()} />
            </div>
            {error && <div style={{ color: 'var(--red2)', fontSize: '.75rem', marginBottom: 10 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%', padding: 11, fontSize: '.85rem' }} onClick={onEmailLogin}>{t('signIn')}</button>
          </div>
        ) : (
          <div>
            <div className="pin-dots">
              {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${i < pin.length ? 'on' : ''}`} />)}
            </div>
            <div className="pin-grid">
              {['1','2','3','4','5','6','7','8','9','del','0','ok'].map(k => (
                <div key={k} className={`pin-key ${k === 'ok' ? 'pin-confirm' : ''}`} onClick={() => pinKey(k)}>
                  {k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}
                </div>
              ))}
            </div>
            {error && <div style={{ color: 'var(--red2)', fontSize: '.75rem', textAlign: 'center' }}>{error}</div>}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: '.72rem', color: 'var(--t3)', cursor: 'pointer' }} onClick={onLangToggle}>
            🌐 {lang === 'en' ? 'Español' : 'English'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ lang, t, page, navTo, role, perms, mini, setMini, onLogout }: any) {
  const isAdmin = role === 'admin'
  const isMgr = role === 'manager'
  const link = (id: string, icon: string, label: string, show = true) => {
    if (!show) return null
    return (
      <div className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navTo(id)}>
        <span className="nav-icon">{icon}</span>
        <span className="nav-text">{label}</span>
      </div>
    )
  }

  return (
    <div className={`sidebar ${mini ? 'mini' : ''}`}>
      <div className="sb-section">
        <div className="sb-label">{t('dashboard')}</div>
        {link('dashboard', '📊', t('dashboard'))}
        {link('clockin', '⏱', t('clockin'), perms.clockin !== false)}
        {link('schedule', '📅', t('schedule'), perms.schedule !== false)}
        {link('timeoff', '🌴', t('timeoff'), perms.timeoff !== false)}
      </div>
      {(isAdmin || isMgr) && (
        <div className="sb-section">
          <div className="sb-label">{lang === 'es' ? 'Gestión' : 'Management'}</div>
          {link('employees', '👥', t('employees'))}
          {link('timesheets', '🕐', t('timesheets'))}
          {link('payroll', '💰', t('payroll'))}
          {link('reports', '📈', t('reports'))}
        </div>
      )}
      {isAdmin && (
        <div className="sb-section">
          <div className="sb-label">{lang === 'es' ? 'Admin' : 'Admin'}</div>
          {link('locations', '🏢', t('locations'))}
          {link('documents', '📄', t('documents'))}
          {link('settings', '⚙️', t('settings'))}
        </div>
      )}
      <div className="sb-bottom">
        <div className="nav-link" onClick={() => setMini((m: boolean) => !m)}>
          <span className="nav-icon">{mini ? '▶' : '◀'}</span>
          <span className="nav-text">{mini ? '' : (lang === 'es' ? 'Colapsar' : 'Collapse')}</span>
        </div>
        <div className="nav-link" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-text">{t('logout')}</span>
        </div>
      </div>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardPage({ t, lang, employees, employee, user }: any) {
  const [todayEntries, setTodayEntries] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [weekHours, setWeekHours] = useState(0)

  useEffect(() => { load() }, [employees])

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const [{ data: todayD }, { data: pendD }, { data: weekD }] = await Promise.all([
      supabase.from('time_entries').select('*').eq('date', today).eq('status', 'open'),
      supabase.from('time_off').select('*').eq('status', 'pending'),
      supabase.from('time_entries').select('total_hours').gte('date', weekAgo).lte('date', today),
    ])
    setTodayEntries(todayD || [])
    setPending(pendD || [])
    setWeekHours((weekD || []).reduce((s: number, e: any) => s + (e.total_hours || 0), 0))
  }

  const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]))
  const activeEmps = employees.filter((e: any) => e.status === 'active')

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard')}</div>
          <div className="page-sub">{new Date().toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={load}>↺ {t('refresh')}</button>
        </div>
      </div>
      <div className="page-body">
        <div className="stat-grid">
          <div className="stat-card v"><div className="stat-icon v">👥</div><div className="stat-label">{t('totalEmployees')}</div><div className="stat-value">{activeEmps.length}</div></div>
          <div className="stat-card g"><div className="stat-icon g">⏱</div><div className="stat-label">{t('activeToday')}</div><div className="stat-value">{todayEntries.length}</div></div>
          <div className="stat-card b"><div className="stat-icon b">📊</div><div className="stat-label">{t('hrsThisWeek')}</div><div className="stat-value">{weekHours.toFixed(1)}</div></div>
          <div className="stat-card a"><div className="stat-icon a">🌴</div><div className="stat-label">{t('pendingTimeOff')}</div><div className="stat-value">{pending.length}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">⏱ {t('activeToday')}</span></div>
            <div className="card-body">
              {todayEntries.length === 0
                ? <div style={{ color: 'var(--t3)', fontSize: '.78rem', textAlign: 'center', padding: 16 }}>{t('nobodyToday')}</div>
                : todayEntries.map((e: any) => {
                    const emp = empMap[e.emp_id]
                    if (!emp) return null
                    return (
                      <div key={e.id} className="chip" style={{ marginBottom: 10 }}>
                        <div className="avatar" style={{ background: emp.avatar_color || '#6D28D9', color: '#fff' }}>{initials(emp)}</div>
                        <div>
                          <div className="chip-name">{emp.first} {emp.last}</div>
                          <div className="chip-sub">{emp.dept} · {t('since')} {e.clock_in}</div>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">🌴 {t('pendingTimeOff')}</span></div>
            <div className="card-body">
              {pending.length === 0
                ? <div style={{ color: 'var(--t3)', fontSize: '.78rem', textAlign: 'center', padding: 16 }}>{t('noPending')}</div>
                : pending.slice(0, 6).map((r: any) => {
                    const emp = empMap[r.emp_id]
                    return (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--b)' }}>
                        <div>
                          <div style={{ fontSize: '.78rem', fontWeight: 600 }}>{emp?.first} {emp?.last}</div>
                          <div style={{ fontSize: '.65rem', color: 'var(--t3)' }}>{r.date_from} · {r.type}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-success btn-xs" onClick={async () => {
                            await supabase.from('time_off').update({ status: 'approved', approved_by: 'admin', approved_at: new Date().toISOString() }).eq('id', r.id)
                            load()
                          }}>{t('approve')}</button>
                          <button className="btn btn-danger btn-xs" onClick={async () => {
                            await supabase.from('time_off').update({ status: 'rejected' }).eq('id', r.id)
                            load()
                          }}>{t('reject')}</button>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CLOCK PAGE ────────────────────────────────────────────────
function ClockPage({ t, lang, employee, locations, config }: any) {
  const [clockDisplay, setClockDisplay] = useState('')
  const [todayEntry, setTodayEntry] = useState<any>(null)
  const [geoStatus, setGeoStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [geoMsg, setGeoMsg] = useState('')
  const [geoPosition, setGeoPosition] = useState<any>(null)
  const [blocked, setBlocked] = useState(false)
  const [blockedMsg, setBlockedMsg] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [breakMins, setBreakMins] = useState(30)

  const loc = locations[0] as Location | undefined
  const geoEnabled = config.geo_enabled === 'true' && loc?.geo_enabled && !employee?.geo_exempt

  useEffect(() => {
    const iv = setInterval(() => setClockDisplay(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    loadTodayStatus()
    if (geoEnabled) checkLocation()
    else setGeoStatus('ok')
    return () => clearInterval(iv)
  }, [employee, locations, config])

  async function loadTodayStatus() {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('time_entries').select('*').eq('emp_id', employee.id).eq('date', today).order('created_at', { ascending: false }).limit(1)
    setTodayEntry(data?.[0] || null)
  }

  async function checkLocation() {
    setGeoStatus('loading')
    setGeoMsg(t('checkingLocation'))
    if (!loc?.geo_lat || !loc?.geo_lng) { setGeoStatus('ok'); return }
    const result = await checkGeofence(loc.geo_lat!, loc.geo_lng!, loc.geo_radius || 100, loc.name)
    if (!result.allowed) {
      setGeoStatus('error')
      setGeoMsg(lang === 'es' ? (result.error_es || result.error || '') : (result.error || ''))
      setBlocked(true)
      setBlockedMsg(lang === 'es' ? (result.error_es || result.error || '') : (result.error || ''))
    } else {
      setGeoStatus('ok')
      setGeoMsg(`${t('withinArea')} (${result.distance}m)`)
      setGeoPosition(result.position)
    }
  }

  const isClockedIn = todayEntry?.status === 'open'

  async function doClock() {
    if (!employee) return
    setActionMsg('')

    // Re-check geo before every action
    if (geoEnabled && loc?.geo_lat && loc?.geo_lng) {
      const result = await checkGeofence(loc.geo_lat!, loc.geo_lng!, loc.geo_radius || 100, loc.name)
      if (!result.allowed) {
        setBlocked(true)
        setBlockedMsg(lang === 'es' ? (result.error_es || result.error || '') : (result.error || ''))
        return
      }
      setGeoPosition(result.position)
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().slice(0, 5)

    if (!isClockedIn) {
      const { error } = await supabase.from('time_entries').insert({
        emp_id: employee.id,
        location_id: employee.location_id,
        date: today,
        clock_in: timeStr,
        clock_in_lat: geoPosition?.lat,
        clock_in_lng: geoPosition?.lng,
        clock_in_distance: geoPosition ? null : null,
        dept: employee.dept,
        status: 'open',
        within_geofence: true,
      })
      if (!error) setActionMsg(t('clockInSuccess'))
    } else {
      const { error } = await supabase.from('time_entries').update({
        clock_out: timeStr,
        clock_out_lat: geoPosition?.lat,
        clock_out_lng: geoPosition?.lng,
        break_mins: breakMins,
        status: 'complete',
      }).eq('id', todayEntry.id)
      if (!error) {
        setActionMsg(t('clockOutSuccess'))
        // PTO accrual
        if (config.pto_accrual_enabled === 'true' && todayEntry.clock_in) {
          const inH = parseInt(todayEntry.clock_in.split(':')[0]) * 60 + parseInt(todayEntry.clock_in.split(':')[1])
          const outH = now.getHours() * 60 + now.getMinutes()
          const hrs = Math.max(0, (outH - inH - breakMins) / 60)
          const rate = parseFloat(config.pto_accrual_rate || '0.0385')
          const accrued = hrs * rate
          await supabase.from('employees').update({ pto_balance: (employee.pto_balance || 0) + accrued }).eq('id', employee.id)
        }
      }
    }
    await loadTodayStatus()
  }

  return (
    <div className="page fade-up">
      {blocked && (
        <div className="geo-blocked-overlay">
          <div className="geo-blocked-box">
            <div className="geo-blocked-icon">📍</div>
            <div className="geo-blocked-title">{t('outsideArea')}</div>
            <div className="geo-blocked-msg">{blockedMsg}</div>
            <div className="geo-blocked-sub">{t('outsideMsg')}</div>
            <button className="btn btn-secondary" style={{ marginTop: 20, width: '100%' }} onClick={() => { setBlocked(false); checkLocation() }}>
              ↺ {lang === 'es' ? 'Reintentar' : 'Retry'}
            </button>
          </div>
        </div>
      )}
      <div className="page-header">
        <div><div className="page-title">{t('clockin')}</div></div>
      </div>
      <div className="page-body" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24 }}>
        <div className="clock-card fade-up">
          {employee && (
            <div style={{ marginBottom: 14 }}>
              <div className="avatar avatar-xl" style={{ background: employee.avatar_color || '#6D28D9', color: '#fff', margin: '0 auto 8px' }}>{initials(employee)}</div>
              <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{employee.first} {employee.last}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>{employee.dept}</div>
            </div>
          )}

          <div className={`clock-status ${isClockedIn ? 'in' : 'out'}`}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {isClockedIn ? t('clockedIn') : t('notClockedIn')}
          </div>

          <div className="clock-time-display">{clockDisplay}</div>

          <div className={`geo-indicator ${geoStatus === 'ok' ? 'geo-ok' : geoStatus === 'error' ? 'geo-err' : 'geo-loading'}`}>
            <span>{geoStatus === 'ok' ? '✅' : geoStatus === 'error' ? '❌' : '⏳'}</span>
            <span>{geoMsg || (geoEnabled ? t('checkingLocation') : t('withinArea'))}</span>
          </div>

          {isClockedIn && (
            <div className="form-group" style={{ textAlign: 'left', marginTop: 8 }}>
              <label className="form-label">{t('breakMins')}</label>
              <input className="form-input" type="number" value={breakMins} onChange={e => setBreakMins(parseInt(e.target.value) || 0)} min={0} max={120} style={{ width: 100 }} />
            </div>
          )}

          <button
            className={`clock-btn ${isClockedIn ? 'clock-btn-out' : 'clock-btn-in'}`}
            onClick={doClock}
            disabled={geoStatus === 'error' || geoStatus === 'loading'}
          >
            {isClockedIn ? t('clockOutBtn') : t('clockInBtn')}
          </button>

          {actionMsg && <div style={{ marginTop: 12, fontSize: '.75rem', color: 'var(--green2)', fontWeight: 600 }}>{actionMsg}</div>}
          {todayEntry?.clock_in && !isClockedIn && (
            <div style={{ marginTop: 8, fontSize: '.72rem', color: 'var(--t3)' }}>
              {t('lastEntry')}: {todayEntry.clock_in} → {todayEntry.clock_out}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SCHEDULE PAGE ─────────────────────────────────────────────
function SchedulePage({ t, lang, employees, user, employee }: any) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d
  })
  const [shifts, setShifts] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selEmpId, setSelEmpId] = useState('')
  const [selDate, setSelDate] = useState('')
  const [shiftForm, setShiftForm] = useState({ start: '08:00', end: '16:00', dept: '', position: '', notes: '', published: false })

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = fmt(new Date())
  const dn = weekDays(lang)

  useEffect(() => { loadShifts() }, [weekStart])

  async function loadShifts() {
    const { data } = await supabase.from('shifts').select('*').gte('date', fmt(days[0])).lte('date', fmt(days[6]))
    setShifts(data || [])
  }

  async function saveShift() {
    await supabase.from('shifts').insert({
      emp_id: selEmpId, date: selDate,
      start_time: shiftForm.start, end_time: shiftForm.end,
      dept: shiftForm.dept, position: shiftForm.position,
      notes: shiftForm.notes, published: shiftForm.published,
    })
    setShowModal(false); loadShifts()
  }

  const visEmps = user.role === 'employee' ? employees.filter((e: any) => e.id === employee?.id) : employees

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('schedule')}</div></div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n })}>← {t('prev')}</button>
          <span style={{ fontSize: '.78rem', fontWeight: 700 }}>{fmt(days[0])} – {fmt(days[6])}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n })}>{t('next')} →</button>
          {user.role !== 'employee' && <button className="btn btn-primary btn-sm" onClick={() => { setSelEmpId(employees[0]?.id || ''); setSelDate(today); setShowModal(true) }}>+ {t('addShift')}</button>}
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="card-body-np">
            <div className="sched-wrap">
              <div className="sched-grid">
                <div className="sched-head">
                  <div className="sched-head-cell">{lang === 'es' ? 'Empleado' : 'Employee'}</div>
                  {days.map((d, i) => (
                    <div key={i} className={`sched-head-cell ${fmt(d) === today ? 'today' : ''}`}>
                      {dn[i]}<br /><small style={{ fontSize: '.55rem' }}>{d.getDate()}</small>
                    </div>
                  ))}
                </div>
                {visEmps.map((emp: any) => (
                  <div key={emp.id} className="sched-row">
                    <div className="sched-emp-cell">
                      <div className="avatar" style={{ background: emp.avatar_color || '#6D28D9', color: '#fff' }}>{initials(emp)}</div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '.73rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.first} {emp.last}</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--t3)' }}>{emp.dept}</div>
                      </div>
                    </div>
                    {days.map((d, i) => {
                      const ds = fmt(d)
                      const dayShifts = shifts.filter(s => s.emp_id === emp.id && s.date === ds)
                      return (
                        <div key={i} className="sched-day-cell" onClick={() => { if (user.role !== 'employee') { setSelEmpId(emp.id); setSelDate(ds); setShowModal(true) } }}>
                          {dayShifts.map(s => <div key={s.id} className="sched-shift-chip">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</div>)}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">{t('addShift')}<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{lang === 'es' ? 'Empleado' : 'Employee'}</label>
                <select className="form-select" value={selEmpId} onChange={e => setSelEmpId(e.target.value)}>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.first} {e.last}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('date')}</label><input className="form-input" type="date" value={selDate} onChange={e => setSelDate(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">{t('department')}</label><input className="form-input" value={shiftForm.dept} onChange={e => setShiftForm(f => ({ ...f, dept: e.target.value }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('start')}</label><input className="form-input" type="time" value={shiftForm.start} onChange={e => setShiftForm(f => ({ ...f, start: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{t('end')}</label><input className="form-input" type="time" value={shiftForm.end} onChange={e => setShiftForm(f => ({ ...f, end: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">{t('position')}</label><input className="form-input" value={shiftForm.position} onChange={e => setShiftForm(f => ({ ...f, position: e.target.value }))} /></div>
              <div className="toggle-wrap" style={{ marginTop: 8 }}>
                <div className={`toggle-track ${shiftForm.published ? 'on' : ''}`} onClick={() => setShiftForm(f => ({ ...f, published: !f.published }))}><div className="toggle-knob" /></div>
                <span className="toggle-label">{t('publishToEmployee')}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveShift}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EMPLOYEES PAGE ────────────────────────────────────────────
function EmployeesPage({ t, lang, employees, locations, onRefresh, user }: any) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [showPerms, setShowPerms] = useState(false)
  const [permsEmp, setPermsEmp] = useState<Employee | null>(null)
  const [form, setForm] = useState<any>({})
  const [permsState, setPermsState] = useState<Record<string, boolean>>({})

  const depts = [...new Set(employees.map((e: any) => e.dept).filter(Boolean))]
  const isAdmin = user.role === 'admin'

  const filtered = employees.filter((e: any) => {
    const name = `${e.first} ${e.last}`.toLowerCase()
    return (!search || name.includes(search.toLowerCase()) || e.email?.includes(search.toLowerCase()))
      && (!deptFilter || e.dept === deptFilter)
  })

  function openAdd() { setForm({ wage_type: 'hourly', hourly_rate: 12, type: 'Full-time', status: 'active', lang: 'en', avatar_color: '#6D28D9', pto_balance: 80 }); setEditEmp(null); setShowModal(true) }
  function openEdit(e: any) { setForm({ ...e }); setEditEmp(e); setShowModal(true) }
  function openPerms(e: any) { setPermsEmp(e); setPermsState(e.permissions || {}); setShowPerms(true) }

  async function saveEmp() {
    if (!form.first || !form.last) return
    if (editEmp) await supabase.from('employees').update(form).eq('id', editEmp.id)
    else {
      const { data } = await supabase.from('employees').insert(form).select().single()
      if (data) await supabase.from('salary_history').insert({ emp_id: data.id, wage_type: form.wage_type, hourly_rate: form.hourly_rate, annual_salary: form.annual_salary, effective_date: form.start_date || new Date().toISOString().split('T')[0], reason: 'Initial hire', changed_by: 'admin' })
    }
    setShowModal(false); onRefresh()
  }

  async function savePerms() {
    if (!permsEmp) return
    await supabase.from('employees').update({ permissions: permsState }).eq('id', permsEmp.id)
    setShowPerms(false); onRefresh()
  }

  async function deleteEmp(id: string) {
    if (!confirm(lang === 'es' ? '¿Terminar este empleado?' : 'Terminate this employee?')) return
    await supabase.from('employees').update({ status: 'terminated' }).eq('id', id)
    onRefresh()
  }

  const permDefs: [string, string][] = [
    ['schedule', t('permSchedule')], ['timeoff', t('permTimeoff')], ['hours', t('permHours')],
    ['payroll', t('permPayroll')], ['team', t('permTeam')], ['documents', t('permDocuments')],
    ['clockin', t('permClockin')], ['profile', t('permProfile')], ['reports', t('permReports')],
  ]

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <div className="page-title">{t('employees')}</div>
          <div className="page-sub">{filtered.filter((e: any) => e.status === 'active').length} {lang === 'es' ? 'activos' : 'active'}</div>
        </div>
        <div className="page-actions">
          <input className="form-input" style={{ width: 180, padding: '5px 10px' }} placeholder={lang === 'es' ? 'Buscar...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 130, padding: '5px 8px' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">{lang === 'es' ? 'Todos los Dept.' : 'All Depts'}</option>
            {depts.map((d: any) => <option key={d} value={d}>{d}</option>)}
          </select>
          {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAdd}>+ {t('addEmployee')}</button>}
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="card-body-np">
            <table className="tbl">
              <thead><tr>
                <th>{t('name')}</th><th>{t('department')}</th><th>{t('title')}</th>
                <th>{t('type')}</th><th>{t('rate')}</th><th>{t('status')}</th><th>{t('actions')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id}>
                    <td><div className="chip"><div className="avatar" style={{ background: e.avatar_color || '#6D28D9', color: '#fff' }}>{initials(e)}</div><div><div className="chip-name">{e.first} {e.last}</div><div className="chip-sub">{e.email}</div></div></div></td>
                    <td>{e.dept || '—'}</td><td>{e.title || '—'}</td>
                    <td><StatusBadge status={e.type || 'Full-time'} /></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '.76rem' }}>{e.wage_type === 'salary' ? `$${(e.annual_salary||0).toLocaleString()}/yr` : `$${(e.hourly_rate||0).toFixed(2)}/hr`}</span></td>
                    <td><StatusBadge status={e.status} /></td>
                    <td><div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(e)}>{t('edit')}</button>
                      {isAdmin && <button className="btn btn-secondary btn-xs" onClick={() => openPerms(e)}>🔑</button>}
                      {isAdmin && <button className="btn btn-danger btn-xs" onClick={() => deleteEmp(e.id)}>✕</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EMP MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-wide" style={{ maxWidth: 600 }}>
            <div className="modal-header">{editEmp ? t('editEmployee') : t('addEmployee')}<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {COLORS.map(c => <div key={c} onClick={() => setForm((f: any) => ({ ...f, avatar_color: c }))} style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: `3px solid ${form.avatar_color === c ? '#fff' : 'transparent'}`, transition: 'border .15s' }} />)}
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('firstName')} *</label><input className="form-input" value={form.first || ''} onChange={e => setForm((f: any) => ({ ...f, first: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{t('lastName')} *</label><input className="form-input" value={form.last || ''} onChange={e => setForm((f: any) => ({ ...f, last: e.target.value }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('email')}</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Teléfono' : 'Phone'}</label><input className="form-input" value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('department')}</label><input className="form-input" value={form.dept || ''} onChange={e => setForm((f: any) => ({ ...f, dept: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{t('title')}</label><input className="form-input" value={form.title || ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('type')}</label>
                  <select className="form-select" value={form.type || 'Full-time'} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}>
                    {['Full-time','Part-time','Contract','Seasonal'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Ubicación' : 'Location'}</label>
                  <select className="form-select" value={form.location_id || ''} onChange={e => setForm((f: any) => ({ ...f, location_id: e.target.value }))}>
                    {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Tipo de Sueldo' : 'Wage Type'}</label>
                  <select className="form-select" value={form.wage_type || 'hourly'} onChange={e => setForm((f: any) => ({ ...f, wage_type: e.target.value }))}>
                    <option value="hourly">{t('hourly')}</option>
                    <option value="salary">{t('salary')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{form.wage_type === 'salary' ? (lang === 'es' ? 'Salario Anual' : 'Annual Salary') : `${t('rate')} (${lang === 'es' ? 'por hora' : 'per hr'})`}</label>
                  <input className="form-input" type="number" step="0.01" value={form.wage_type === 'salary' ? (form.annual_salary || '') : (form.hourly_rate || '')} onChange={e => setForm((f: any) => form.wage_type === 'salary' ? { ...f, annual_salary: parseFloat(e.target.value) } : { ...f, hourly_rate: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">PIN ({lang === 'es' ? 'para reloj' : 'for clock'})</label><input className="form-input" value={form.pin || ''} maxLength={6} onChange={e => setForm((f: any) => ({ ...f, pin: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{t('startDate')}</label><input className="form-input" type="date" value={form.start_date || ''} onChange={e => setForm((f: any) => ({ ...f, start_date: e.target.value }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('ptoHours')}</label><input className="form-input" type="number" value={form.pto_balance || 80} onChange={e => setForm((f: any) => ({ ...f, pto_balance: parseFloat(e.target.value) }))} /></div>
                <div className="form-group"><label className="form-label">{t('status')}</label>
                  <select className="form-select" value={form.status || 'active'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="active">{t('active')}</option>
                    <option value="inactive">{t('inactive')}</option>
                    <option value="terminated">{t('terminated')}</option>
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Idioma' : 'Language'}</label>
                  <select className="form-select" value={form.lang || 'en'} onChange={e => setForm((f: any) => ({ ...f, lang: e.target.value }))}>
                    <option value="en">English</option><option value="es">Español</option>
                  </select>
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ height: 24 }} />
                  <div className="toggle-wrap" style={{ marginTop: 4 }}>
                    <div className={`toggle-track ${form.geo_exempt ? 'on' : ''}`} onClick={() => setForm((f: any) => ({ ...f, geo_exempt: !f.geo_exempt }))}><div className="toggle-knob" /></div>
                    <span className="toggle-label">{t('geoExempt')}</span>
                  </div>
                </div>
              </div>
              <div className="form-group"><label className="form-label">{t('internalNotes')}</label><textarea className="form-textarea" rows={2} value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveEmp}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* PERMS MODAL */}
      {showPerms && permsEmp && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">{t('permissions')}: {permsEmp.first} {permsEmp.last}<button className="modal-close" onClick={() => setShowPerms(false)}>✕</button></div>
            <div className="modal-body">
              {permDefs.map(([key, label]) => (
                <div key={key} className="perm-row">
                  <div className="perm-label">{label}</div>
                  <div className="toggle-wrap" onClick={() => setPermsState(p => ({ ...p, [key]: !p[key] }))}>
                    <div className={`toggle-track ${permsState[key] !== false ? 'on' : ''}`}><div className="toggle-knob" /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPerms(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={savePerms}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TIMESHEETS ────────────────────────────────────────────────
function TimesheetsPage({ t, lang, employees, user, employee }: any) {
  const [entries, setEntries] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [selected, setSelected] = useState<string[]>([])
  const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]))

  async function load() {
    let q = supabase.from('time_entries').select('*').gte('date', dateFrom).lte('date', dateTo).order('date', { ascending: false })
    if (user.role === 'employee') q = q.eq('emp_id', employee?.id)
    const { data } = await q
    setEntries(data || [])
  }

  async function approveSelected() {
    await supabase.from('time_entries').update({ status: 'approved', approved_by: 'admin', approved_at: new Date().toISOString() }).in('id', selected)
    setSelected([]); load()
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('timesheets')}</div></div>
        <div className="page-actions">
          <input type="date" className="form-input" style={{ width: 140, padding: '5px 8px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="form-input" style={{ width: 140, padding: '5px 8px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={load}>{lang === 'es' ? 'Cargar' : 'Load'}</button>
          {user.role !== 'employee' && selected.length > 0 && <button className="btn btn-success btn-sm" onClick={approveSelected}>{t('approve')} ({selected.length})</button>}
        </div>
      </div>
      <div className="page-body">
        <div className="card"><div className="card-body-np">
          <table className="tbl">
            <thead><tr>
              {user.role !== 'employee' && <th><input type="checkbox" onChange={e => setSelected(e.target.checked ? entries.map(e => e.id) : [])} /></th>}
              <th>{t('name')}</th><th>{t('date')}</th><th>{lang === 'es' ? 'Entrada' : 'In'}</th>
              <th>{lang === 'es' ? 'Salida' : 'Out'}</th><th>{lang === 'es' ? 'Horas' : 'Hours'}</th>
              <th>{lang === 'es' ? 'Descanso' : 'Break'}</th><th>{t('status')}</th>
              <th>Geo</th>
            </tr></thead>
            <tbody>
              {entries.map(e => {
                const emp = empMap[e.emp_id]
                const geo = e.clock_in_distance != null
                  ? <span className={`badge ${e.within_geofence ? 'badge-green' : 'badge-red'}`}>✓ {Math.round(e.clock_in_distance)}m</span>
                  : '—'
                return (
                  <tr key={e.id}>
                    {user.role !== 'employee' && <td><input type="checkbox" checked={selected.includes(e.id)} onChange={ev => setSelected(s => ev.target.checked ? [...s, e.id] : s.filter(x => x !== e.id))} /></td>}
                    <td>{emp ? <div className="chip"><div className="avatar" style={{ background: emp.avatar_color || '#6D28D9', color: '#fff' }}>{initials(emp)}</div><span className="chip-name">{emp.first} {emp.last}</span></div> : '—'}</td>
                    <td>{e.date}</td>
                    <td>{e.clock_in || '—'}</td>
                    <td>{e.clock_out || '—'}</td>
                    <td><b>{e.total_hours?.toFixed(2) || 0}h</b></td>
                    <td>{e.break_mins || 0}m</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>{geo}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></div>
      </div>
    </div>
  )
}

// ── PAYROLL ───────────────────────────────────────────────────
function PayrollPage({ t, lang, employees, config, sym, user, onConfigRefresh }: any) {
  const [tab, setTab] = useState<'preview' | 'run' | 'history' | 'deductions'>('preview')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [periods, setPeriods] = useState<any[]>([])
  const [paystub, setPaystub] = useState<any>(null)
  const [deds, setDeds] = useState<DeductionConfig[]>([])

  useEffect(() => { if (tab === 'history') loadPeriods(); if (tab === 'deductions') loadDeds() }, [tab])

  async function loadDeds() {
    try { setDeds(JSON.parse(config.deductions || '[]')) } catch { }
  }

  async function runPreview() {
    const { data: entries } = await supabase.from('time_entries').select('*').in('status', ['complete', 'approved']).gte('date', dateFrom).lte('date', dateTo)
    const deductionsConfig: DeductionConfig[] = JSON.parse(config.deductions || '[]')
    const activeEmps = employees.filter((e: any) => e.status === 'active')
    const rows = activeEmps.map((emp: any) => {
      const empEntries = (entries || []).filter((e: any) => e.emp_id === emp.id)
      return calcPayrollRow(emp, empEntries, deductionsConfig, config)
    }).filter((r: any) => r.total_hours > 0 || emp_wage_type(r) === 'salary')
    setPreviewRows(rows)
  }

  function emp_wage_type(r: any) { return employees.find((e: any) => e.id === r.emp_id)?.wage_type || 'hourly' }

  async function runPayroll() {
    if (!confirm(t('confirmRunPayroll'))) return
    const { data: entries } = await supabase.from('time_entries').select('*').in('status', ['complete', 'approved']).gte('date', dateFrom).lte('date', dateTo)
    const deductionsConfig: DeductionConfig[] = JSON.parse(config.deductions || '[]')
    const activeEmps = employees.filter((e: any) => e.status === 'active')

    const { data: period } = await supabase.from('payroll_periods').insert({ date_from: dateFrom, date_to: dateTo, status: 'processed', processed_by: 'admin', processed_at: new Date().toISOString(), frequency: config.payroll_frequency || 'biweekly' }).select().single()
    if (!period) return

    let totalGross = 0, totalDed = 0, totalNet = 0, count = 0
    for (const emp of activeEmps) {
      const empEntries = (entries || []).filter((e: any) => e.emp_id === emp.id)
      if (!empEntries.length && emp.wage_type !== 'salary') continue
      const row = calcPayrollRow(emp, empEntries, deductionsConfig, config)
      await supabase.from('payroll_entries').insert({ period_id: period.id, emp_id: emp.id, regular_hours: row.regular_hours, overtime_hours: row.overtime_hours, overtime_daily_hours: row.overtime_daily_hours, hourly_rate: row.hourly_rate || 0, gross: row.gross, tips: row.tips, deductions: row.deductions, total_deductions: row.total_deductions, net: row.net })
      totalGross += row.gross; totalDed += row.total_deductions; totalNet += row.net; count++
    }
    await supabase.from('payroll_periods').update({ total_gross: totalGross, total_deductions: totalDed, total_net: totalNet, total_employees: count }).eq('id', period.id)
    setTab('history')
  }

  async function loadPeriods() {
    const { data } = await supabase.from('payroll_periods').select('*').order('created_at', { ascending: false }).limit(24)
    setPeriods(data || [])
  }

  async function saveDeds() {
    await supabase.from('app_config').update({ value: JSON.stringify(deds) }).eq('key', 'deductions')
    onConfigRefresh()
    alert(lang === 'es' ? 'Deducciones guardadas' : 'Deductions saved')
  }

  const totals = previewRows.reduce((acc, r) => ({ gross: acc.gross + r.gross, ded: acc.ded + r.total_deductions, net: acc.net + r.net, tips: acc.tips + r.tips }), { gross: 0, ded: 0, net: 0, tips: 0 })

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('payroll')}</div></div>
        <div className="page-actions">
          {(['preview','run','history','deductions'] as const).map(tb => (
            <button key={tb} className={`btn btn-sm ${tab === tb ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(tb)}>
              {tb === 'preview' ? t('preview') : tb === 'run' ? t('runPayroll') : tb === 'history' ? t('payrollHistory') : t('deductions')}
            </button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {(tab === 'preview' || tab === 'run') && <>
          <div className="card">
            <div className="card-body">
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('from')}</label><input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">{t('to')}</label><input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={runPreview}>{lang === 'es' ? 'Calcular' : 'Calculate'}</button>
                {tab === 'run' && <button className="btn btn-primary btn-sm" onClick={runPayroll}>{lang === 'es' ? 'Confirmar y Procesar' : 'Confirm & Process'}</button>}
              </div>
            </div>
          </div>
          {previewRows.length > 0 && <>
            <div className="stat-grid">
              <div className="stat-card g"><div className="stat-icon g">💰</div><div className="stat-label">{t('gross')}</div><div className="stat-value">{sym}{totals.gross.toFixed(2)}</div></div>
              <div className="stat-card r"><div className="stat-icon r">📉</div><div className="stat-label">{t('deductions')}</div><div className="stat-value">{sym}{totals.ded.toFixed(2)}</div></div>
              <div className="stat-card v"><div className="stat-icon v">✅</div><div className="stat-label">{t('net')}</div><div className="stat-value">{sym}{totals.net.toFixed(2)}</div></div>
              <div className="stat-card b"><div className="stat-icon b">👥</div><div className="stat-label">{lang === 'es' ? 'Empleados' : 'Employees'}</div><div className="stat-value">{previewRows.length}</div></div>
            </div>
            <div className="card"><div className="card-body-np"><table className="tbl">
              <thead><tr><th>{t('name')}</th><th>{t('department')}</th><th>{t('regHours')}</th><th>{t('otHours')}</th><th>{t('gross')}</th><th>{t('deductions')}</th><th>{t('net')}</th><th></th></tr></thead>
              <tbody>{previewRows.map(r => (
                <tr key={r.emp_id}>
                  <td><b>{r.name}</b></td><td>{r.dept || '—'}</td>
                  <td>{r.regular_hours}</td>
                  <td>{r.overtime_hours > 0 ? <span style={{ color: 'var(--amber2)', fontWeight: 700 }}>{r.overtime_hours}</span> : 0}</td>
                  <td>{sym}{r.gross.toFixed(2)}</td>
                  <td style={{ color: 'var(--red2)' }}>-{sym}{r.total_deductions.toFixed(2)}</td>
                  <td style={{ fontWeight: 800, color: 'var(--green2)' }}>{sym}{r.net.toFixed(2)}</td>
                  <td><button className="btn btn-secondary btn-xs" onClick={() => setPaystub(r)}>📄</button></td>
                </tr>
              ))}</tbody>
            </table></div></div>
          </>}
        </>}

        {tab === 'history' && <div className="card"><div className="card-body-np"><table className="tbl">
          <thead><tr><th>{lang === 'es' ? 'Período' : 'Period'}</th><th>{lang === 'es' ? 'Empleados' : 'Employees'}</th><th>{t('gross')}</th><th>{t('deductions')}</th><th>{t('net')}</th><th>{t('status')}</th><th></th></tr></thead>
          <tbody>{periods.map(p => <tr key={p.id}>
            <td>{p.date_from} – {p.date_to}</td>
            <td>{p.total_employees}</td>
            <td>{sym}{(p.total_gross||0).toFixed(2)}</td>
            <td>{sym}{(p.total_deductions||0).toFixed(2)}</td>
            <td style={{ fontWeight: 800, color: 'var(--green2)' }}>{sym}{(p.total_net||0).toFixed(2)}</td>
            <td><StatusBadge status={p.status} /></td>
            <td>{p.status !== 'paid' && <button className="btn btn-success btn-xs" onClick={async () => { await supabase.from('payroll_periods').update({ status: 'paid' }).eq('id', p.id); loadPeriods() }}>{t('markAsPaid')}</button>}</td>
          </tr>)}</tbody>
        </table></div></div>}

        {tab === 'deductions' && <div className="card">
          <div className="card-header">
            <span className="card-title">{t('deductions')}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setDeds(d => [...d, { id: d.length + 1, name: '', name_es: '', type: 'percent', value: 0, active: true }])}>+ {t('add')}</button>
          </div>
          <div className="card-body">
            {deds.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input className="form-input" style={{ flex: 2 }} placeholder="Name (EN)" value={d.name} onChange={e => setDeds(ds => ds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <input className="form-input" style={{ flex: 2 }} placeholder="Nombre (ES)" value={d.name_es} onChange={e => setDeds(ds => ds.map((x, j) => j === i ? { ...x, name_es: e.target.value } : x))} />
                <select className="form-select" style={{ width: 80 }} value={d.type} onChange={e => setDeds(ds => ds.map((x, j) => j === i ? { ...x, type: e.target.value as any } : x))}>
                  <option value="percent">%</option><option value="fixed">$</option>
                </select>
                <input className="form-input" style={{ width: 80 }} type="number" step="0.01" value={d.value} onChange={e => setDeds(ds => ds.map((x, j) => j === i ? { ...x, value: parseFloat(e.target.value) } : x))} />
                <div className="toggle-wrap" onClick={() => setDeds(ds => ds.map((x, j) => j === i ? { ...x, active: !x.active } : x))}>
                  <div className={`toggle-track ${d.active ? 'on' : ''}`}><div className="toggle-knob" /></div>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => setDeds(ds => ds.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveDeds}>{t('save')}</button>
          </div>
        </div>}
      </div>

      {/* PAYSTUB */}
      {paystub && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-header">{t('paystub')} — {paystub.name}<button className="modal-close" onClick={() => setPaystub(null)}>✕</button></div>
            <div className="modal-body">
              <div className="paystub">
                <div className="paystub-header">
                  <div><div className="paystub-company">{config.company_name || 'Company'}</div><div style={{ fontSize: '.7rem', color: '#64748b' }}>{t('paystub')}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{paystub.name}</div><div style={{ fontSize: '.7rem', color: '#64748b' }}>{paystub.dept}</div></div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748b', marginBottom: 6 }}>{lang === 'es' ? 'Horas Trabajadas' : 'Hours Worked'}</div>
                  <div className="paystub-row"><span>{t('regularHours')}</span><span>{paystub.regular_hours}h @ {sym}{(paystub.hourly_rate || 0).toFixed(2)}</span></div>
                  {paystub.overtime_hours > 0 && <div className="paystub-row"><span>{t('overtimeHours')}</span><span>{paystub.overtime_hours}h × 1.5</span></div>}
                  {paystub.tips > 0 && <div className="paystub-row"><span>{t('tips')}</span><span>{sym}{paystub.tips.toFixed(2)}</span></div>}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748b', marginBottom: 6 }}>{t('deductions')}</div>
                  {paystub.deductions.map((d: any, i: number) => <div key={i} className="paystub-row"><span>{lang === 'es' ? d.name_es || d.name : d.name} {d.type === 'percent' ? `(${d.rate}%)` : '(Fixed)'}</span><span>-{sym}{d.amount.toFixed(2)}</span></div>)}
                </div>
                <div className="paystub-row" style={{ padding: '7px 0', fontWeight: 700 }}><span>{t('gross')}</span><span>{sym}{paystub.gross.toFixed(2)}</span></div>
                <div className="paystub-row" style={{ padding: '7px 0', color: '#dc2626' }}><span>{t('totalDeductions')}</span><span>-{sym}{paystub.total_deductions.toFixed(2)}</span></div>
                <div className="paystub-total"><span>NET PAY</span><span>{sym}{paystub.net.toFixed(2)}</span></div>
                <div style={{ textAlign: 'center', fontSize: '.64rem', color: '#94a3b8', marginTop: 14 }}>{lang === 'es' ? 'Este es un documento oficial de nómina.' : 'This is an official payroll document.'}</div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={() => window.print()}>🖨 {t('print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── REPORTS ───────────────────────────────────────────────────
function ReportsPage({ t, lang, employees, sym }: any) {
  const [repTab, setRepTab] = useState<'hours' | 'dept' | 'pto'>('hours')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows] = useState<any[]>([])
  const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]))

  async function loadHours() {
    const { data } = await supabase.from('time_entries').select('emp_id, date, total_hours, tips').in('status', ['complete', 'approved']).gte('date', dateFrom).lte('date', dateTo)
    const byEmp: Record<string, any> = {}
    ;(data || []).forEach((e: any) => {
      if (!byEmp[e.emp_id]) byEmp[e.emp_id] = { emp_id: e.emp_id, total_hours: 0, tips: 0, dates: new Set() }
      byEmp[e.emp_id].total_hours += e.total_hours || 0
      byEmp[e.emp_id].tips += e.tips || 0
      byEmp[e.emp_id].dates.add(e.date)
    })
    setRows(Object.values(byEmp).map(r => ({ ...r, days: r.dates.size, emp: empMap[r.emp_id] })).sort((a, b) => b.total_hours - a.total_hours))
  }

  async function loadDept() {
    const { data } = await supabase.from('time_entries').select('emp_id, total_hours').in('status', ['complete', 'approved']).gte('date', dateFrom).lte('date', dateTo)
    const byDept: Record<string, any> = {}
    ;(data || []).forEach((e: any) => {
      const emp = empMap[e.emp_id]
      const dept = emp?.dept || 'Unassigned'
      if (!byDept[dept]) byDept[dept] = { dept, employees: new Set(), total_hours: 0, total_gross: 0 }
      byDept[dept].employees.add(e.emp_id)
      byDept[dept].total_hours += e.total_hours || 0
      byDept[dept].total_gross += (e.total_hours || 0) * (emp?.hourly_rate || 0)
    })
    setRows(Object.values(byDept).map(r => ({ ...r, employees: r.employees.size })))
  }

  async function loadPTO() {
    setRows(employees.filter((e: any) => e.status === 'active').map((e: any) => ({ ...e, pto_balance: (e.pto_balance || 0), pto_used: e.pto_used || 0 })))
  }

  function exportCSV() {
    const data = rows.map(r => repTab === 'hours' ? [r.emp?.first + ' ' + r.emp?.last, r.emp?.dept, r.days, r.total_hours.toFixed(2), r.tips.toFixed(2)] : repTab === 'dept' ? [r.dept, r.employees, r.total_hours.toFixed(2), r.total_gross.toFixed(2)] : [r.first + ' ' + r.last, r.dept, r.pto_balance, r.pto_used])
    const csv = [Object.keys(rows[0] || {}).join(','), ...data.map((r: any) => r.join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = `staffforce-${repTab}-report.csv`; a.click()
  }

  useEffect(() => { repTab === 'hours' ? loadHours() : repTab === 'dept' ? loadDept() : loadPTO() }, [repTab, employees])

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('reports')}</div></div>
      </div>
      <div className="page-body">
        <div className="tabs">
          <div className={`tab ${repTab === 'hours' ? 'active' : ''}`} onClick={() => setRepTab('hours')}>{lang === 'es' ? 'Horas' : 'Hours'}</div>
          <div className={`tab ${repTab === 'dept' ? 'active' : ''}`} onClick={() => setRepTab('dept')}>{t('byDepartment')}</div>
          <div className={`tab ${repTab === 'pto' ? 'active' : ''}`} onClick={() => setRepTab('pto')}>PTO</div>
        </div>
        {repTab !== 'pto' && (
          <div className="card" style={{ marginBottom: 12 }}><div className="card-body">
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">{t('from')}</label><input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">{t('to')}</label><input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => repTab === 'hours' ? loadHours() : loadDept()}>{t('refresh')}</button>
          </div></div>
        )}
        <div className="card"><div className="card-body-np"><table className="tbl">
          {repTab === 'hours' && <>
            <thead><tr><th>{t('name')}</th><th>{t('department')}</th><th>{t('days')}</th><th>{t('totalHours')}</th><th>{t('tips')}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td><b>{r.emp?.first} {r.emp?.last}</b></td><td>{r.emp?.dept || '—'}</td><td>{r.days}</td><td><b>{r.total_hours.toFixed(2)}h</b></td><td>{sym}{r.tips.toFixed(2)}</td></tr>)}</tbody>
          </>}
          {repTab === 'dept' && <>
            <thead><tr><th>{t('department')}</th><th>{lang === 'es' ? 'Empleados' : 'Employees'}</th><th>{t('totalHours')}</th><th>{t('gross')}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td><b>{r.dept}</b></td><td>{r.employees}</td><td>{r.total_hours.toFixed(2)}h</td><td>{sym}{r.total_gross.toFixed(2)}</td></tr>)}</tbody>
          </>}
          {repTab === 'pto' && <>
            <thead><tr><th>{t('name')}</th><th>{t('department')}</th><th>{t('ptoAccrued')}</th><th>{t('ptoUsed')}</th><th>{t('ptoBalance')}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td><b>{r.first} {r.last}</b></td><td>{r.dept || '—'}</td><td>{r.pto_balance.toFixed(1)}h</td><td>{r.pto_used.toFixed(1)}h</td><td style={{ fontWeight: 800, color: r.pto_balance - r.pto_used > 0 ? 'var(--green2)' : 'var(--red2)' }}>{(r.pto_balance - r.pto_used).toFixed(1)}h</td></tr>)}</tbody>
          </>}
        </table></div></div>
        {rows.length > 0 && <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={exportCSV}>⬇ {t('exportCSV')}</button>}
      </div>
    </div>
  )
}

// ── TIME OFF ──────────────────────────────────────────────────
function TimeOffPage({ t, lang, employees, user, employee }: any) {
  const [requests, setRequests] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ emp_id: '', type: 'vacation', date_from: '', date_to: '', hours: 8, reason: '' })
  const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]))

  async function load() {
    let q = supabase.from('time_off').select('*').order('created_at', { ascending: false })
    if (user.role === 'employee') q = q.eq('emp_id', employee?.id)
    const { data } = await q; setRequests(data || [])
  }

  useEffect(() => { load() }, [employee])

  async function submit() {
    const empId = user.role === 'employee' ? employee?.id : form.emp_id
    await supabase.from('time_off').insert({ ...form, emp_id: empId, status: 'pending' })
    setShowModal(false); load()
  }

  async function approve(id: string) {
    await supabase.from('time_off').update({ status: 'approved', approved_by: 'admin', approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function reject(id: string) {
    await supabase.from('time_off').update({ status: 'rejected' }).eq('id', id)
    load()
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('timeoff')}</div></div>
        <div className="page-actions"><button className="btn btn-primary btn-sm" onClick={() => { setForm({ emp_id: employees[0]?.id || '', type: 'vacation', date_from: new Date().toISOString().split('T')[0], date_to: new Date().toISOString().split('T')[0], hours: 8, reason: '' }); setShowModal(true) }}>+ {t('requestTimeOff')}</button></div>
      </div>
      <div className="page-body">
        <div className="card"><div className="card-body-np"><table className="tbl">
          <thead><tr><th>{t('name')}</th><th>{lang === 'es' ? 'Tipo' : 'Type'}</th><th>{t('from')}</th><th>{t('to')}</th><th>{t('hours')}</th><th>{t('status')}</th>{user.role !== 'employee' && <th></th>}</tr></thead>
          <tbody>{requests.map(r => {
            const emp = empMap[r.emp_id]
            return (
              <tr key={r.id}>
                <td>{emp ? `${emp.first} ${emp.last}` : '—'}</td>
                <td>{r.type}</td><td>{r.date_from}</td><td>{r.date_to}</td><td>{r.hours}h</td>
                <td><StatusBadge status={r.status} /></td>
                {user.role !== 'employee' && <td>{r.status === 'pending' && <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-success btn-xs" onClick={() => approve(r.id)}>{t('approve')}</button>
                  <button className="btn btn-danger btn-xs" onClick={() => reject(r.id)}>{t('reject')}</button>
                </div>}</td>}
              </tr>
            )
          })}</tbody>
        </table></div></div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">{t('requestTimeOff')}<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              {user.role !== 'employee' && (
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Empleado' : 'Employee'}</label>
                  <select className="form-select" value={form.emp_id} onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))}>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.first} {e.last}</option>)}
                  </select>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Tipo' : 'Type'}</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['vacation','sick','personal','unpaid','bereavement'].map(v => <option key={v} value={v}>{t(v as any)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{t('hours')}</label><input className="form-input" type="number" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: parseInt(e.target.value) }))} /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('from')}</label><input className="form-input" type="date" value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{t('to')}</label><input className="form-input" type="date" value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">{t('reason')}</label><textarea className="form-textarea" rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={submit}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── LOCATIONS PAGE ────────────────────────────────────────────
function LocationsPage({ t, lang, locations, onRefresh }: any) {
  const [showModal, setShowModal] = useState(false)
  const [editLoc, setEditLoc] = useState<any>(null)
  const [form, setForm] = useState<any>({})

  function openAdd() { setForm({ geo_radius: 100, geo_enabled: false, currency: 'USD', currency_symbol: '$', type: 'hotel' }); setEditLoc(null); setShowModal(true) }
  function openEdit(l: any) { setForm({ ...l }); setEditLoc(l); setShowModal(true) }

  async function saveLoc() {
    if (!form.name) return
    if (editLoc) await supabase.from('locations').update(form).eq('id', editLoc.id)
    else await supabase.from('locations').insert(form)
    setShowModal(false); onRefresh()
  }

  async function useMyLocation() {
    try {
      const pos = await getCurrentPosition()
      setForm((f: any) => ({ ...f, geo_lat: pos.lat, geo_lng: pos.lng }))
    } catch { }
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('locations')}</div></div>
        <div className="page-actions"><button className="btn btn-primary btn-sm" onClick={openAdd}>+ {t('add')}</button></div>
      </div>
      <div className="page-body">
        {locations.map((l: any) => (
          <div key={l.id} className="card">
            <div className="card-header">
              <span className="card-title">🏢 {l.name}</span>
              <span className={`badge ${l.geo_enabled ? 'badge-green' : 'badge-gray'}`}>Geo {l.geo_enabled ? 'ON' : 'OFF'}</span>
              <button className="btn btn-secondary btn-xs" onClick={() => openEdit(l)}>{t('edit')}</button>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: '.76rem' }}>
              <div><span style={{ color: 'var(--t3)' }}>{lang === 'es' ? 'Dirección' : 'Address'}: </span>{l.address || '—'}</div>
              <div><span style={{ color: 'var(--t3)' }}>{lang === 'es' ? 'Teléfono' : 'Phone'}: </span>{l.phone || '—'}</div>
              <div><span style={{ color: 'var(--t3)' }}>Manager: </span>{l.manager || '—'}</div>
              {l.geo_enabled && <>
                <div><span style={{ color: 'var(--t3)' }}>Lat/Lng: </span>{l.geo_lat}, {l.geo_lng}</div>
                <div><span style={{ color: 'var(--t3)' }}>Radius: </span>{l.geo_radius}m</div>
              </>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">{editLoc ? (lang === 'es' ? 'Editar Ubicación' : 'Edit Location') : (lang === 'es' ? 'Nueva Ubicación' : 'New Location')}<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">{lang === 'es' ? 'Nombre' : 'Name'} *</label><input className="form-input" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Tipo' : 'Type'}</label>
                  <select className="form-select" value={form.type || 'hotel'} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}>
                    {['hotel','restaurant','office','retail'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Moneda' : 'Currency Symbol'}</label><input className="form-input" value={form.currency_symbol || '$'} onChange={e => setForm((f: any) => ({ ...f, currency_symbol: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">{lang === 'es' ? 'Dirección' : 'Address'}</label><input className="form-input" value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Teléfono' : 'Phone'}</label><input className="form-input" value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Manager</label><input className="form-input" value={form.manager || ''} onChange={e => setForm((f: any) => ({ ...f, manager: e.target.value }))} /></div>
              </div>
              <div style={{ borderTop: '1px solid var(--b)', paddingTop: 14, marginTop: 4 }}>
                <div className="toggle-wrap" style={{ marginBottom: 12 }} onClick={() => setForm((f: any) => ({ ...f, geo_enabled: !f.geo_enabled }))}>
                  <div className={`toggle-track ${form.geo_enabled ? 'on' : ''}`}><div className="toggle-knob" /></div>
                  <span className="toggle-label">{t('enableGeofencing')}</span>
                </div>
                {form.geo_enabled && <>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: 10 }}>{t('geoCoordinatesDesc')}</div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">{t('latitude')}</label><input className="form-input" type="number" step="any" value={form.geo_lat || ''} onChange={e => setForm((f: any) => ({ ...f, geo_lat: parseFloat(e.target.value) }))} /></div>
                    <div className="form-group"><label className="form-label">{t('longitude')}</label><input className="form-input" type="number" step="any" value={form.geo_lng || ''} onChange={e => setForm((f: any) => ({ ...f, geo_lng: parseFloat(e.target.value) }))} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">{t('radiusMeters')}</label><input className="form-input" type="number" value={form.geo_radius || 100} onChange={e => setForm((f: any) => ({ ...f, geo_radius: parseInt(e.target.value) }))} /></div>
                  <button className="btn btn-secondary btn-xs" onClick={useMyLocation} style={{ marginBottom: 8 }}>📍 {t('useCurrentLocation')}</button>
                </>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveLoc}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DOCUMENTS PAGE ────────────────────────────────────────────
function DocumentsPage({ t, lang, employees, user, employee }: any) {
  const [docs, setDocs] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]))
  const today = new Date().toISOString().split('T')[0]

  async function load() {
    let q = supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (user.role === 'employee') q = q.eq('emp_id', employee?.id)
    const { data } = await q; setDocs(data || [])
  }

  useEffect(() => { load() }, [employee])

  async function saveDoc() {
    await supabase.from('documents').insert({ ...form, status: 'active' })
    setShowModal(false); load()
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div><div className="page-title">{t('documents')}</div></div>
        <div className="page-actions"><button className="btn btn-primary btn-sm" onClick={() => { setForm({ emp_id: user.role === 'employee' ? employee?.id : '', category: 'contract' }); setShowModal(true) }}>+ {t('add')}</button></div>
      </div>
      <div className="page-body">
        <div className="card"><div className="card-body-np"><table className="tbl">
          <thead><tr><th>{lang === 'es' ? 'Empleado' : 'Employee'}</th><th>{lang === 'es' ? 'Nombre' : 'Name'}</th><th>{lang === 'es' ? 'Categoría' : 'Category'}</th><th>{lang === 'es' ? 'Vencimiento' : 'Expiry'}</th><th>{t('status')}</th><th></th></tr></thead>
          <tbody>{docs.map(d => {
            const emp = empMap[d.emp_id]
            const isExp = d.expiry_date && d.expiry_date < today
            return <tr key={d.id}>
              <td>{emp ? `${emp.first} ${emp.last}` : '—'}</td>
              <td>{d.name}</td><td>{d.category || '—'}</td>
              <td style={isExp ? { color: 'var(--red2)', fontWeight: 700 } : {}}>{d.expiry_date || '—'}</td>
              <td><StatusBadge status={isExp ? 'expired' : d.status} /></td>
              <td><button className="btn btn-danger btn-xs" onClick={async () => { await supabase.from('documents').delete().eq('id', d.id); load() }}>✕</button></td>
            </tr>
          })}</tbody>
        </table></div></div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">{lang === 'es' ? 'Agregar Documento' : 'Add Document'}<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              {user.role !== 'employee' && (
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Empleado' : 'Employee'}</label>
                  <select className="form-select" value={form.emp_id || ''} onChange={e => setForm((f: any) => ({ ...f, emp_id: e.target.value || null }))}>
                    <option value="">{lang === 'es' ? '— General —' : '— General —'}</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.first} {e.last}</option>)}
                  </select>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Nombre' : 'Name'} *</label><input className="form-input" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{lang === 'es' ? 'Categoría' : 'Category'}</label>
                  <select className="form-select" value={form.category || 'contract'} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>
                    {['contract','id','certification','health','tax','other'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">{lang === 'es' ? 'Vencimiento' : 'Expiry Date'}</label><input className="form-input" type="date" value={form.expiry_date || ''} onChange={e => setForm((f: any) => ({ ...f, expiry_date: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveDoc}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SETTINGS PAGE ─────────────────────────────────────────────
function SettingsPage({ t, lang, config, onRefresh }: any) {
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => { setForm({ ...config }) }, [config])

  async function save() {
    for (const [key, value] of Object.entries(form)) {
      await supabase.from('app_config').upsert({ key, value }, { onConflict: 'key' })
    }
    onRefresh()
    alert(lang === 'es' ? 'Configuración guardada' : 'Settings saved')
  }

  const f = (k: string) => form[k] || ''
  const sf = (k: string, v: string) => setForm(c => ({ ...c, [k]: v }))

  return (
    <div className="page fade-up">
      <div className="page-header"><div><div className="page-title">{t('settings')}</div></div></div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">🏢 {lang === 'es' ? 'Empresa' : 'Company'}</span></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">{t('companyName')}</label><input className="form-input" value={f('company_name')} onChange={e => sf('company_name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">{t('currencySymbol')}</label><input className="form-input" value={f('currency_symbol')} onChange={e => sf('currency_symbol', e.target.value)} style={{ width: 80 }} /></div>
              <div className="form-group"><label className="form-label">{t('systemLanguage')}</label>
                <select className="form-select" value={f('lang')} onChange={e => sf('lang', e.target.value)}>
                  <option value="en">English</option><option value="es">Español</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">💰 {lang === 'es' ? 'Nómina' : 'Payroll'}</span></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">{t('payrollFrequency')}</label>
                <select className="form-select" value={f('payroll_frequency')} onChange={e => sf('payroll_frequency', e.target.value)}>
                  <option value="weekly">{t('weekly')}</option><option value="biweekly">{t('biweekly')}</option>
                  <option value="semimonthly">{t('semimonthly')}</option><option value="monthly">{t('monthly')}</option>
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">{t('otWeekly')}</label><input className="form-input" type="number" value={f('ot_threshold_weekly')} onChange={e => sf('ot_threshold_weekly', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">{t('otDaily')}</label><input className="form-input" type="number" value={f('ot_threshold_daily')} onChange={e => sf('ot_threshold_daily', e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">{t('otMultiplier')}</label><input className="form-input" type="number" step="0.1" value={f('ot_multiplier')} onChange={e => sf('ot_multiplier', e.target.value)} style={{ width: 90 }} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">📍 {t('geofencing')}</span></div>
            <div className="card-body">
              <div className="toggle-wrap" style={{ marginBottom: 12 }} onClick={() => sf('geo_enabled', f('geo_enabled') === 'true' ? 'false' : 'true')}>
                <div className={`toggle-track ${f('geo_enabled') === 'true' ? 'on' : ''}`}><div className="toggle-knob" /></div>
                <span className="toggle-label">{t('enableGeo')}</span>
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--t3)', lineHeight: 1.6 }}>{t('geoDesc')}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">⏱ {t('ptoAccrual')}</span></div>
            <div className="card-body">
              <div className="toggle-wrap" style={{ marginBottom: 12 }} onClick={() => sf('pto_accrual_enabled', f('pto_accrual_enabled') === 'true' ? 'false' : 'true')}>
                <div className={`toggle-track ${f('pto_accrual_enabled') === 'true' ? 'on' : ''}`}><div className="toggle-knob" /></div>
                <span className="toggle-label">{t('autoAccrue')}</span>
              </div>
              <div className="form-group"><label className="form-label">{t('accrualRate')}</label><input className="form-input" type="number" step="0.001" value={f('pto_accrual_rate')} onChange={e => sf('pto_accrual_rate', e.target.value)} /></div>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={save}>{t('save')}</button>
      </div>
    </div>
  )
}

// ── PROFILE ───────────────────────────────────────────────────
function ProfilePage({ t, lang, employee }: any) {
  const [salHistory, setSalHistory] = useState<any[]>([])

  useEffect(() => {
    if (employee) supabase.from('salary_history').select('*').eq('emp_id', employee.id).order('created_at', { ascending: false }).then(({ data }) => setSalHistory(data || []))
  }, [employee])

  if (!employee) return <div className="no-perm"><div className="no-perm-icon">👤</div><div className="no-perm-title">N/A</div></div>

  return (
    <div className="page fade-up">
      <div className="page-header"><div><div className="page-title">{t('profile')}</div></div></div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">👤 {t('profile')}</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div className="avatar avatar-xl" style={{ background: employee.avatar_color || '#6D28D9', color: '#fff' }}>{initials(employee)}</div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{employee.first} {employee.last}</div>
                  <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>{employee.title} · {employee.dept}</div>
                </div>
              </div>
              <table style={{ fontSize: '.78rem', width: '100%' }}>
                {[['Email', employee.email], [lang === 'es' ? 'Teléfono' : 'Phone', employee.phone], [t('type'), employee.type], [lang === 'es' ? 'Inicio' : 'Start', employee.start_date], [t('ptoBalance'), `${((employee.pto_balance || 0) - (employee.pto_used || 0)).toFixed(1)}h`]].map(([k, v]) => (
                  <tr key={k}><td style={{ color: 'var(--t3)', padding: '4px 0', width: 100 }}>{k}</td><td style={{ fontWeight: 600, padding: '4px 0' }}>{v || '—'}</td></tr>
                ))}
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">💰 {t('salaryHistory')}</span></div>
            <div className="card-body-np">
              <table className="tbl">
                <thead><tr><th>{t('effectiveDate')}</th><th>{t('type')}</th><th>{t('rate')}</th><th>{lang === 'es' ? 'Razón' : 'Reason'}</th></tr></thead>
                <tbody>{salHistory.map(h => <tr key={h.id}><td>{h.effective_date}</td><td>{h.wage_type}</td><td style={{ fontFamily: 'var(--font-mono)' }}>{h.wage_type === 'salary' ? `$${(h.annual_salary || 0).toLocaleString()}/yr` : `$${(h.hourly_rate || 0).toFixed(2)}/hr`}</td><td style={{ color: 'var(--t3)' }}>{h.reason || '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
