import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcPayroll, generateNACHA } from '../lib/payroll'
import {
  LayoutDashboard, Clock, Calendar, ClipboardList, Umbrella, Users,
  UserCheck, MessageSquare, DollarSign, BarChart2, FileText, Bell,
  MapPin, Settings, LogOut, Plus, X, Edit2, Trash2, Check, ChevronDown,
  ChevronRight, Download, Upload, Eye, Search, Filter, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Info, Send, User, Building,
  Briefcase, ArrowRight, ArrowLeft, MoreVertical, Star, Phone, Mail,
  Lock, Globe, Save, Camera, Copy, ExternalLink, ChevronLeft, ChevronUp,
  TrendingUp, TrendingDown, Shuffle, CreditCard, Hash, Activity, Zap, Printer
} from 'lucide-react'
import {
  format, parseISO, differenceInMinutes, differenceInDays,
  startOfWeek, endOfWeek, addDays, isToday, isBefore, isAfter,
  startOfMonth, endOfMonth, subMonths, subWeeks, addWeeks
} from 'date-fns'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fullName = (e) => e ? `${e.first_name} ${e.last_name}` : ''
const initials = (e) => e ? `${e.first_name?.[0] || ''}${e.last_name?.[0] || ''}`.toUpperCase() : '?'

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}
function fmtHours(mins) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${m}m`
}

function Avatar({ emp, size }) {
  return (
    <div className={`avatar ${size === 'lg' ? 'avatar-lg' : size === 'sm' ? 'avatar-sm' : ''}`}>
      {initials(emp)}
    </div>
  )
}

function Modal({ open, onClose, title, children, size, footer }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : ''}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function Confirm({ open, message, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirm">
      <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Confirm</button>
      </div>
    </Modal>
  )
}

function Alert({ type, children }) {
  const icons = { success: <CheckCircle size={16} />, danger: <XCircle size={16} />, warning: <AlertTriangle size={16} />, info: <Info size={16} /> }
  return <div className={`alert alert-${type}`}>{icons[type]}<span>{children}</span></div>
}

function Spinner({ large }) {
  return <div className={`spinner${large ? ' spinner-lg' : ''}`} />
}

// ── Login ─────────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recEmail, setRecEmail] = useState('')
  const [recPass, setRecPass] = useState('')
  const [recMsg, setRecMsg] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password_hash', password.trim())
      .eq('status', 'active')
      .single()
    setLoading(false)
    if (err || !data) {
      setError('Invalid email or password. Make sure your account is active.')
      return
    }
    onLogin(data)
  }

  async function handleRecovery(e) {
    e.preventDefault()
    setRecMsg('')
    const { error: err } = await supabase
      .from('employees')
      .update({ password_hash: recPass.trim() })
      .eq('email', recEmail.trim().toLowerCase())
    if (err) { setRecMsg('Email not found.'); return }
    setRecMsg('Password updated. You can now sign in.')
    setShowRecovery(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-text">⚡ StaffForce</div>
          <div className="login-logo-sub">Workforce Management Platform</div>
        </div>
        {!showRecovery ? (
          <>
            <div className="login-title">Sign in</div>
            <div className="login-sub">Enter your credentials to continue</div>
            {error && <div style={{ marginBottom: 16 }}><Alert type="danger">{error}</Alert></div>}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? <Spinner /> : 'Sign In'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRecovery(true)} style={{ color: 'var(--accent)', fontSize: 13 }}>
                Forgot password?
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="login-title">Reset Password</div>
            <div className="login-sub">Enter your email and a new password</div>
            {recMsg && <div style={{ marginBottom: 12 }}><Alert type={recMsg.includes('updated') ? 'success' : 'danger'}>{recMsg}</Alert></div>}
            <form onSubmit={handleRecovery}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" value={recEmail} onChange={e => setRecEmail(e.target.value)} placeholder="your@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="input" type="password" value={recPass} onChange={e => setRecPass(e.target.value)} placeholder="New password" required />
              </div>
              <button className="btn btn-primary w-full btn-lg" type="submit">Update Password</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRecovery(false)}>← Back to Sign In</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ user }) {
  const [stats, setStats] = useState({ clockedIn: 0, todayShifts: 0, pendingTimeOff: 0, weekHours: 0, totalEmployees: 0, pendingSwaps: 0 })
  const [whoIn, setWhoIn] = useState([])
  const [todayShifts, setTodayShifts] = useState([])
  const [pendingActions, setPendingActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const [{ data: active }, { data: shifts }, { data: timeOff }, { data: entries }, { data: emps }, { data: swaps }] = await Promise.all([
      supabase.from('time_entries').select('*, employee:employees(first_name,last_name,department_id)').is('clock_out', null),
      supabase.from('shifts').select('*, employee:employees(first_name,last_name)').gte('date', today).lte('date', today),
      supabase.from('time_off_requests').select('*').eq('status', 'pending'),
      supabase.from('time_entries').select('*').gte('clock_in', weekStart).lte('clock_in', weekEnd + 'T23:59:59'),
      supabase.from('employees').select('id').eq('status', 'active'),
      supabase.from('shift_swaps').select('*').eq('status', 'pending'),
    ])

    const weekMins = (entries || []).filter(e => e.clock_out).reduce((sum, e) => {
      return sum + differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in))
    }, 0)

    setStats({
      clockedIn: (active || []).length,
      todayShifts: (shifts || []).length,
      pendingTimeOff: (timeOff || []).length,
      weekHours: Math.round(weekMins / 60 * 10) / 10,
      totalEmployees: (emps || []).length,
      pendingSwaps: (swaps || []).length,
    })
    setWhoIn(active || [])
    setTodayShifts(shifts || [])

    const actions = []
    if ((timeOff || []).length) actions.push({ type: 'timeoff', msg: `${(timeOff||[]).length} time off request(s) pending approval`, color: 'warning' })
    if ((swaps || []).length) actions.push({ type: 'swap', msg: `${(swaps||[]).length} shift swap request(s) pending`, color: 'info' })
    setPendingActions(actions)
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div>

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Activity size={18} /></div>
          <div className="stat-label">Clocked In Now</div>
          <div className="stat-value">{stats.clockedIn}</div>
          <div className="stat-sub">employees working</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Calendar size={18} /></div>
          <div className="stat-label">Today's Shifts</div>
          <div className="stat-value">{stats.todayShifts}</div>
          <div className="stat-sub">scheduled today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Umbrella size={18} /></div>
          <div className="stat-label">Pending Time Off</div>
          <div className="stat-value">{stats.pendingTimeOff}</div>
          <div className="stat-sub">awaiting approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={18} /></div>
          <div className="stat-label">Week Hours</div>
          <div className="stat-value">{stats.weekHours}</div>
          <div className="stat-sub">hours logged this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={18} /></div>
          <div className="stat-label">Active Employees</div>
          <div className="stat-value">{stats.totalEmployees}</div>
          <div className="stat-sub">in the system</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Shuffle size={18} /></div>
          <div className="stat-label">Pending Swaps</div>
          <div className="stat-value">{stats.pendingSwaps}</div>
          <div className="stat-sub">shift swap requests</div>
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {pendingActions.map((a, i) => <Alert key={i} type={a.color}>{a.msg}</Alert>)}
        </div>
      )}

      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Who's In Right Now</span>
            <span className="badge badge-success">{whoIn.length} clocked in</span>
          </div>
          <div style={{ padding: '8px 0', maxHeight: 280, overflowY: 'auto' }}>
            {whoIn.length === 0 ? (
              <div className="empty-state"><p>Nobody clocked in yet</p></div>
            ) : whoIn.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                <Avatar emp={e.employee} size="sm" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(e.employee)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Since {format(parseISO(e.clock_in), 'h:mm a')}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="badge badge-success">Working</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Today's Schedule</span>
            <span className="badge badge-blue">{todayShifts.length} shifts</span>
          </div>
          <div style={{ padding: '8px 0', maxHeight: 280, overflowY: 'auto' }}>
            {todayShifts.length === 0 ? (
              <div className="empty-state"><p>No shifts today</p></div>
            ) : todayShifts.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                <Avatar emp={s.employee} size="sm" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(s.employee)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.start_time} – {s.end_time}</div>
                </div>
                {s.role && <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>{s.role}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ClockInOut ────────────────────────────────────────────────────────────────

function ClockInOut({ user }) {
  const [activeEntry, setActiveEntry] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [geoError, setGeoError] = useState('')
  const [locations, setLocations] = useState([])
  const timerRef = useRef(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (activeEntry) {
      timerRef.current = setInterval(() => {
        setElapsed(differenceInMinutes(new Date(), parseISO(activeEntry.clock_in)))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [activeEntry])

  async function load() {
    const empId = user.id
    const today = format(new Date(), 'yyyy-MM-dd')
    const [{ data: open }, { data: todayEntries }, { data: locs }] = await Promise.all([
      supabase.from('time_entries').select('*').eq('employee_id', empId).is('clock_out', null).single(),
      supabase.from('time_entries').select('*').eq('employee_id', empId).gte('clock_in', today).order('clock_in', { ascending: false }),
      supabase.from('locations').select('*').eq('active', true),
    ])
    setActiveEntry(open || null)
    if (open) setElapsed(differenceInMinutes(new Date(), parseISO(open.clock_in)))
    setEntries(todayEntries || [])
    setLocations(locs || [])
    setLoading(false)
  }

  function getPos() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject('Geolocation not supported'); return }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => reject(e.message),
        { timeout: 10000 }
      )
    })
  }

  function checkGeofence(lat, lng) {
    if (!user.geo_exempt && locations.length > 0) {
      const inRange = locations.some(loc => {
        const dlat = lat - loc.latitude
        const dlng = lng - loc.longitude
        const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111000
        return dist <= (loc.radius_meters || 200)
      })
      if (!inRange) return false
    }
    return true
  }

  async function clockIn() {
    setClocking(true)
    setGeoError('')
    try {
      const pos = await getPos()
      if (!checkGeofence(pos.lat, pos.lng)) {
        setGeoError('You are outside the work location. Please be within the geofenced area to clock in.')
        setClocking(false)
        return
      }
      await supabase.from('time_entries').insert({
        employee_id: user.id,
        clock_in: new Date().toISOString(),
        latitude_in: pos.lat,
        longitude_in: pos.lng,
      })
      load()
    } catch (e) {
      setGeoError('Could not get location: ' + e)
    }
    setClocking(false)
  }

  async function clockOut() {
    setClocking(true)
    try {
      const pos = await getPos().catch(() => null)
      await supabase.from('time_entries').update({
        clock_out: new Date().toISOString(),
        latitude_out: pos?.lat,
        longitude_out: pos?.lng,
      }).eq('id', activeEntry.id)
      load()
    } catch (e) { }
    setClocking(false)
  }

  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div>

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
          {activeEntry ? (
            <>
              <div className="clock-timer">{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8, marginBottom: 24 }}>
                Clocked in at {format(parseISO(activeEntry.clock_in), 'h:mm a')}
              </div>
              <button className="btn btn-danger btn-lg" onClick={clockOut} disabled={clocking}>
                {clocking ? <Spinner /> : <><Clock size={16} /> Clock Out</>}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🕐</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>Not clocked in</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>{format(new Date(), 'EEEE, MMMM d')}</div>
              <button className="btn btn-success btn-lg" onClick={clockIn} disabled={clocking}>
                {clocking ? <Spinner /> : <><Clock size={16} /> Clock In</>}
              </button>
            </>
          )}
          {geoError && <div style={{ marginTop: 16 }}><Alert type="danger">{geoError}</Alert></div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Today's Entries</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No entries today</td></tr>
              ) : entries.map(e => {
                const dur = e.clock_out ? differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) : null
                return (
                  <tr key={e.id}>
                    <td className="td-mono">{format(parseISO(e.clock_in), 'h:mm a')}</td>
                    <td className="td-mono">{e.clock_out ? format(parseISO(e.clock_out), 'h:mm a') : '—'}</td>
                    <td>{dur !== null ? fmtHours(dur) : <span className="badge badge-success">Active</span>}</td>
                    <td><span className={`badge ${e.clock_out ? 'badge-neutral' : 'badge-success'}`}>{e.clock_out ? 'Complete' : 'Working'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function Schedule({ user }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editShift, setEditShift] = useState(null)
  const [form, setForm] = useState({ employee_id: '', date: '', start_time: '09:00', end_time: '17:00', role: '', notes: '' })
  const [loading, setLoading] = useState(true)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { load() }, [weekStart])

  async function load() {
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [{ data: emps }, { data: sh }] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, department_id').eq('status', 'active'),
      supabase.from('shifts').select('*').gte('date', from).lte('date', to),
    ])
    setEmployees(emps || [])
    setShifts(sh || [])
    setLoading(false)
  }

  function openAdd(empId, date) {
    setEditShift(null)
    setForm({ employee_id: empId, date: format(date, 'yyyy-MM-dd'), start_time: '09:00', end_time: '17:00', role: '', notes: '' })
    setShowModal(true)
  }

  function openEdit(shift) {
    setEditShift(shift)
    setForm({ employee_id: shift.employee_id, date: shift.date, start_time: shift.start_time, end_time: shift.end_time, role: shift.role || '', notes: shift.notes || '' })
    setShowModal(true)
  }

  async function save() {
    if (editShift) {
      await supabase.from('shifts').update(form).eq('id', editShift.id)
    } else {
      await supabase.from('shifts').insert(form)
    }
    setShowModal(false)
    load()
  }

  async function del(id) {
    await supabase.from('shifts').delete().eq('id', id)
    load()
  }

  function getShifts(empId, date) {
    const d = format(date, 'yyyy-MM-dd')
    return shifts.filter(s => s.employee_id === empId && s.date === d)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={16} /> Prev</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next <ChevronRight size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <div className="schedule-grid" style={{ gridTemplateColumns: '160px repeat(7, 1fr)', minWidth: 900 }}>
          <div className="schedule-header">Employee</div>
          {days.map(d => (
            <div key={d} className="schedule-header" style={{ background: isToday(d) ? 'var(--accent-light)' : undefined, color: isToday(d) ? 'var(--accent)' : undefined }}>
              <div>{format(d, 'EEE')}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{format(d, 'd')}</div>
            </div>
          ))}
          {employees.map(emp => (
            <>
              <div key={`n-${emp.id}`} className="schedule-name">
                <Avatar emp={emp} size="sm" />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{emp.first_name}</span>
              </div>
              {days.map(d => (
                <div key={`${emp.id}-${d}`} className="schedule-cell">
                  {getShifts(emp.id, d).map(s => (
                    <div key={s.id} className="shift-chip" onClick={() => openEdit(s)}>
                      <span>{s.start_time}–{s.end_time}</span>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1 }}
                        onClick={e => { e.stopPropagation(); del(s.id) }}><X size={10} /></button>
                    </div>
                  ))}
                  <button style={{ fontSize: 10, color: 'var(--text4)', background: 'none', border: '1px dashed var(--border2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', width: '100%', marginTop: 2 }}
                    onClick={() => openAdd(emp.id, d)}>+ Add</button>
                </div>
              ))}
            </>
          ))}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editShift ? 'Edit Shift' : 'Add Shift'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group">
          <label className="form-label">Employee</label>
          <select className="select" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">Select...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="input-row">
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input className="input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input className="input" type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Role / Position</label>
          <input className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Cashier, Server..." />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </Modal>
    </div>
  )
}

// ── Timesheets ────────────────────────────────────────────────────────────────

function Timesheets({ user }) {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [filter, setFilter] = useState({ status: 'all', employee_id: '', from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })
  const [loading, setLoading] = useState(true)
  const [editEntry, setEditEntry] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    supabase.from('employees').select('id, first_name, last_name').eq('status', 'active').then(({ data }) => setEmployees(data || []))
  }, [])
  useEffect(() => { load() }, [filter])

  async function load() {
    let q = supabase.from('time_entries').select('*, employee:employees(id, first_name, last_name, hourly_rate, employment_type)').order('clock_in', { ascending: false })
    if (filter.status !== 'all') q = q.eq('status', filter.status)
    if (filter.employee_id) q = q.eq('employee_id', filter.employee_id)
    if (filter.from) q = q.gte('clock_in', filter.from)
    if (filter.to) q = q.lte('clock_in', filter.to + 'T23:59:59')
    const { data } = await q
    setEntries(data || [])
    setLoading(false)
  }

  async function approve(id) {
    await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id)
    load()
  }
  async function reject(id) {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id)
    load()
  }
  async function approveAll() {
    const ids = entries.filter(e => !e.status || e.status === 'pending').map(e => e.id)
    for (const id of ids) await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id)
    load()
  }

  function exportCSV() {
    const rows = [['Employee', 'Clock In', 'Clock Out', 'Hours', 'Status']]
    entries.forEach(e => {
      const dur = e.clock_out ? Math.round(differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) / 60 * 100) / 100 : ''
      rows.push([fullName(e.employee), e.clock_in, e.clock_out || '', dur, e.status || 'pending'])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'timesheets.csv'; a.click()
  }

  async function saveEdit() {
    await supabase.from('time_entries').update({ clock_in: editForm.clock_in, clock_out: editForm.clock_out, notes: editForm.notes }).eq('id', editEntry.id)
    setEditEntry(null)
    load()
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Employee</label>
            <select className="select" style={{ width: 180 }} value={filter.employee_id} onChange={e => setFilter({ ...filter, employee_id: e.target.value })}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="select" style={{ width: 140 }} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input className="input" type="date" style={{ width: 150 }} value={filter.from} onChange={e => setFilter({ ...filter, from: e.target.value })} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="input" type="date" style={{ width: 150 }} value={filter.to} onChange={e => setFilter({ ...filter, to: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {user.role !== 'employee' && <button className="btn btn-success btn-sm" onClick={approveAll}><CheckCircle size={14} /> Approve All</button>}
            <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> CSV</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  {user.role !== 'employee' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No entries found</td></tr>
                  : entries.map(e => {
                    const mins = e.clock_out ? differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) : null
                    const hours = mins !== null ? mins / 60 : null
                    const isOT = hours !== null && hours > 8
                    return (
                      <tr key={e.id} style={isOT ? { background: '#fffbeb' } : {}}>
                        <td className="td-bold">{fullName(e.employee)}</td>
                        <td className="td-mono">{format(parseISO(e.clock_in), 'MM/dd h:mm a')}</td>
                        <td className="td-mono">{e.clock_out ? format(parseISO(e.clock_out), 'MM/dd h:mm a') : <span className="badge badge-success">Active</span>}</td>
                        <td className="td-mono" style={isOT ? { color: 'var(--warning)', fontWeight: 600 } : {}}>
                          {hours !== null ? `${hours.toFixed(2)}h` : '—'}{isOT && ' ⚡ OT'}
                        </td>
                        <td><span className={`badge badge-${(e.status === 'approved') ? 'success' : (e.status === 'rejected') ? 'danger' : 'warning'}`}>{e.status || 'pending'}</span></td>
                        {user.role !== 'employee' && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditEntry(e); setEditForm({ clock_in: e.clock_in, clock_out: e.clock_out || '', notes: e.notes || '' }) }}><Edit2 size={12} /></button>
                              {(!e.status || e.status === 'pending') && <>
                                <button className="btn btn-success btn-sm" onClick={() => approve(e.id)}><Check size={12} /></button>
                                <button className="btn btn-danger btn-sm" onClick={() => reject(e.id)}><X size={12} /></button>
                              </>}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit Time Entry"
        footer={<><button className="btn btn-secondary" onClick={() => setEditEntry(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit}>Save</button></>}>
        <div className="form-group">
          <label className="form-label">Clock In</label>
          <input className="input" type="datetime-local" value={editForm.clock_in?.slice(0, 16) || ''} onChange={e => setEditForm({ ...editForm, clock_in: e.target.value + ':00Z' })} />
        </div>
        <div className="form-group">
          <label className="form-label">Clock Out</label>
          <input className="input" type="datetime-local" value={editForm.clock_out?.slice(0, 16) || ''} onChange={e => setEditForm({ ...editForm, clock_out: e.target.value + ':00Z' })} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="textarea" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}

// ── Time Off ──────────────────────────────────────────────────────────────────

function TimeOffView({ user }) {
  const [requests, setRequests] = useState([])
  const [myBalance, setMyBalance] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: 'pto', start_date: '', end_date: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('requests')

  useEffect(() => { load() }, [])

  async function load() {
    const isAdmin = user.role !== 'employee'
    let q = supabase.from('time_off_requests').select('*, employee:employees(first_name, last_name, pto_balance)').order('created_at', { ascending: false })
    if (!isAdmin) q = q.eq('employee_id', user.id)
    const { data } = await q
    setRequests(data || [])
    const me = (data || []).find(r => r.employee_id === user.id)
    setMyBalance(me?.employee?.pto_balance || user.pto_balance || 0)
    setLoading(false)
  }

  async function submit() {
    const days = differenceInDays(parseISO(form.end_date), parseISO(form.start_date)) + 1
    await supabase.from('time_off_requests').insert({ ...form, employee_id: user.id, days, status: 'pending' })
    setShowModal(false)
    load()
  }

  async function approve(r) {
    await supabase.from('time_off_requests').update({ status: 'approved' }).eq('id', r.id)
    if (r.type === 'pto') {
      await supabase.from('employees').update({ pto_balance: Math.max(0, (r.employee?.pto_balance || 0) - (r.days || 0)) }).eq('id', r.employee_id)
    }
    load()
  }

  async function deny(id) {
    await supabase.from('time_off_requests').update({ status: 'denied' }).eq('id', id)
    load()
  }

  const types = ['pto', 'sick', 'personal', 'unpaid', 'fmla', 'bereavement']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="stat-card" style={{ minWidth: 200, display: 'inline-flex', flexDirection: 'column' }}>
          <div className="stat-label">PTO Balance</div>
          <div className="stat-value">{myBalance}</div>
          <div className="stat-sub">days available</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Request Time Off</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{user.role !== 'employee' ? 'All Requests' : 'My Requests'}</span>
        </div>
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead>
                <tr>
                  {user.role !== 'employee' && <th>Employee</th>}
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {user.role !== 'employee' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No requests</td></tr>
                  : requests.map(r => (
                    <tr key={r.id}>
                      {user.role !== 'employee' && <td className="td-bold">{fullName(r.employee)}</td>}
                      <td><span className="badge badge-blue">{r.type?.toUpperCase()}</span></td>
                      <td className="td-mono">{r.start_date} to {r.end_date}</td>
                      <td>{r.days}</td>
                      <td className="td-muted">{r.reason || '—'}</td>
                      <td><span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'denied' ? 'danger' : 'warning'}`}>{r.status}</span></td>
                      {user.role !== 'employee' && r.status === 'pending' && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => approve(r)}><Check size={12} /> Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deny(r.id)}><X size={12} /> Deny</button>
                          </div>
                        </td>
                      )}
                      {user.role !== 'employee' && r.status !== 'pending' && <td></td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Time Off"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={submit}>Submit</button></>}>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {types.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="input-row">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input className="input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reason (optional)</label>
          <textarea className="textarea" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} />
        </div>
      </Modal>
    </div>
  )
}

