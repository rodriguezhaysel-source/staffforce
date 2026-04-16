import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { empName, empInitials, sanitizeEmployees } from '../lib/utils'
import Login from '../components/employee/Login'
import Dashboard from '../components/employee/Dashboard'
import Clock from '../components/employee/Clock'
import Schedule from '../components/employee/Schedule'
import Timesheets from '../components/employee/Timesheets'
import TimeOff from '../components/employee/TimeOff'
import Availability from '../components/employee/Availability'
import ShiftSwap from '../components/employee/ShiftSwap'
import Payroll from '../components/employee/Payroll'
import Documents from '../components/employee/Documents'
import Messaging from '../components/employee/Messaging'
import Notifications from '../components/employee/Notifications'
import Announcements from '../components/employee/Announcements'
import Recognitions from '../components/employee/Recognitions'
import MoodCheckin from '../components/employee/MoodCheckin'
import type { Employee, Department, Location, Lang } from '../types'

type Section =
  | 'dashboard' | 'clock' | 'schedule' | 'timesheets' | 'timeoff'
  | 'availability' | 'shiftswap' | 'payroll'
  | 'documents' | 'messaging' | 'notifications'
  | 'announcements' | 'recognitions' | 'moodcheckin'

interface NavItem { key: Section; label: string; icon: string; badge?: number }

const EMPLOYEE_NAV: NavItem[] = [
  { key: 'dashboard',    label: 'Dashboard',    icon: '⊞' },
  { key: 'clock',        label: 'Clock',        icon: '⏱' },
  { key: 'schedule',     label: 'My Schedule',  icon: '🗓' },
  { key: 'timesheets',   label: 'Timesheets',   icon: '📋' },
  { key: 'timeoff',      label: 'Time Off',     icon: '🌴' },
  { key: 'payroll',      label: 'My Payslips',  icon: '💰' },
  { key: 'announcements',label: 'Announcements',icon: '📢' },
  { key: 'messaging',    label: 'Messaging',    icon: '💬' },
  { key: 'documents',    label: 'Documents',    icon: '📁' },
  { key: 'notifications',label: 'Notifications',icon: '🔔' },
]

