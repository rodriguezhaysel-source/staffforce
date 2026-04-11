import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { Icon } from '../components/shared/Icons'
import Login from '../components/Login'
import Dashboard from '../components/Dashboard'
import Clock from '../components/Clock'
import Schedule from '../components/Schedule'
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
import type { Employee, Department, Location } from '../lib/store'

type Module =
  | 'dashboard' | 'clock' | 'schedule' | 'timesheets'
  | 'timeoff' | 'availability' | 'shiftswap' | 'employees'
  | 'hiring' | 'messaging' | 'payroll' | 'reports'
  | 'documents' | 'notifications' | 'locations' | 'settings'

type Lang = 'en' | 'es'

const ADMIN_MODULES: Module[] = ['dashboard','clock','schedule','timesheets','timeoff','availability','shiftswap','employees','hiring','messaging','payroll','reports','documents','notifications','locations','settings']
const MANAGER_MODULES: Module[] = ['dashboard','clock','schedule','timesheets','timeoff','availability','shiftswap','employees','hiring','messaging','reports','documents','notifications','locations']
const EMPLOYEE_MODULES: Module[] = ['dashboard','clock','schedule','timesheets','timeoff','availability','shiftswap','messaging','documents','notifications']

function getAllowedModules(role: string): Module[] {
  if (role === 'admin') return ADMIN_MODULES
  if (role === 'manager') return MANAGER_MODULES
  return EMPLOYEE_MODULES
}

const NAV_ITEMS: { key: Module; icon: string }[] = [
  { key: 'dashboard', icon: 'dashboard' },
  { key: 'clock', icon: 'clock' },
  { key: 'schedule', icon: 'schedule' },
  { key: 'timesheets', icon: 'timesheets' },
  { key: 'timeoff', icon: 'timeoff' },
  { key: 'availability', icon: 'availability' },
  { key: 'shiftswap', icon: 'shiftswap' },
  { key: 'employees', icon: 'employees' },
  { key: 'hiring', icon: 'hiring' },
  { key: 'messaging', icon: 'messaging' },
  { key: 'payroll', icon: 'payroll' },
  { key: 'reports', icon: 'reports' },
  { key: 'documents', icon: 'documents' },
  { key: 'notifications', icon: 'notifications' },
  { key: 'locations', icon: 'locations' },
  { key: 'settings', icon: 'settings' },
]

const MODULE_TITLES: Record<Module, string> = {
  dashboard: 'dashboard', clock: 'clock', schedule: 'schedule',
  timesheets: 'timesheets', timeoff: 'timeoff', availability: 'availability',
  shiftswap: 'shiftswap', employees: 'employees', hiring: 'hiring',
  messaging: 'messaging', payroll: 'payroll', reports: 'reports',
  documents: 'documents', notifications: 'notifications',
  locations: 'locations', settings: 'settings',
}

export default function App() {
  const [user, setUser] = useState<Employee | null>(null)
  const [module, setModule] = useState<Module>('dashboard')
  const [lang, setLang] = useState<Lang>('en')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (user) {
      setLang((user.language as Lang) || 'en')
      loadGlobalData()
    }
  }, [user])

  async function loadGlobalData() {
    const [e, d, l] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
    ])
    setEmployees(e.data || [])
    setDepartments(d.data || [])
    setLocations(l.data || [])
  }

  function handleLogin(emp: Employee) {
    setUser(emp)
    setLang((emp.language as Lang) || 'en')
  }

  function handleLogout() {
    setUser(null)
    setModule('dashboard')
  }

  if (!user) return <Login onLogin={handleLogin} />

  const allowed = getAllowedModules(user.role)
  const visibleNav = NAV_ITEMS.filter(n => allowed.includes(n.key))

  function navTo(m: Module) {
    if (allowed.includes(m)) setModule(m)
  }

  const empInitials = (user.first_name?.[0] || '') + (user.last_name?.[0] || '')

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>StaffForce</h1>
          <span>Workforce Management</span>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map(item => (
            <button
              key={item.key}
              className={`nav-item ${module === item.key ? 'active' : ''}`}
              onClick={() => navTo(item.key)}
            >
              <span className="nav-icon"><Icon name={item.icon} size={16} /></span>
              {t(lang, item.key)}
              {item.key === 'notifications' && notifCount > 0 && (
                <span className="nav-badge">{notifCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {empInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user.first_name} {user.last_name}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
          </div>
          <button
            className="nav-item"
            style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', padding: '6px 0' }}
            onClick={handleLogout}
          >
            <span className="nav-icon"><Icon name="logout" size={15} /></span>
            {t(lang, 'logout')}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">{t(lang, MODULE_TITLES[module])}</div>
          <div className="topbar-lang">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
          </div>
        </header>

        <main className="page-content">
          {module === 'dashboard' && <Dashboard user={user} lang={lang} employees={employees} departments={departments} />}
          {module === 'clock' && <Clock user={user} lang={lang} locations={locations} />}
          {module === 'schedule' && <Schedule user={user} lang={lang} employees={employees} departments={departments} locations={locations} />}
          {module === 'timesheets' && <Timesheets user={user} lang={lang} employees={employees} />}
          {module === 'timeoff' && <TimeOff user={user} lang={lang} employees={employees} />}
          {module === 'availability' && <Availability user={user} lang={lang} employees={employees} />}
          {module === 'shiftswap' && <ShiftSwap user={user} lang={lang} employees={employees} />}
          {module === 'employees' && <Employees user={user} lang={lang} employees={employees} departments={departments} locations={locations} setEmployees={setEmployees} />}
          {module === 'hiring' && <Hiring user={user} lang={lang} departments={departments} employees={employees} setEmployees={setEmployees} />}
          {module === 'messaging' && <Messaging user={user} lang={lang} employees={employees} />}
          {module === 'payroll' && <Payroll user={user} lang={lang} employees={employees} />}
          {module === 'reports' && <Reports user={user} lang={lang} employees={employees} departments={departments} />}
          {module === 'documents' && <Documents user={user} lang={lang} employees={employees} />}
          {module === 'notifications' && <Notifications user={user} lang={lang} onCountChange={setNotifCount} />}
          {module === 'locations' && <Locations user={user} lang={lang} locations={locations} setLocations={setLocations} />}
          {module === 'settings' && <Settings user={user} lang={lang} employees={employees} departments={departments} setEmployees={setEmployees} />}
        </main>
      </div>
    </div>
  )
}