// ── Availability ──────────────────────────────────────────────────────────────

function AvailabilityView({ user }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const [avail, setAvail] = useState({})
  const [employees, setEmployees] = useState([])
  const [selEmp, setSelEmp] = useState(user.id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user.role !== 'employee') {
      supabase.from('employees').select('id, first_name, last_name').eq('status', 'active').then(({ data }) => setEmployees(data || []))
    }
    load(selEmp)
  }, [])

  async function load(empId) {
    const { data } = await supabase.from('availability').select('*').eq('employee_id', empId)
    const map = {}
    for (const row of (data || [])) {
      map[row.day_of_week] = { available: row.available, start_time: row.start_time || '09:00', end_time: row.end_time || '17:00' }
    }
    const full = {}
    DAYS.forEach((d, i) => { full[i] = map[i] || { available: false, start_time: '09:00', end_time: '17:00' } })
    setAvail(full)
  }

  async function save() {
    setSaving(true)
    for (const [day, val] of Object.entries(avail)) {
      await supabase.from('availability').upsert({ employee_id: selEmp, day_of_week: parseInt(day), available: val.available, start_time: val.start_time, end_time: val.end_time }, { onConflict: 'employee_id,day_of_week' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      {user.role !== 'employee' && (
        <div style={{ marginBottom: 20 }}>
          <select className="select" style={{ width: 240 }} value={selEmp} onChange={e => { setSelEmp(e.target.value); load(e.target.value) }}>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Weekly Availability</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span className="badge badge-success">Saved!</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner /> : <><Save size={14} /> Save</>}</button>
          </div>
        </div>
        <div className="card-body">
          {DAYS.map((day, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 120, fontWeight: 500, fontSize: 13 }}>{day}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={avail[i]?.available || false} onChange={e => setAvail({ ...avail, [i]: { ...avail[i], available: e.target.checked } })} />
                <span style={{ fontSize: 13, color: avail[i]?.available ? 'var(--success)' : 'var(--text4)' }}>{avail[i]?.available ? 'Available' : 'Unavailable'}</span>
              </label>
              {avail[i]?.available && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input className="input" type="time" style={{ width: 120 }} value={avail[i]?.start_time || '09:00'} onChange={e => setAvail({ ...avail, [i]: { ...avail[i], start_time: e.target.value } })} />
                  <span style={{ color: 'var(--text3)' }}>to</span>
                  <input className="input" type="time" style={{ width: 120 }} value={avail[i]?.end_time || '17:00'} onChange={e => setAvail({ ...avail, [i]: { ...avail[i], end_time: e.target.value } })} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shift Swap ────────────────────────────────────────────────────────────────

function ShiftSwapView({ user }) {
  const [swaps, setSwaps] = useState([])
  const [employees, setEmployees] = useState([])
  const [myShifts, setMyShifts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ shift_id: '', target_employee_id: '', reason: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: sw }, { data: emps }, { data: sh }] = await Promise.all([
      supabase.from('shift_swaps').select('*, requester:employees!shift_swaps_requester_id_fkey(first_name,last_name), target:employees!shift_swaps_target_employee_id_fkey(first_name,last_name), shift:shifts(date,start_time,end_time)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name').eq('status', 'active').neq('id', user.id),
      supabase.from('shifts').select('*').eq('employee_id', user.id).gte('date', format(new Date(), 'yyyy-MM-dd')),
    ])
    setSwaps(sw || [])
    setEmployees(emps || [])
    setMyShifts(sh || [])
    setLoading(false)
  }

  async function submit() {
    await supabase.from('shift_swaps').insert({ ...form, requester_id: user.id, status: 'pending' })
    setShowModal(false)
    load()
  }

  async function approve(id) { await supabase.from('shift_swaps').update({ status: 'approved' }).eq('id', id); load() }
  async function deny(id) { await supabase.from('shift_swaps').update({ status: 'denied' }).eq('id', id); load() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Request Swap</button>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Shift Swap Requests</span></div>
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead>
                <tr><th>Requester</th><th>Shift</th><th>Swap With</th><th>Reason</th><th>Status</th>{user.role !== 'employee' && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {swaps.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No swap requests</td></tr>
                  : swaps.map(s => (
                    <tr key={s.id}>
                      <td className="td-bold">{fullName(s.requester)}</td>
                      <td className="td-mono">{s.shift?.date} {s.shift?.start_time}–{s.shift?.end_time}</td>
                      <td>{fullName(s.target) || 'Open'}</td>
                      <td className="td-muted">{s.reason || '—'}</td>
                      <td><span className={`badge badge-${s.status === 'approved' ? 'success' : s.status === 'denied' ? 'danger' : 'warning'}`}>{s.status}</span></td>
                      {user.role !== 'employee' && s.status === 'pending' && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => approve(s.id)}><Check size={12} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => deny(s.id)}><X size={12} /></button>
                          </div>
                        </td>
                      )}
                      {user.role !== 'employee' && s.status !== 'pending' && <td></td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Shift Swap"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={submit}>Submit</button></>}>
        <div className="form-group">
          <label className="form-label">My Shift</label>
          <select className="select" value={form.shift_id} onChange={e => setForm({ ...form, shift_id: e.target.value })}>
            <option value="">Select shift...</option>
            {myShifts.map(s => <option key={s.id} value={s.id}>{s.date} {s.start_time}–{s.end_time}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Swap With (optional — leave blank for open swap)</label>
          <select className="select" value={form.target_employee_id} onChange={e => setForm({ ...form, target_employee_id: e.target.value })}>
            <option value="">Open swap</option>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <textarea className="textarea" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
        </div>
      </Modal>
    </div>
  )
}

// ── Employees ─────────────────────────────────────────────────────────────────

function EmployeesView({ user }) {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selEmp, setSelEmp] = useState(null)
  const [tab, setTab] = useState('personal')
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('employees').select('*, department:departments(name)').order('last_name'),
      supabase.from('departments').select('*'),
    ])
    setEmployees(emps || [])
    setDepartments(depts || [])
    setLoading(false)
  }

  function openEmp(emp) {
    setSelEmp(emp)
    setForm({ ...emp })
    setTab('personal')
    setShowModal(true)
  }

  function openNew() {
    setSelEmp(null)
    setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'employee', employment_type: 'hourly', hourly_rate: '', salary_annual: '', department_id: '', status: 'active', pto_balance: 15, pto_accrual_rate: 0, geo_exempt: false, hire_date: format(new Date(), 'yyyy-MM-dd'), password_hash: '', bank_routing: '', bank_account: '', bank_type: 'checking', notes: '', language: 'en' })
    setTab('personal')
    setShowModal(true)
  }

  async function save() {
    const data = { ...form }
    if (selEmp) {
      await supabase.from('employees').update(data).eq('id', selEmp.id)
    } else {
      await supabase.from('employees').insert(data)
    }
    setShowModal(false)
    load()
  }

  async function deactivate(id) {
    await supabase.from('employees').update({ status: 'inactive' }).eq('id', id)
    setConfirm(null)
    load()
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return !q || fullName(e).toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.role?.toLowerCase().includes(q)
  })

  const ROLES = ['admin', 'manager', 'supervisor', 'employee']
  const EMP_TYPES = ['hourly', 'salary', 'part_time', 'contractor']

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text4)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {user.role !== 'employee' && <button className="btn btn-primary" onClick={openNew} style={{ marginLeft: 'auto' }}><Plus size={14} /> Add Employee</button>}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead>
                <tr><th>Employee</th><th>Role</th><th>Department</th><th>Type</th><th>Pay</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No employees found</td></tr>
                  : filtered.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar emp={e} />
                          <div>
                            <div className="td-bold">{fullName(e)}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{e.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-blue">{e.role}</span></td>
                      <td className="td-muted">{e.department?.name || '—'}</td>
                      <td className="td-muted">{e.employment_type}</td>
                      <td className="td-mono">{e.employment_type === 'salary' ? fmtMoney(e.salary_annual) + '/yr' : '$' + (e.hourly_rate || 0) + '/hr'}</td>
                      <td><span className={`badge badge-${e.status === 'active' ? 'success' : 'danger'}`}>{e.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEmp(e)}><Edit2 size={12} /></button>
                          {user.role !== 'employee' && e.status === 'active' && <button className="btn btn-danger btn-sm" onClick={() => setConfirm(e.id)}><UserCheck size={12} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={selEmp ? `${fullName(selEmp)}` : 'New Employee'} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="tabs">
          {['personal', 'role', 'payroll', 'bank', 'notes'].map(t => (
            <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
          ))}
        </div>
        {tab === 'personal' && (
          <div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">First Name</label><input className="input" value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Last Name</label><input className="input" value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Email</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Hire Date</label><input className="input" type="date" value={form.hire_date || ''} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Language</label>
                <select className="select" value={form.language || 'en'} onChange={e => setForm({ ...form, language: e.target.value })}>
                  <option value="en">English</option><option value="es">Spanish</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Password</label><input className="input" type="password" value={form.password_hash || ''} onChange={e => setForm({ ...form, password_hash: e.target.value })} placeholder="Set login password" /></div>
          </div>
        )}
        {tab === 'role' && (
          <div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Role</label>
                <select className="select" value={form.role || 'employee'} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Department</label>
                <select className="select" value={form.department_id || ''} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">None</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Status</label>
                <select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Geo Exempt</label>
                <select className="select" value={form.geo_exempt ? 'yes' : 'no'} onChange={e => setForm({ ...form, geo_exempt: e.target.value === 'yes' })}>
                  <option value="no">No (must be in geofence)</option><option value="yes">Yes (exempt)</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {tab === 'payroll' && (
          <div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Employment Type</label>
                <select className="select" value={form.employment_type || 'hourly'} onChange={e => setForm({ ...form, employment_type: e.target.value })}>
                  {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Hourly Rate ($)</label><input className="input" type="number" step="0.01" value={form.hourly_rate || ''} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} /></div>
            </div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Salary Annual ($)</label><input className="input" type="number" value={form.salary_annual || ''} onChange={e => setForm({ ...form, salary_annual: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">PTO Balance (days)</label><input className="input" type="number" value={form.pto_balance || ''} onChange={e => setForm({ ...form, pto_balance: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">PTO Accrual Rate (days/year)</label><input className="input" type="number" value={form.pto_accrual_rate || ''} onChange={e => setForm({ ...form, pto_accrual_rate: e.target.value })} /></div>
          </div>
        )}
        {tab === 'bank' && (
          <div>
            <div className="form-group"><label className="form-label">Bank Routing Number</label><input className="input" value={form.bank_routing || ''} onChange={e => setForm({ ...form, bank_routing: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Bank Account Number</label><input className="input" value={form.bank_account || ''} onChange={e => setForm({ ...form, bank_account: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Account Type</label>
              <select className="select" value={form.bank_type || 'checking'} onChange={e => setForm({ ...form, bank_type: e.target.value })}>
                <option value="checking">Checking</option><option value="savings">Savings</option>
              </select>
            </div>
          </div>
        )}
        {tab === 'notes' && (
          <div>
            <div className="form-group"><label className="form-label">Internal Notes</label><textarea className="textarea" rows={6} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <Confirm open={!!confirm} message="Deactivate this employee?" onConfirm={() => deactivate(confirm)} onCancel={() => setConfirm(null)} />
    </div>
  )
}

// ── Hiring ────────────────────────────────────────────────────────────────────

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired']

function HiringView({ user }) {
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [tab, setTab] = useState('pipeline')
  const [showCandModal, setShowCandModal] = useState(false)
  const [showJobModal, setShowJobModal] = useState(false)
  const [selCand, setSelCand] = useState(null)
  const [candForm, setCandForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_id: '', stage: 'Applied', rating: 0, notes: '' })
  const [jobForm, setJobForm] = useState({ title: '', department: '', employment_type: 'full_time', location: '', salary_range: '', description: '', status: 'open' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: j }] = await Promise.all([
      supabase.from('candidates').select('*, job:job_postings(title)').order('created_at', { ascending: false }),
      supabase.from('job_postings').select('*').order('created_at', { ascending: false }),
    ])
    setCandidates(c || [])
    setJobs(j || [])
    setLoading(false)
  }

  async function saveCandidate() {
    if (selCand) { await supabase.from('candidates').update(candForm).eq('id', selCand.id) }
    else { await supabase.from('candidates').insert(candForm) }
    setShowCandModal(false)
    load()
  }

  async function saveJob() {
    await supabase.from('job_postings').insert(jobForm)
    setShowJobModal(false)
    load()
  }

  async function moveStage(cId, stage) {
    await supabase.from('candidates').update({ stage }).eq('id', cId)
    setCandidates(prev => prev.map(c => c.id === cId ? { ...c, stage } : c))
  }

  async function convertToEmployee(cand) {
    await supabase.from('employees').insert({
      first_name: cand.first_name, last_name: cand.last_name,
      email: cand.email, phone: cand.phone,
      role: 'employee', status: 'active', employment_type: 'hourly',
      hourly_rate: 0, salary_annual: 0, pto_balance: 0, pto_accrual_rate: 0,
      hire_date: format(new Date(), 'yyyy-MM-dd'), language: 'en'
    })
    await supabase.from('candidates').update({ stage: 'Hired' }).eq('id', cand.id)
    load()
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div>

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>Pipeline</div>
        <div className={`tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>Job Postings</div>
      </div>

      {tab === 'pipeline' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setSelCand(null); setCandForm({ first_name: '', last_name: '', email: '', phone: '', job_id: '', stage: 'Applied', rating: 0, notes: '' }); setShowCandModal(true) }}><Plus size={14} /> Add Candidate</button>
          </div>
          <div className="kanban-board">
            {STAGES.map(stage => {
              const stageCands = candidates.filter(c => c.stage === stage)
              return (
                <div key={stage} className="kanban-col">
                  <div className="kanban-col-header">
                    <span>{stage}</span>
                    <span className="badge badge-neutral">{stageCands.length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {stageCands.map(c => (
                      <div key={c.id} className="kanban-card" onClick={() => { setSelCand(c); setCandForm({ ...c }); setShowCandModal(true) }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName(c)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{c.job?.title || '—'}</div>
                        {c.email && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{c.email}</div>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {STAGES.filter(s => s !== stage).slice(0, 3).map(s => (
                            <button key={s} className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                              onClick={e => { e.stopPropagation(); moveStage(c.id, s) }}>{s} →</button>
                          ))}
                          {stage === 'Offer' && <button className="btn btn-success btn-sm" style={{ fontSize: 10 }} onClick={e => { e.stopPropagation(); convertToEmployee(c) }}>Hire ✓</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setJobForm({ title: '', department: '', employment_type: 'full_time', location: '', salary_range: '', description: '', status: 'open' }); setShowJobModal(true) }}><Plus size={14} /> Post Job</button>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Type</th><th>Location</th><th>Salary</th><th>Status</th><th>Candidates</th></tr></thead>
                <tbody>
                  {jobs.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No job postings</td></tr>
                    : jobs.map(j => (
                      <tr key={j.id}>
                        <td className="td-bold">{j.title}</td>
                        <td className="td-muted">{j.employment_type}</td>
                        <td className="td-muted">{j.location || '—'}</td>
                        <td className="td-mono">{j.salary_range || '—'}</td>
                        <td><span className={`badge badge-${j.status === 'open' ? 'success' : 'neutral'}`}>{j.status}</span></td>
                        <td>{candidates.filter(c => c.job_id === j.id).length}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={showCandModal} onClose={() => setShowCandModal(false)} title={selCand ? 'Edit Candidate' : 'Add Candidate'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowCandModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveCandidate}>Save</button></>}>
        <div className="input-row">
          <div className="form-group"><label className="form-label">First Name</label><input className="input" value={candForm.first_name} onChange={e => setCandForm({ ...candForm, first_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Last Name</label><input className="input" value={candForm.last_name} onChange={e => setCandForm({ ...candForm, last_name: e.target.value })} /></div>
        </div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Email</label><input className="input" type="email" value={candForm.email} onChange={e => setCandForm({ ...candForm, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="input" value={candForm.phone} onChange={e => setCandForm({ ...candForm, phone: e.target.value })} /></div>
        </div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Job</label>
            <select className="select" value={candForm.job_id} onChange={e => setCandForm({ ...candForm, job_id: e.target.value })}>
              <option value="">None</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Stage</label>
            <select className="select" value={candForm.stage} onChange={e => setCandForm({ ...candForm, stage: e.target.value })}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="textarea" value={candForm.notes} onChange={e => setCandForm({ ...candForm, notes: e.target.value })} rows={3} /></div>
      </Modal>

      <Modal open={showJobModal} onClose={() => setShowJobModal(false)} title="Post Job Opening"
        footer={<><button className="btn btn-secondary" onClick={() => setShowJobModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveJob}>Post</button></>}>
        <div className="form-group"><label className="form-label">Job Title</label><input className="input" value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} /></div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Department</label><input className="input" value={jobForm.department} onChange={e => setJobForm({ ...jobForm, department: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Type</label>
            <select className="select" value={jobForm.employment_type} onChange={e => setJobForm({ ...jobForm, employment_type: e.target.value })}>
              <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option>
            </select>
          </div>
        </div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Location</label><input className="input" value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Salary Range</label><input className="input" value={jobForm.salary_range} onChange={e => setJobForm({ ...jobForm, salary_range: e.target.value })} placeholder="e.g. $50k–$65k" /></div>
        </div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="textarea" rows={4} value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} /></div>
      </Modal>
    </div>
  )
}

// ── Messaging ─────────────────────────────────────────────────────────────────

function MessagingView({ user }) {
  const [contacts, setContacts] = useState([])
  const [selContact, setSelContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => { loadContacts() }, [])
  useEffect(() => { if (selContact) loadMessages(selContact.id) }, [selContact])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContacts() {
    const { data } = await supabase.from('employees').select('id, first_name, last_name').eq('status', 'active').neq('id', user.id)
    setContacts(data || [])
    setLoading(false)
  }

  async function loadMessages(otherId) {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at')
    setMessages(data || [])
  }

  async function send() {
    if (!newMsg.trim() || !selContact) return
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: selContact.id, body: newMsg.trim() })
    setNewMsg('')
    loadMessages(selContact.id)
  }

  return (
    <div style={{ height: 'calc(100vh - 130px)' }}>
      <div className="msg-layout" style={{ height: '100%' }}>
        <div className="msg-sidebar">
          <div className="msg-sidebar-header">Messages</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>
              : contacts.map(c => (
                <div key={c.id} className={`msg-contact ${selContact?.id === c.id ? 'active' : ''}`} onClick={() => setSelContact(c)}>
                  <Avatar emp={c} size="sm" />
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(c)}</div>
                </div>
              ))}
          </div>
        </div>
        <div className="msg-main">
          {!selContact ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <MessageSquare size={40} />
              <p>Select a contact to start messaging</p>
            </div>
          ) : (
            <>
              <div className="msg-header">{fullName(selContact)}</div>
              <div className="msg-body">
                {messages.map(m => (
                  <div key={m.id} className={`msg-bubble ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
                    <div>{m.body}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{format(parseISO(m.created_at), 'h:mm a')}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="msg-input-row">
                <input className="input" style={{ flex: 1 }} value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === 'Enter' && send()} />
                <button className="btn btn-primary" onClick={send}><Send size={14} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Payroll ───────────────────────────────────────────────────────────────────

function PayrollView({ user }) {
  const [periods, setPeriods] = useState([])
  const [entries, setEntries] = useState([])
  const [activePeriod, setActivePeriod] = useState(null)
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [showPaystub, setShowPaystub] = useState(null)
  const [pForm, setPForm] = useState({ start_date: '', end_date: '', pay_date: '' })
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: perList } = await supabase.from('payroll_periods').select('*').order('created_at', { ascending: false })
    setPeriods(perList || [])
    if (perList && perList[0]) {
      setActivePeriod(perList[0])
      loadEntries(perList[0].id)
    } else { setLoading(false) }
  }

  async function loadEntries(periodId) {
    const { data } = await supabase.from('payroll_entries').select('*, employee:employees(first_name,last_name,hourly_rate,salary_annual,employment_type,bank_routing,bank_account)').eq('payroll_period_id', periodId)
    setEntries(data || [])
    setLoading(false)
  }

  async function createPeriod() {
    const { data } = await supabase.from('payroll_periods').insert({ ...pForm, status: 'draft' }).select().single()
    setShowPeriodModal(false)
    load()
  }

  async function runPayroll() {
    if (!activePeriod) return
    setProcessing(true)
    const { data: emps } = await supabase.from('employees').select('*').eq('status', 'active')
    const { data: timeEntries } = await supabase.from('time_entries').select('*').eq('status', 'approved').gte('clock_in', activePeriod.start_date).lte('clock_in', activePeriod.end_date + 'T23:59:59')

    for (const emp of (emps || [])) {
      const empEntries = (timeEntries || []).filter(e => e.employee_id === emp.id)
      const calc = calcPayroll(empEntries, emp)
      await supabase.from('payroll_entries').upsert({
        payroll_period_id: activePeriod.id,
        employee_id: emp.id,
        regular_hours: calc.regularHours,
        ot_hours: calc.otHours,
        regular_pay: calc.regularPay,
        ot_pay: calc.otPay,
        gross_pay: calc.gross,
        fica: calc.fica,
        fed_tax: calc.fedTax,
        state_tax: calc.stateTax,
        net_pay: calc.net,
        status: 'calculated',
        first_name: emp.first_name,
        last_name: emp.last_name,
        bank_routing: emp.bank_routing,
        bank_account: emp.bank_account,
      }, { onConflict: 'payroll_period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({ status: 'calculated' }).eq('id', activePeriod.id)
    setProcessing(false)
    load()
  }

  async function approvePeriod() {
    await supabase.from('payroll_periods').update({ status: 'paid' }).eq('id', activePeriod.id)
    load()
  }

  function exportNACHA() {
    const ach = generateNACHA(entries, 'StaffForce Company', '021000021', '1234567890', activePeriod?.pay_date || format(new Date(), 'yyyy-MM-dd'))
    const a = document.createElement('a'); a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(ach); a.download = `payroll_${activePeriod?.pay_date}.ach`; a.click()
  }

  function exportCSV() {
    const rows = [['Employee', 'Regular Hrs', 'OT Hrs', 'Regular Pay', 'OT Pay', 'Gross', 'FICA', 'Fed Tax', 'State Tax', 'Net']]
    entries.forEach(e => {
      rows.push([fullName(e.employee), e.regular_hours, e.ot_hours, e.regular_pay, e.ot_pay, e.gross_pay, e.fica, e.fed_tax, e.state_tax, e.net_pay])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'payroll.csv'; a.click()
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="select" style={{ width: 280 }} value={activePeriod?.id || ''} onChange={e => {
          const p = periods.find(x => x.id === e.target.value)
          setActivePeriod(p)
          if (p) loadEntries(p.id)
        }}>
          {periods.length === 0 && <option value="">No periods</option>}
          {periods.map(p => <option key={p.id} value={p.id}>{p.start_date} to {p.end_date} — {p.status}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => setShowPeriodModal(true)}><Plus size={14} /> New Period</button>
        {activePeriod && activePeriod.status !== 'paid' && (
          <button className="btn btn-primary" onClick={runPayroll} disabled={processing}>{processing ? <Spinner /> : <><Zap size={14} /> Run Payroll</>}</button>
        )}
        {activePeriod?.status === 'calculated' && (
          <button className="btn btn-success" onClick={approvePeriod}><CheckCircle size={14} /> Approve & Mark Paid</button>
        )}
        {entries.length > 0 && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={exportNACHA}><Download size={14} /> NACHA</button>
            <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> CSV</button>
          </>
        )}
        {activePeriod && <span className={`badge badge-${activePeriod.status === 'paid' ? 'success' : activePeriod.status === 'calculated' ? 'warning' : 'neutral'}`}>{activePeriod.status}</span>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Employee</th><th>Reg Hrs</th><th>OT Hrs</th><th>Reg Pay</th><th>OT Pay</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No payroll entries. Run payroll to calculate.</td></tr>
                : entries.map(e => (
                  <tr key={e.id}>
                    <td className="td-bold">{fullName(e.employee)}</td>
                    <td className="td-mono">{(e.regular_hours || 0).toFixed(1)}</td>
                    <td className="td-mono" style={e.ot_hours > 0 ? { color: 'var(--warning)', fontWeight: 600 } : {}}>{(e.ot_hours || 0).toFixed(1)}</td>
                    <td className="td-mono">{fmtMoney(e.regular_pay)}</td>
                    <td className="td-mono">{fmtMoney(e.ot_pay)}</td>
                    <td className="td-mono" style={{ fontWeight: 600 }}>{fmtMoney(e.gross_pay)}</td>
                    <td className="td-mono">{fmtMoney((e.fica || 0) + (e.fed_tax || 0) + (e.state_tax || 0))}</td>
                    <td className="td-mono" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtMoney(e.net_pay)}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setShowPaystub(e)}><Eye size={12} /></button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showPeriodModal} onClose={() => setShowPeriodModal(false)} title="New Payroll Period"
        footer={<><button className="btn btn-secondary" onClick={() => setShowPeriodModal(false)}>Cancel</button><button className="btn btn-primary" onClick={createPeriod}>Create</button></>}>
        <div className="input-row-3">
          <div className="form-group"><label className="form-label">Start Date</label><input className="input" type="date" value={pForm.start_date} onChange={e => setPForm({ ...pForm, start_date: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input className="input" type="date" value={pForm.end_date} onChange={e => setPForm({ ...pForm, end_date: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Pay Date</label><input className="input" type="date" value={pForm.pay_date} onChange={e => setPForm({ ...pForm, pay_date: e.target.value })} /></div>
        </div>
      </Modal>

      {showPaystub && (
        <div className="modal-overlay" onClick={() => setShowPaystub(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} id="paystub-print">
            <div className="modal-header">
              <span className="modal-title">Pay Stub — {fullName(showPaystub.employee)}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPaystub(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>EMPLOYEE</div>
                  <div style={{ fontWeight: 600 }}>{fullName(showPaystub.employee)}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 16, marginBottom: 4 }}>PAY PERIOD</div>
                  <div>{activePeriod?.start_date} to {activePeriod?.end_date}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>PAY DATE</div>
                  <div style={{ fontWeight: 600 }}>{activePeriod?.pay_date}</div>
                </div>
              </div>
              <hr className="divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  ['Regular Hours', showPaystub.regular_hours?.toFixed(2)],
                  ['OT Hours', showPaystub.ot_hours?.toFixed(2)],
                  ['Regular Pay', fmtMoney(showPaystub.regular_pay)],
                  ['OT Pay', fmtMoney(showPaystub.ot_pay)],
                  ['Gross Pay', fmtMoney(showPaystub.gross_pay)],
                  ['FICA (7.65%)', fmtMoney(showPaystub.fica)],
                  ['Federal Tax', fmtMoney(showPaystub.fed_tax)],
                  ['State Tax', fmtMoney(showPaystub.state_tax)],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '2px solid var(--border)', marginTop: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Net Pay</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(showPaystub.net_pay)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reports ───────────────────────────────────────────────────────────────────

function ReportsView({ user }) {
  const [range, setRange] = useState('week')
  const [hourData, setHourData] = useState([])
  const [costData, setCostData] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hours')

  useEffect(() => { load() }, [range])

  async function load() {
    let from
    const now = new Date()
    if (range === 'week') from = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    else if (range === 'month') from = format(startOfMonth(now), 'yyyy-MM-dd')
    else from = format(subMonths(startOfMonth(now), 3), 'yyyy-MM-dd')

    const [{ data: entries }, { data: emps }] = await Promise.all([
      supabase.from('time_entries').select('*, employee:employees(id, first_name, last_name, hourly_rate, employment_type, salary_annual, department_id, department:departments(name))').gte('clock_in', from).not('clock_out', 'is', null),
      supabase.from('employees').select('id, first_name, last_name').eq('status', 'active'),
    ])

    // Hours by employee
    const byEmp = {}
    for (const e of (entries || [])) {
      const id = e.employee_id
      const mins = differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in))
      if (!byEmp[id]) byEmp[id] = { name: fullName(e.employee), hours: 0, cost: 0 }
      byEmp[id].hours += mins / 60
      const rate = parseFloat(e.employee?.hourly_rate) || (parseFloat(e.employee?.salary_annual) || 0) / 2080
      byEmp[id].cost += (mins / 60) * rate
    }
    const hd = Object.values(byEmp).sort((a, b) => b.hours - a.hours).slice(0, 10)
    setHourData(hd)

    // Labor cost by department
    const byDept = {}
    for (const e of (entries || [])) {
      const dept = e.employee?.department?.name || 'Unassigned'
      const mins = differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in))
      const rate = parseFloat(e.employee?.hourly_rate) || (parseFloat(e.employee?.salary_annual) || 0) / 2080
      if (!byDept[dept]) byDept[dept] = { name: dept, cost: 0 }
      byDept[dept].cost += (mins / 60) * rate
    }
    setCostData(Object.values(byDept))

    // Attendance summary
    const att = (emps || []).map(emp => {
      const empEntries = (entries || []).filter(e => e.employee_id === emp.id)
      const totalMins = empEntries.reduce((sum, e) => sum + differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in)), 0)
      return { name: fullName(emp), shifts: empEntries.length, hours: (totalMins / 60).toFixed(1) }
    })
    setAttendance(att)
    setLoading(false)
  }

  function BarChart({ data, valueKey, labelKey, color, fmt }) {
    if (!data.length) return <div className="empty-state"><p>No data</p></div>
    const max = Math.max(...data.map(d => d[valueKey]))
    return (
      <div className="bar-chart">
        {data.map((d, i) => (
          <div key={i} className="bar-item">
            <div className="bar-val">{fmt ? fmt(d[valueKey]) : d[valueKey].toFixed(1)}</div>
            <div className="bar" style={{ height: max > 0 ? `${(d[valueKey] / max) * 140}px` : '4px', background: color || 'var(--accent)' }} />
            <div className="bar-label" style={{ width: 60, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d[labelKey]}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <div className={`tab ${tab === 'hours' ? 'active' : ''}`} onClick={() => setTab('hours')}>Hours</div>
          <div className={`tab ${tab === 'cost' ? 'active' : ''}`} onClick={() => setTab('cost')}>Labor Cost</div>
          <div className={`tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Attendance</div>
        </div>
        <select className="select" style={{ width: 160, marginLeft: 'auto' }} value={range} onChange={e => setRange(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">Last 3 Months</option>
        </select>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div> : (
        <>
          {tab === 'hours' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Hours by Employee</span></div>
              <div className="card-body chart-wrap"><BarChart data={hourData} valueKey="hours" labelKey="name" /></div>
            </div>
          )}
          {tab === 'cost' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Labor Cost by Department</span></div>
              <div className="card-body chart-wrap"><BarChart data={costData} valueKey="cost" labelKey="name" color="var(--success)" fmt={fmtMoney} /></div>
            </div>
          )}
          {tab === 'attendance' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Attendance Summary</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Shifts</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {attendance.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No data</td></tr>
                      : attendance.map((a, i) => (
                        <tr key={i}>
                          <td className="td-bold">{a.name}</td>
                          <td>{a.shifts}</td>
                          <td className="td-mono">{a.hours}h</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────────

function DocumentsView({ user }) {
  const [docs, setDocs] = useState([])
  const [employees, setEmployees] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ employee_id: '', title: '', type: 'contract', expiry_date: '', url: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: d }, { data: emps }] = await Promise.all([
      user.role !== 'employee'
        ? supabase.from('documents').select('*, employee:employees(first_name,last_name)').order('expiry_date')
        : supabase.from('documents').select('*').eq('employee_id', user.id).order('expiry_date'),
      supabase.from('employees').select('id, first_name, last_name').eq('status', 'active'),
    ])
    setDocs(d || [])
    setEmployees(emps || [])
    setLoading(false)
  }

  async function save() {
    await supabase.from('documents').insert({ ...form, employee_id: form.employee_id || user.id })
    setShowModal(false)
    load()
  }

  async function del(id) {
    await supabase.from('documents').delete().eq('id', id)
    setConfirm(null)
    load()
  }

  function expiryBadge(d) {
    if (!d) return <span className="badge badge-neutral">No expiry</span>
    const days = differenceInDays(parseISO(d), new Date())
    if (days < 0) return <span className="badge badge-danger">Expired</span>
    if (days < 30) return <span className="badge badge-warning">Expires in {days}d</span>
    return <span className="badge badge-success">Valid</span>
  }

  const DOC_TYPES = ['contract', 'id', 'certification', 'tax', 'i9', 'other']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => { setForm({ employee_id: '', title: '', type: 'contract', expiry_date: '', url: '', notes: '' }); setShowModal(true) }}><Plus size={14} /> Add Document</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead>
                <tr>
                  {user.role !== 'employee' && <th>Employee</th>}
                  <th>Title</th><th>Type</th><th>Expiry</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No documents</td></tr>
                  : docs.map(d => (
                    <tr key={d.id}>
                      {user.role !== 'employee' && <td className="td-bold">{fullName(d.employee)}</td>}
                      <td>{d.title}</td>
                      <td><span className="badge badge-blue">{d.type}</span></td>
                      <td className="td-mono">{d.expiry_date || '—'}</td>
                      <td>{expiryBadge(d.expiry_date)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /></a>}
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(d.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Document"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        {user.role !== 'employee' && (
          <div className="form-group">
            <label className="form-label">Employee</label>
            <select className="select" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
            </select>
          </div>
        )}
        <div className="form-group"><label className="form-label">Title</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Type</label>
            <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Expiry Date</label><input className="input" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">URL (optional)</label><input className="input" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </Modal>

      <Confirm open={!!confirm} message="Delete this document?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
    </div>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────

function NotificationsView({ user }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('employee_id', user.id).order('created_at', { ascending: false })
    setNotifs(data || [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    load()
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('employee_id', user.id).eq('read', false)
    load()
  }

  async function del(id) {
    await supabase.from('notifications').delete().eq('id', id)
    load()
  }

  const typeIcon = (t) => {
    if (t === 'success') return <CheckCircle size={16} />
    if (t === 'warning') return <AlertTriangle size={16} />
    if (t === 'danger') return <XCircle size={16} />
    return <Info size={16} />
  }

  const unread = notifs.filter(n => !n.read).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontWeight: 600 }}>{unread} unread</span>
        {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAllRead}><CheckCircle size={14} /> Mark All Read</button>}
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner large /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifs.length === 0 && <div className="empty-state"><Bell size={40} /><p>No notifications</p></div>}
          {notifs.map(n => (
            <div key={n.id} className="card" style={{ opacity: n.read ? 0.6 : 1 }}>
              <div style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ color: n.type === 'success' ? 'var(--success)' : n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--info)', marginTop: 2 }}>
                  {typeIcon(n.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{n.created_at ? format(parseISO(n.created_at), 'MMM d, h:mm a') : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!n.read && <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}><Check size={12} /></button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => del(n.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Locations ─────────────────────────────────────────────────────────────────

function LocationsView({ user }) {
  const [locs, setLocs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editLoc, setEditLoc] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius_meters: 200, active: true })
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('locations').select('*').order('name')
    setLocs(data || [])
    setLoading(false)
  }

  async function save() {
    const data = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), radius_meters: parseInt(form.radius_meters) }
    if (editLoc) { await supabase.from('locations').update(data).eq('id', editLoc.id) }
    else { await supabase.from('locations').insert(data) }
    setShowModal(false)
    load()
  }

  async function del(id) {
    await supabase.from('locations').delete().eq('id', id)
    setConfirm(null)
    load()
  }

  function detectGPS() {
    navigator.geolocation.getCurrentPosition(p => {
      setForm({ ...form, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })
    })
  }

  function openNew() {
    setEditLoc(null)
    setForm({ name: '', address: '', latitude: '', longitude: '', radius_meters: 200, active: true })
    setShowModal(true)
  }

  function openEdit(l) {
    setEditLoc(l)
    setForm({ name: l.name, address: l.address || '', latitude: l.latitude, longitude: l.longitude, radius_meters: l.radius_meters || 200, active: l.active })
    setShowModal(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={14} /> Add Location</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <table>
              <thead><tr><th>Name</th><th>Address</th><th>Lat / Lng</th><th>Radius</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {locs.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No locations</td></tr>
                  : locs.map(l => (
                    <tr key={l.id}>
                      <td className="td-bold">{l.name}</td>
                      <td className="td-muted">{l.address || '—'}</td>
                      <td className="td-mono">{l.latitude?.toFixed(4)}, {l.longitude?.toFixed(4)}</td>
                      <td>{l.radius_meters}m</td>
                      <td><span className={`badge badge-${l.active ? 'success' : 'neutral'}`}>{l.active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(l)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(l.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editLoc ? 'Edit Location' : 'Add Location'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label className="form-label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Address</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        <div className="input-row">
          <div className="form-group"><label className="form-label">Latitude</label><input className="input" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Longitude</label><input className="input" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Radius (meters)</label><input className="input" type="number" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: e.target.value })} /></div>
          <button className="btn btn-secondary" onClick={detectGPS} style={{ marginBottom: 16 }}><MapPin size={14} /> Detect My Location</button>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Active (used for geofencing)
          </label>
        </div>
      </Modal>

      <Confirm open={!!confirm} message="Delete this location?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsView({ user, onUserUpdate }) {
  const [tab, setTab] = useState('company')
  const [company, setCompany] = useState({ name: 'My Company', address: '', phone: '', email: '' })
  const [pwForm, setPwForm] = useState({ current: '', new_pass: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [departments, setDepartments] = useState([])
  const [deptForm, setDeptForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    supabase.from('app_config').select('*').then(({ data }) => {
      if (data) { const map = {}; data.forEach(r => { map[r.key] = r.value }); if (map.company_name) setCompany({ name: map.company_name, address: map.company_address || '', phone: map.company_phone || '', email: map.company_email || '' }) }
    })
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data || []))
  }, [])

  async function saveCompany() {
    setSaving(true)
    for (const [k, v] of Object.entries({ company_name: company.name, company_address: company.address, company_phone: company.phone, company_email: company.email })) {
      await supabase.from('app_config').upsert({ key: k, value: v }, { onConflict: 'key' })
    }
    setSaving(false)
    setSaved('Company saved!')
    setTimeout(() => setSaved(''), 2000)
  }

  async function changePassword() {
    setPwMsg('')
    if (pwForm.new_pass !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    const { data, error } = await supabase.from('employees').select('password_hash').eq('id', user.id).single()
    if (data?.password_hash !== pwForm.current) { setPwMsg('Current password incorrect'); return }
    await supabase.from('employees').update({ password_hash: pwForm.new_pass }).eq('id', user.id)
    setPwMsg('Password updated successfully!')
    setPwForm({ current: '', new_pass: '', confirm: '' })
  }

  async function addDept() {
    if (!deptForm.name) return
    await supabase.from('departments').insert(deptForm)
    setDeptForm({ name: '', description: '' })
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments(data || [])
  }

  async function delDept(id) {
    await supabase.from('departments').delete().eq('id', id)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments(data || [])
  }

  async function exportData() {
    const { data: emps } = await supabase.from('employees').select('*')
    const csv = [Object.keys(emps?.[0] || {}).join(','), ...(emps || []).map(e => Object.values(e).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'employees_export.csv'; a.click()
  }

  return (
    <div>
      <div className="tabs">
        {['company', 'password', 'departments', 'data'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
        ))}
      </div>

      {tab === 'company' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Company Information</span>{saved && <span className="badge badge-success">{saved}</span>}</div>
          <div className="card-body">
            <div className="form-group"><label className="form-label">Company Name</label><input className="input" value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Address</label><input className="input" value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} /></div>
            <div className="input-row">
              <div className="form-group"><label className="form-label">Phone</label><input className="input" value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="input" value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" onClick={saveCompany} disabled={saving}>{saving ? <Spinner /> : <><Save size={14} /> Save</>}</button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <div className="card-body">
            {pwMsg && <div style={{ marginBottom: 16 }}><Alert type={pwMsg.includes('updated') ? 'success' : 'danger'}>{pwMsg}</Alert></div>}
            <div className="form-group"><label className="form-label">Current Password</label><input className="input" type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="input" type="password" value={pwForm.new_pass} onChange={e => setPwForm({ ...pwForm, new_pass: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
            <button className="btn btn-primary" onClick={changePassword}><Lock size={14} /> Update Password</button>
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Departments</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input className="input" placeholder="Department name" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} style={{ flex: 1 }} />
              <input className="input" placeholder="Description" value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} style={{ flex: 2 }} />
              <button className="btn btn-primary" onClick={addDept}><Plus size={14} /> Add</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
                <tbody>
                  {departments.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text4)', padding: 24 }}>No departments</td></tr>
                    : departments.map(d => (
                      <tr key={d.id}>
                        <td className="td-bold">{d.name}</td>
                        <td className="td-muted">{d.description || '—'}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => delDept(d.id)}><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Data Export</span></div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Export your employee data as CSV.</p>
            <button className="btn btn-secondary" onClick={exportData}><Download size={14} /> Export Employees CSV</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── App Shell ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
  { id: 'clock', label: 'Clock In/Out', icon: Clock, section: 'main' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, section: 'main' },
  { id: 'timesheets', label: 'Timesheets', icon: ClipboardList, section: 'main' },
  { id: 'timeoff', label: 'Time Off', icon: Umbrella, section: 'main' },
  { id: 'availability', label: 'Availability', icon: UserCheck, section: 'main' },
  { id: 'shiftswap', label: 'Shift Swap', icon: Shuffle, section: 'main' },
  { id: 'employees', label: 'Employees', icon: Users, section: 'people', adminOnly: true },
  { id: 'hiring', label: 'Hiring', icon: Briefcase, section: 'people', adminOnly: true },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare, section: 'people' },
  { id: 'payroll', label: 'Payroll', icon: DollarSign, section: 'finance', adminOnly: true },
  { id: 'reports', label: 'Reports', icon: BarChart2, section: 'finance', adminOnly: true },
  { id: 'documents', label: 'Documents', icon: FileText, section: 'admin' },
  { id: 'notifications', label: 'Notifications', icon: Bell, section: 'admin' },
  { id: 'locations', label: 'Locations', icon: MapPin, section: 'admin', adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'admin', adminOnly: true },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard', clock: 'Clock In / Out', schedule: 'Schedule',
  timesheets: 'Timesheets', timeoff: 'Time Off', availability: 'Availability',
  shiftswap: 'Shift Swap', employees: 'Employees', hiring: 'Hiring',
  messaging: 'Messaging', payroll: 'Payroll', reports: 'Reports',
  documents: 'Documents', notifications: 'Notifications', locations: 'Locations', settings: 'Settings',
}

const SECTIONS = ['main', 'people', 'finance', 'admin']
const SECTION_LABELS = { main: 'Workforce', people: 'People', finance: 'Finance', admin: 'Admin' }

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  useEffect(() => {
    if (user) {
      supabase.from('notifications').select('id', { count: 'exact' }).eq('employee_id', user.id).eq('read', false)
        .then(({ count }) => setUnreadNotifs(count || 0))
    }
  }, [user, page])

  if (!user) return <Login onLogin={u => setUser(u)} />

  const isAdmin = user.role !== 'employee'
  const visibleNav = NAV.filter(n => !n.adminOnly || isAdmin)

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard user={user} />
      case 'clock': return <ClockInOut user={user} />
      case 'schedule': return <Schedule user={user} />
      case 'timesheets': return <Timesheets user={user} />
      case 'timeoff': return <TimeOffView user={user} />
      case 'availability': return <AvailabilityView user={user} />
      case 'shiftswap': return <ShiftSwapView user={user} />
      case 'employees': return <EmployeesView user={user} />
      case 'hiring': return <HiringView user={user} />
      case 'messaging': return <MessagingView user={user} />
      case 'payroll': return <PayrollView user={user} />
      case 'reports': return <ReportsView user={user} />
      case 'documents': return <DocumentsView user={user} />
      case 'notifications': return <NotificationsView user={user} />
      case 'locations': return <LocationsView user={user} />
      case 'settings': return <SettingsView user={user} onUserUpdate={setUser} />
      default: return <Dashboard user={user} />
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">⚡ StaffForce</div>
          <div className="sidebar-logo-sub">Workforce Platform</div>
        </div>

        {SECTIONS.map(section => {
          const items = visibleNav.filter(n => n.section === section)
          if (!items.length) return null
          return (
            <div key={section} className="sidebar-section">
              <div className="sidebar-section-label">{SECTION_LABELS[section]}</div>
              {items.map(item => (
                <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {item.id === 'notifications' && unreadNotifs > 0 && <span className="nav-badge">{unreadNotifs}</span>}
                </div>
              ))}
            </div>
          )
        })}

        <div className="sidebar-bottom">
          <div className="nav-item" onClick={() => setUser(null)}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h1 className="topbar-title">{PAGE_TITLES[page]}</h1>
          <div className="topbar-right">
            <div className="topbar-user" onClick={() => setPage('settings')}>
              <Avatar emp={user} size="sm" />
              <span>{fullName(user)}</span>
              <span className="badge badge-blue" style={{ fontSize: 10 }}>{user.role}</span>
            </div>
          </div>
        </div>
        <div className="content">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