export default function Home() {
  const [user, setUser] = useState<Employee | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [section, setSection] = useState<Section>('dashboard')
  const [lang, setLang] = useState<Lang>('en')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [companyName, setCompanyName] = useState('StaffForce')

  useEffect(() => {
    if (user) {
      loadGlobals()
      loadNotifCount()
      loadMessageCount()
      setLang((user.language as Lang) || 'en')
      const ch = supabase.channel('global-rt-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `employee_id=eq.${user.id}` }, loadNotifCount)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, loadMessageCount)
        .subscribe()
      return () => { supabase.removeChannel(ch) }
    }
  }, [user?.id])

  async function loadGlobals() {
    const [emps, depts, locs, cfg] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('app_config').select('company_name').limit(1),
    ])
    setEmployees(sanitizeEmployees(emps.data || []))
    setDepartments(depts.data || [])
    setLocations(locs.data || [])
    if (cfg.data?.[0]?.company_name) setCompanyName(cfg.data[0].company_name)
  }

  async function loadNotifCount() {
    if (!user) return
    const { count } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('employee_id', user.id).eq('read', false)
    setUnreadNotifs(count || 0)
  }

  async function loadMessageCount() {
    if (!user) return
    const { count } = await supabase.from('messages').select('id', { count: 'exact' }).eq('receiver_id', user.id).eq('read', false)
    setUnreadMessages(count || 0)
  }

  function logout() {
    setUser(null)
    setSection('dashboard')
    setEmployees([])
    setDepartments([])
    setLocations([])
  }

  function navigate(s: Section) {
    setSection(s)
    setSidebarOpen(false)
    if (s === 'notifications') setUnreadNotifs(0)
    if (s === 'messaging') setUnreadMessages(0)
  }

  if (!user) return <Login onLogin={setUser} lang={lang} setLang={setLang} />

  const nav = EMPLOYEE_NAV
  const deptColor = departments.find(d => d.id === user.department_id)?.color || '#0A6EBD'

  const commonProps = { user, lang, employees, departments, locations, setEmployees }

  function renderSection() {
    switch (section) {
      case 'dashboard':    return <Dashboard {...commonProps} />
      case 'clock':        return <Clock user={user} lang={lang} employees={employees} locations={locations} />
      case 'schedule':     return <Schedule {...commonProps} />
      case 'timesheets':   return <Timesheets user={user} lang={lang} employees={employees} />
      case 'timeoff':      return <TimeOff user={user} lang={lang} employees={employees} departments={departments} />
      case 'availability': return <Availability user={user} lang={lang} employees={employees} />
      case 'shiftswap':    return <ShiftSwap user={user} lang={lang} employees={employees} />
      case 'payroll':      return <Payroll user={user} lang={lang} employees={employees} />
      case 'documents':    return <Documents user={user} lang={lang} employees={employees} />
      case 'messaging':    return <Messaging user={user} lang={lang} employees={employees} />
      case 'notifications':return <Notifications user={user} lang={lang} onCountChange={setUnreadNotifs} />
      case 'announcements':return <Announcements user={user} lang={lang} departments={departments} />
      case 'recognitions': return <Recognitions user={user} lang={lang} employees={employees} />
      case 'moodcheckin':  return <MoodCheckin user={user} lang={lang} employees={employees} departments={departments} />
      default:             return <Dashboard {...commonProps} />
    }
  }

  const currentItem = EMPLOYEE_NAV.find(n => n.key === section)

  return (
    <>
      <Head>
        <title>{currentItem?.label || 'Dashboard'} — {companyName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-shell">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="sidebar-brand">{companyName}</div>
              <div className="sidebar-brand-sub">Workforce</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {nav.map(item => {
              const badge = item.key === 'notifications' ? unreadNotifs : item.key === 'messaging' ? unreadMessages : 0
              return (
                <button
                  key={item.key}
                  className={`sidebar-item ${section === item.key ? 'active' : ''}`}
                  onClick={() => navigate(item.key)}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                  {badge > 0 && <span className="badge-dot">{badge}</span>}
                </button>
              )
            })}
          </nav>

          <div className="sidebar-user">
            {(user.role === 'admin' || user.role === 'manager') && (
              <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 10, background: 'rgba(37,99,235,0.12)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#60A5FA', textDecoration: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Admin Panel ↗
              </a>
            )}
            <div className="sidebar-user-row">
              <div
                className="sidebar-user-avatar"
                style={{ background: user.avatar_url ? 'transparent' : deptColor }}
              >
                {user.avatar_url
                  ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : empInitials(user)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sidebar-user-name">{user.first_name} {user.last_name}</div>
                <div className="sidebar-user-role">{user.role}</div>
              </div>
            </div>
            <button className="sidebar-logout" onClick={logout}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="main-area">
          {/* Topbar */}
          <header className="topbar">
            <button className="topbar-menu-btn" onClick={() => setSidebarOpen(s => !s)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="topbar-company">{currentItem?.label || 'Dashboard'}</div>
            <div style={{ flex: 1 }} />
            {/* Lang switcher */}
            <div className="topbar-lang">
              {(['en', 'es'] as Lang[]).map(l => (
                <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            {/* Notifications bell */}
            <button
              className="topbar-notif"
              onClick={() => navigate('notifications')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotifs > 0 && <span className="topbar-notif-dot" />}
            </button>
            {/* Avatar */}
            <div className="topbar-avatar" onClick={() => navigate('notifications')} style={{ background: deptColor }}>
              {user.avatar_url
                ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : empInitials(user)}
            </div>
          </header>

          {/* Content */}
          <main className="content-area">
            {renderSection()}
          </main>
        </div>
      </div>
    </>
  )
}
