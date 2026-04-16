import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { empName, empInitials } from '../lib/utils'
import AdminLogin from '../components/admin/AdminLogin'
import AdminDashboard from '../components/admin/AdminDashboard'
import AdminSchedule from '../components/admin/AdminSchedule'
import AdminTimesheets from '../components/admin/AdminTimesheets'
import AdminPayroll from '../components/admin/AdminPayroll'
import AdminReports from '../components/admin/AdminReports'
import AdminEmployees from '../components/admin/AdminEmployees'
import { AdminAuditLog, AdminSettings } from '../components/admin/AdminMisc'
import HiringComponent from '../components/employee/Hiring'
import LocationsComponent from '../components/employee/Locations'
import type { Employee, Department, Location } from '../types'

type Section = 'dashboard' | 'schedule' | 'timesheets' | 'payroll' | 'reports' | 'employees' | 'timeoff' | 'hiring' | 'locations' | 'settings' | 'audit'

interface NavGroup { label: string; items: { key: Section; label: string; icon: string; badge?: number }[] }

export default function AdminPanel() {
  const [user, setUser] = useState<Employee | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [section, setSection] = useState<Section>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [companyName, setCompanyName] = useState('StaffForce')

  useEffect(() => {
    if (user) {
      loadGlobals()
      loadPending()
      const ch = supabase.channel('adm-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, loadPending)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off' }, loadPending)
        .subscribe()
      return () => { supabase.removeChannel(ch) }
    }
  }, [user])

  async function loadGlobals() {
    const [emps, depts, locs, cfg] = await Promise.all([
      supabase.from('employees').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('app_config').select('company_name').limit(1),
    ])
    setEmployees(emps.data || [])
    setDepartments(depts.data || [])
    setLocations(locs.data || [])
    if (cfg.data?.[0]?.company_name) setCompanyName(cfg.data[0].company_name)
  }

  async function loadPending() {
    const [ts, pto] = await Promise.all([
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('time_off').select('id', { count: 'exact' }).eq('status', 'pending'),
    ])
    setPendingCount((ts.count || 0) + (pto.count || 0))
  }

  function logout() { setUser(null); setEmployees([]); setDepartments([]); setLocations([]) }
  function navigate(s: Section) { setSection(s); setSidebarOpen(false) }

  if (!user) return <AdminLogin onLogin={setUser} />

  const NAV_GROUPS: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '⊞' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { key: 'schedule', label: 'Schedule', icon: '🗓' },
        { key: 'timesheets', label: 'Timesheets', icon: '📋', badge: pendingCount },
        { key: 'timeoff', label: 'Time Off', icon: '🌴' },
      ]
    },
    {
      label: 'Finance',
      items: [
        { key: 'payroll', label: 'Payroll', icon: '💰' },
        { key: 'reports', label: 'Reports', icon: '📊' },
      ]
    },
    {
      label: 'People',
      items: [
        { key: 'employees', label: 'Employees', icon: '👥' },
        { key: 'hiring', label: 'Hiring', icon: '🎯' },
      ]
    },
    {
      label: 'System',
      items: [
        { key: 'locations', label: 'Locations', icon: '📍' },
        { key: 'audit', label: 'Audit Log', icon: '🔒' },
        { key: 'settings', label: 'Settings', icon: '⚙️' },
      ]
    },
  ]

  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.label || 'Dashboard'

  function renderSection() {
    const props = { user, employees, departments, locations }
    switch (section) {
      case 'dashboard':  return <AdminDashboard {...props} />
      case 'schedule':   return <AdminSchedule user={user} employees={employees} departments={departments} locations={locations} />
      case 'timesheets': return <AdminTimesheets user={user} employees={employees} departments={departments} />
      case 'payroll':    return <AdminPayroll user={user} employees={employees} />
      case 'reports':    return <AdminReports user={user} employees={employees} departments={departments} />
      case 'employees':  return <AdminEmployees user={user} employees={employees} departments={departments} locations={locations} setEmployees={setEmployees} />
      case 'audit':      return <AdminAuditLog user={user} employees={employees} />
      case 'settings':   return <AdminSettings user={user} />
      case 'timeoff':    return <TimeOffAdmin user={user} employees={employees} departments={departments} />
      case 'hiring':     return <HiringAdmin user={user} departments={departments} employees={employees} setEmployees={setEmployees} />
      case 'locations':  return <LocationsAdmin user={user} locations={locations} setLocations={setLocations} />
      default:           return <AdminDashboard {...props} />
    }
  }

  return (
    <>
      <Head>
        <title>{currentLabel} — {companyName} Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="adm-shell">
        {/* Mobile overlay */}
        {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 250 }} onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`adm-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="adm-sidebar-logo">
            <div className="adm-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </div>
            <div>
              <div className="adm-brand">{companyName}</div>
              <div className="adm-brand-sub">Control Panel</div>
            </div>
          </div>

          <nav className="adm-nav">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <div className="adm-nav-section">{group.label}</div>
                {group.items.map(item => (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={`adm-nav-item${section === item.key ? ' active' : ''}`}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                    {(item.badge || 0) > 0 && <span className="adm-badge">{item.badge}</span>}
                  </button>
                ))}
                <div className="adm-nav-divider" />
              </div>
            ))}

            {/* Employee portal link */}
            <div style={{ padding: '8px 18px' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4B5563', fontWeight: 500 }}>
                <span>↗</span> Employee Portal
              </a>
            </div>
          </nav>

          <div className="adm-sidebar-user">
            <div className="adm-user-row">
              <div className="adm-user-avatar">
                {user.avatar_url
                  ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : empInitials(user)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="adm-user-name">{user.first_name} {user.last_name}</div>
                <div className="adm-user-role">{user.role}</div>
              </div>
            </div>
            <button className="adm-logout" onClick={logout}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="adm-main">
          {/* Topbar */}
          <header className="adm-topbar">
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div className="adm-topbar-title">{currentLabel}</div>
            <div className="adm-topbar-right">
              {pendingCount > 0 && (
                <div onClick={() => navigate('timesheets')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                  ⚠ {pendingCount} pending
                </div>
              )}
              <div style={{ fontSize: 12, color: '#6B7280' }}>{empName(user)}</div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {user.avatar_url ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : empInitials(user)}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="adm-content">
            {renderSection()}
          </main>
        </div>
      </div>
    </>
  )
}

// ── Inline stubs for Time Off, Hiring, Locations in admin ──

function TimeOffAdmin({ user, employees, departments }: any) {
  const [requests, setRequests] = useState<any[]>([])
  useEffect(() => { supabase.from('time_off').select('*').order('created_at' as any, { ascending: false }).then(({ data }) => setRequests(data || [])) }, [])
  async function review(id: string, status: string) {
    await supabase.from('time_off').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    const { data } = await supabase.from('time_off').select('*').order('created_at' as any, { ascending: false })
    setRequests(data || [])
  }
  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 20 }}>Time Off Requests</div>
      <div style={{ background: '#fff', border: '1px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Employee','Type','Start','End','Days','Reason','Status','Actions'].map(h => <th key={h} className="adm-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const emp = employees.find((e: any) => e.id === r.employee_id)
                return (
                  <tr key={r.id} className="adm-tr">
                    <td className="adm-td" style={{ fontWeight: 600 }}>{empName(emp)}</td>
                    <td className="adm-td" style={{ textTransform: 'capitalize' }}>{r.type}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{r.start_date}</td>
                    <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{r.end_date}</td>
                    <td className="adm-td">{r.days}</td>
                    <td className="adm-td" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason || '—'}</td>
                    <td className="adm-td"><span className={`adm-badge ${r.status === 'approved' ? 'adm-badge-green' : r.status === 'rejected' ? 'adm-badge-red' : 'adm-badge-yellow'}`}>{r.status}</span></td>
                    <td className="adm-td">
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="adm-btn adm-btn-success adm-btn-sm" onClick={() => review(r.id, 'approved')}>Approve</button>
                          <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => review(r.id, 'rejected')}>Deny</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {requests.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No requests</div>}
        </div>
      </div>
    </div>
  )
}

function HiringAdmin({ user, departments, employees, setEmployees }: any) {
  return <HiringComponent user={user} lang="en" departments={departments} employees={employees} setEmployees={setEmployees} />
}

function LocationsAdmin({ user, locations, setLocations }: any) {
  return <LocationsComponent user={user} lang="en" locations={locations} setLocations={setLocations} />
}
