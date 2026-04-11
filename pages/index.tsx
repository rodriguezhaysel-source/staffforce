import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, startOfWeek, addDays, differenceInMinutes } from 'date-fns'
import { entryHours } from '../components/shared/utils'
import Login from '../components/Login'
import Dashboard from '../components/Dashboard'
import Schedule from '../components/Schedule'
import Clock from '../components/Clock'
import Timesheets from '../components/Timesheets'
import TimeOff from '../components/TimeOff'
import Availability from '../components/Availability'
import ShiftSwap from '../components/ShiftSwap'
import Employees from '../components/Employees'
import Hiring from '../components/Hiring'
import Messaging from '../components/Messaging'
import Payroll from '../components/Payroll'
import Reports from '../components/Reports'
import Documents from '../components/Documents'
import Notifications from '../components/Notifications'
import Locations from '../components/Locations'
import Settings from '../components/Settings'
import type { Employee, Department, Location, TimeEntry, Shift } from '../lib/store'

type Page = 'dashboard'|'schedule'|'clock'|'timesheets'|'timeoff'|'availability'|'shiftswap'|'employees'|'hiring'|'messaging'|'payroll'|'reports'|'documents'|'notifications'|'locations'|'settings'

export default function App() {
  const [user, setUser] = useState<Employee | null>(null)
  const [lang, setLang] = useState<'en'|'es'>('en')
  const [page, setPage] = useState<Page>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [lateCount, setLateCount] = useState(0)
  const [missingCount, setMissingCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [clockedIn, setClockedIn] = useState(false)
  const [moduleVis, setModuleVis] = useState<Record<string,boolean>>({})
  const [theme, setTheme] = useState<any>({})
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!user) return
    loadGlobal()
    // Realtime for live strip & alerts
    const ch = supabase.channel('app-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => loadLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => loadLive())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `employee_id=eq.${user.id}` }, () => loadNotifCount())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  async function loadGlobal() {
    const [e, d, l, cfg] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('app_config').select('*').limit(1),
    ])
    setEmployees(e.data || [])
    setDepartments(d.data || [])
    setLocations(l.data || [])
    if (cfg.data?.[0]) {
      if (cfg.data[0].employee_modules) setModuleVis(cfg.data[0].employee_modules)
      if (cfg.data[0].theme) applyTheme(cfg.data[0].theme)
    }
    loadLive()
    loadNotifCount()
  }

  async function loadLive() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [ae, ts, pa] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('shifts').select('*').gte('start_time', today).lte('start_time', today + 'T23:59:59'),
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
    ])
    const entries: TimeEntry[] = ae.data || []
    const shifts: Shift[] = ts.data || []
    setActiveEntries(entries)
    setTodayShifts(shifts)
    setPendingCount(pa.count || 0)
    setClockedIn(!!entries.find(e => e.employee_id === user?.id))

    // Late: shift started >15min ago, not clocked in
    const late = shifts.filter(s => {
      const start = new Date(s.start_time)
      return !entries.find(e => e.employee_id === s.employee_id) && differenceInMinutes(new Date(), start) > 15
    })
    setLateCount(late.length)

    // Missing: shift exists but no entry at all today
    const missing = shifts.filter(s => {
      const start = new Date(s.start_time)
      return !entries.find(e => e.employee_id === s.employee_id) && new Date() > new Date(s.end_time)
    })
    setMissingCount(missing.length)
  }

  async function loadNotifCount() {
    if (!user) return
    const { count } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('employee_id', user.id).eq('read', false)
    setNotifCount(count || 0)
  }

  function applyTheme(t: any) {
    setTheme(t)
    if (t.primary_color) document.documentElement.style.setProperty('--primary', t.primary_color)
    if (t.sidebar_color) document.documentElement.style.setProperty('--sidebar', t.sidebar_color)
  }

  function handleLogin(emp: Employee) {
    setUser(emp)
    setLang(emp.language === 'es' ? 'es' : 'en')
  }

  function handleLogout() { setUser(null); setPage('dashboard') }

  if (!user) return <Login onLogin={handleLogin} />

  const canSeeAll = user.role === 'admin' || user.role === 'manager'
  const isVisible = (mod: string) => moduleVis[mod] !== false

  // Sidebar nav structure
  const NAV_MAIN = [
    { key: 'dashboard', label: t(lang,'dashboard'), icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { key: 'schedule', label: t(lang,'schedule'), icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { key: 'clock', label: t(lang,'clockInOut'), icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2' },
    { key: 'timesheets', label: t(lang,'timesheets'), icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2' },
    { key: 'timeoff', label: t(lang,'timeOff'), icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
    { key: 'availability', label: t(lang,'availability'), icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    { key: 'shiftswap', label: t(lang,'shiftSwap'), icon: 'M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4' },
  ]
  const NAV_TEAM = [
    ...(canSeeAll && isVisible('employees') ? [{ key: 'employees', label: t(lang,'employees'), icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }] : []),
    ...(canSeeAll && isVisible('hiring') ? [{ key: 'hiring', label: t(lang,'hiring'), icon: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z' }] : []),
    ...(isVisible('messaging') ? [{ key: 'messaging', label: t(lang,'messaging'), icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }] : []),
  ]
  const NAV_BIZ = [
    ...(canSeeAll && isVisible('payroll') ? [{ key: 'payroll', label: t(lang,'payroll'), icon: 'M2 7h20v14H2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' }] : []),
    ...(canSeeAll && isVisible('reports') ? [{ key: 'reports', label: t(lang,'reports'), icon: 'M18 20V10M12 20V4M6 20v-6' }] : []),
    ...(isVisible('documents') ? [{ key: 'documents', label: t(lang,'documents'), icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6' }] : []),
  ]
  const NAV_SYS = [
    { key: 'notifications', label: t(lang,'notifications'), icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', badge: notifCount },
    ...(canSeeAll ? [{ key: 'locations', label: t(lang,'locations'), icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }] : []),
    { key: 'settings', label: t(lang,'settings'), icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  ]

  function NavItem({ item }: { item: any }) {
    return (
      <button
        className={`sidebar-item ${page === item.key ? 'active' : ''}`}
        onClick={() => { setPage(item.key as Page); setSidebarOpen(false) }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
        {item.label}
        {item.badge > 0 && <span className="badge-dot">{item.badge}</span>}
      </button>
    )
  }

  const activeEmp = employees.filter(e => e.status === 'active')
  const deptColor = departments.find(d => d.id === user.department_id)?.color || 'var(--primary)'

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div className="sidebar-brand">StaffForce</div>
            <div className="sidebar-brand-sub">Workforce</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_MAIN.map(item => <NavItem key={item.key} item={item} />)}
          {NAV_TEAM.length > 0 && <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Team</div>
            {NAV_TEAM.map(item => <NavItem key={item.key} item={item} />)}
          </>}
          {NAV_BIZ.length > 0 && <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Business</div>
            {NAV_BIZ.map(item => <NavItem key={item.key} item={item} />)}
          </>}
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">System</div>
          {NAV_SYS.map(item => <NavItem key={item.key} item={item} />)}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <div className="sidebar-user-avatar" style={{ background: deptColor }}>
              {(user as any).avatar_url
                ? <img src={(user as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : (user.first_name?.[0]||'')+(user.last_name?.[0]||'')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user.first_name} {user.last_name?.[0]}.</div>
              <div className="sidebar-user-role">{user.position || user.role}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            {t(lang, 'logout')}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99 }} onClick={() => setSidebarOpen(false)} />}

      {/* Main area */}
      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(s => !s)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="topbar-company">StaffForce</div>
          <div className="topbar-search">
            <svg className="topbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder={t(lang, 'search') + '...'} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="topbar-lang">
            <button className={lang==='en'?'active':''} onClick={() => setLang('en')}>EN</button>
            <button className={lang==='es'?'active':''} onClick={() => setLang('es')}>ES</button>
          </div>
          <div className="topbar-notif" onClick={() => setPage('notifications')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {notifCount > 0 && <div className="topbar-notif-dot" />}
          </div>
          <div className="topbar-avatar" onClick={() => setPage('settings')}>
            {(user as any).avatar_url
              ? <img src={(user as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : (user.first_name?.[0]||'')+(user.last_name?.[0]||'')}
          </div>
        </div>

        {/* Context bar */}
        <div className="context-bar">
          <div className="context-chip active">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {locations.find(l => l.id === user.location_id)?.name || 'All Locations'}
          </div>
          <div className="context-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {departments.find(d => d.id === user.department_id)?.name || 'All Departments'}
          </div>
          <div className="context-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {format(new Date(), 'MMM d, yyyy')}
          </div>
          <div style={{ flex: 1 }} />
          {clockedIn && (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#065F46', background:'#F0FDF4', padding:'4px 12px', borderRadius:20, border:'1px solid #BBF7D0' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#059669' }} />
              Clocked In
            </div>
          )}
        </div>

        {/* Alert bar */}
        {canSeeAll && (lateCount > 0 || missingCount > 0 || pendingCount > 0) && (
          <div className="alert-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {lateCount > 0 && <div className="alert-bar-item danger" onClick={() => setPage('dashboard')}><div className="dot red" />{lateCount} Late</div>}
            {missingCount > 0 && <div className="alert-bar-item" onClick={() => setPage('dashboard')}><div className="dot" />{missingCount} Missing Shifts</div>}
            {pendingCount > 0 && <div className="alert-bar-item" onClick={() => setPage('timesheets')}><div className="dot" />{pendingCount} Pending Approvals</div>}
          </div>
        )}

        {/* Live strip */}
        {canSeeAll && (
          <div className="live-strip">
            <div className="live-strip-label">Live</div>
            {activeEmp.map(emp => {
              const clocked = activeEntries.find(e => e.employee_id === emp.id)
              const shift = todayShifts.find(s => s.employee_id === emp.id)
              const isLate = shift && !clocked && differenceInMinutes(now, new Date(shift.start_time)) > 15
              const elapsed = clocked ? differenceInMinutes(now, new Date(clocked.clock_in)) : null
              const h = elapsed ? String(Math.floor(elapsed/60)).padStart(2,'0') : null
              const m = elapsed ? String(elapsed%60).padStart(2,'0') : null
              if (!clocked && !shift) return null
              return (
                <div key={emp.id} className={`live-chip ${clocked ? 'clocked' : isLate ? 'late' : 'absent'}`}>
                  <div className={`live-chip-dot ${clocked ? 'green' : isLate ? 'red' : 'gray'}`} />
                  <span>{emp.first_name} {emp.last_name?.[0]}.</span>
                  {clocked && elapsed !== null && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, opacity:0.8 }}>({h}:{m})</span>}
                  {isLate && <span style={{ fontSize:10, fontWeight:800 }}>LATE</span>}
                </div>
              )
            })}
            {activeEntries.length === 0 && <div style={{ fontSize:12, color:'#94A3B8' }}>No employees clocked in</div>}
          </div>
        )}

        {/* Content */}
        <div className="content-area">
          {page==='dashboard'    && <Dashboard user={user} lang={lang} employees={employees} departments={departments} locations={locations} />}
          {page==='schedule'     && <Schedule user={user} lang={lang} employees={employees} departments={departments} locations={locations} />}
          {page==='clock'        && <Clock user={user} lang={lang} locations={locations} />}
          {page==='timesheets'   && <Timesheets user={user} lang={lang} employees={employees} />}
          {page==='timeoff'      && <TimeOff user={user} lang={lang} employees={employees} />}
          {page==='availability' && <Availability user={user} lang={lang} employees={employees} />}
          {page==='shiftswap'    && <ShiftSwap user={user} lang={lang} employees={employees} />}
          {page==='employees'    && <Employees user={user} lang={lang} employees={employees} setEmployees={setEmployees} departments={departments} locations={locations} />}
          {page==='hiring'       && <Hiring user={user} lang={lang} employees={employees} departments={departments} setEmployees={setEmployees} />}
          {page==='messaging'    && <Messaging user={user} lang={lang} employees={employees} />}
          {page==='payroll'      && <Payroll user={user} lang={lang} employees={employees} />}
          {page==='reports'      && <Reports user={user} lang={lang} employees={employees} departments={departments} />}
          {page==='documents'    && <Documents user={user} lang={lang} employees={employees} />}
          {page==='notifications'&& <Notifications user={user} lang={lang} onCountChange={setNotifCount} />}
          {page==='locations'    && <Locations user={user} lang={lang} locations={locations} setLocations={setLocations} />}
          {page==='settings'     && <Settings user={user} lang={lang} employees={employees} departments={departments} setEmployees={setEmployees} />}
        </div>
      </div>
    </div>
  )
}
