import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { t, Lang } from '../lib/i18n'
import { checkGeofence } from '../lib/geo'
import {
  calculateGrossPay, calculateDeductions, generateNACHA,
  generatePayrollCSV, formatHours, formatCurrency, getTotalHoursForEntry
} from '../lib/payroll'
import {
  Employee, Location, Department, Shift, TimeEntry, TimeOff,
  PayrollPeriod, PayrollEntry, Document, Notification, Message,
  Availability, ShiftSwap, JobPosting, Candidate, Performance,
  Page, ThemeConfig, PayrollConfig, defaultTheme, defaultPayrollConfig
} from '../lib/store'
import {
  format, parseISO, differenceInMinutes, startOfWeek, endOfWeek,
  addDays, subDays, startOfMonth, endOfMonth, isSameDay, isToday,
  addWeeks, subWeeks, formatDistanceToNow
} from 'date-fns'

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Calendar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  List: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Beach: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 7V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16"/><path d="M22 20H2"/><path d="M18 20V10a4 4 0 0 0-8 0v10"/></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  UserPlus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  Message: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  DollarSign: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  BarChart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  File: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  MapPin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  ArrowSwap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Upload: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Print: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  ChevronLeft: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevronRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Alert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Send: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Logout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Star: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Info: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
}

// ─── Toast System ─────────────────────────────────────────────────────────────

interface Toast { id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, addToast }
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && <Icon.Check />}
          {toast.type === 'error' && <Icon.Alert />}
          {toast.type === 'info' && <Icon.Info />}
          {toast.message}
        </div>
      ))}
    </div>
  )
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({ children, onClose, size = 'md' }: {
  children: React.ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal modal-${size}`}>{children}</div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(emp: Employee) {
  return `${emp.first_name[0] ?? ''}${emp.last_name[0] ?? ''}`.toUpperCase()
}

function fullName(emp: Employee) {
  return `${emp.first_name} ${emp.last_name}`
}

function fmtTime(iso: string) {
  try { return format(parseISO(iso), 'h:mm a') } catch { return iso }
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), 'MMM d, yyyy') } catch { return iso }
}

function fmtDateTime(iso: string) {
  try { return format(parseISO(iso), 'MMM d, h:mm a') } catch { return iso }
}

function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1,3),16)
    const g = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  Object.entries({
    '--bg': theme.bg,
    '--bg2': theme.bg2,
    '--bg3': theme.bg3,
    '--bg4': theme.bg4,
    '--border': theme.border,
    '--border2': theme.border2,
    '--v': theme.v,
    '--v2': theme.v2,
    '--v3': theme.v3,
    '--v4': theme.v4,
    '--text': theme.text,
    '--text2': theme.text2,
    '--text3': theme.text3,
    '--text4': theme.text4,
    '--success': theme.success,
    '--warning': theme.warning,
    '--danger': theme.danger,
    '--info': theme.info,
    '--v-dim': hexToRgba(theme.v, 0.08),
    '--v-glow': hexToRgba(theme.v, 0.25),
    '--success-dim': hexToRgba(theme.success, 0.10),
    '--warning-dim': hexToRgba(theme.warning, 0.10),
    '--danger-dim': hexToRgba(theme.danger, 0.10),
    '--info-dim': hexToRgba(theme.info, 0.10),
  }).forEach(([k, v]) => root.style.setProperty(k, v))
}

function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Login Component ──────────────────────────────────────────────────────────

function LoginScreen({
  onLogin, lang, setLang
}: {
  onLogin: (emp: Employee) => void
  lang: Lang
  setLang: (l: Lang) => void
}) {
  const [mode, setMode] = useState<'admin' | 'pin'>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryPass, setRecoveryPass] = useState('')
  const [recoveryPass2, setRecoveryPass2] = useState('')
  const [recoveryMsg, setRecoveryMsg] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const handleRecovery = async () => {
    if (!recoveryEmail || !recoveryPass) { setRecoveryMsg('Please fill all fields.'); return }
    if (recoveryPass !== recoveryPass2) { setRecoveryMsg('Passwords do not match.'); return }
    if (recoveryPass.length < 6) { setRecoveryMsg('Password must be at least 6 characters.'); return }
    setRecoveryLoading(true)
    setRecoveryMsg('')
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('email', recoveryEmail).eq('status', 'active').single()
      if (!emp) { setRecoveryMsg('No active account found with that email.'); setRecoveryLoading(false); return }
      await supabase.from('employees').update({ password_hash: recoveryPass }).eq('email', recoveryEmail)
      setRecoveryMsg('✓ Password updated. You can now sign in.')
      setRecoveryPass('')
      setRecoveryPass2('')
    } catch {
      setRecoveryMsg('Something went wrong. Try again.')
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('*, department:departments(*), location:locations(*)')
        .eq('email', email)
        .eq('status', 'active')
        .single()
      if (empErr || !emp) throw new Error(t(lang, 'invalidCredentials'))
      if (emp.password_hash !== password) throw new Error(t(lang, 'invalidCredentials'))
      onLogin(emp)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handlePinKey = async (key: string) => {
    if (key === 'del') { setPin(p => p.slice(0, -1)); return }
    const newPin = pin + key
    setPin(newPin)
    setError('')
    if (newPin.length >= 4) {
      setLoading(true)
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('*, department:departments(*), location:locations(*)')
          .eq('pin', newPin)
          .eq('status', 'active')
          .single()
        if (!emp) {
          setError(t(lang, 'invalidPin'))
          setPin('')
        } else {
          onLogin(emp)
        }
      } catch {
        setError(t(lang, 'invalidPin'))
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Lang toggle */}
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <div className="lang-toggle">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
          </div>
        </div>

        <div className="login-logo">
          <div className="login-logo-icon">SF</div>
          <div className="login-logo-name">Staff<span>Force</span></div>
          <div className="login-subtitle">Workforce Management Platform</div>
        </div>

        {/* Mode toggle */}
        <div className="tabs" style={{ marginBottom: 24 }}>
          <button className={`tab ${mode === 'admin' ? 'active' : ''}`} onClick={() => { setMode('admin'); setError('') }}>
            {t(lang, 'adminMode')}
          </button>
          <button className={`tab ${mode === 'pin' ? 'active' : ''}`} onClick={() => { setMode('pin'); setError('') }}>
            {t(lang, 'pinMode')}
          </button>
        </div>

        {mode === 'admin' ? (
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">{t(lang, 'email')}</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">{t(lang, 'password')}</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <div className="error-box"><Icon.Alert />{error}</div>}
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <span className="spinner" /> : t(lang, 'signIn')}
            </button>
          </form>
          {showRecovery ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>Reset Password</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Enter your email and a new password. An admin must approve this change.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="form-input" type="email" placeholder="Your email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />
                <input className="form-input" type="password" placeholder="New password" value={recoveryPass} onChange={e => setRecoveryPass(e.target.value)} />
                <input className="form-input" type="password" placeholder="Confirm new password" value={recoveryPass2} onChange={e => setRecoveryPass2(e.target.value)} />
                {recoveryMsg && <div className={recoveryMsg.startsWith('✓') ? 'success-box' : 'error-box'} style={{ fontSize: 12 }}>{recoveryMsg}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary w-full" onClick={() => { setShowRecovery(false); setRecoveryMsg('') }}>Cancel</button>
                  <button className="btn btn-primary w-full" onClick={handleRecovery} disabled={recoveryLoading}>
                    {recoveryLoading ? <span className="spinner" /> : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button style={{ background: 'none', border: 'none', color: 'var(--v)', fontSize: 12, cursor: 'pointer', marginTop: 12, width: '100%', textAlign: 'center' }}
              onClick={() => setShowRecovery(true)}>
              Forgot password?
            </button>
          )}
        ) : (
          <div>
            <div className="pin-display">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>
            <div className="pin-grid">
              {['1','2','3','4','5','6','7','8','9','','0','del'].map(k => (
                <button key={k} className="pin-key" onClick={() => k && handlePinKey(k)} disabled={loading || !k} style={!k ? { background: 'transparent', border: 'none', cursor: 'default' } : {}}>
                  {k === 'del' ? '⌫' : k}
                </button>
              ))}
            </div>
            {error && <div className="error-box mt-8"><Icon.Alert />{error}</div>}
            <p className="text-sm text-muted2 text-center mt-12">{t(lang, 'forgotPin')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

const NAV_ITEMS: { page: Page; labelKey: string; icon: keyof typeof Icon; roles: string[]; section: string }[] = [
  { page: 'dashboard', labelKey: 'dashboard', icon: 'Dashboard', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'clockinout', labelKey: 'clockInOut', icon: 'Clock', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'schedule', labelKey: 'schedule', icon: 'Calendar', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'timesheets', labelKey: 'timesheets', icon: 'List', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'timeoff', labelKey: 'timeOff', icon: 'Beach', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'availability', labelKey: 'availability', icon: 'Grid', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'shiftswap', labelKey: 'shiftSwap', icon: 'ArrowSwap', roles: ['admin','manager','employee'], section: 'workforce' },
  { page: 'employees', labelKey: 'employees', icon: 'Users', roles: ['admin','manager'], section: 'people' },
  { page: 'hiring', labelKey: 'hiring', icon: 'UserPlus', roles: ['admin','manager'], section: 'people' },
  { page: 'messaging', labelKey: 'messaging', icon: 'Message', roles: ['admin','manager','employee'], section: 'people' },
  { page: 'payroll', labelKey: 'payroll', icon: 'DollarSign', roles: ['admin'], section: 'finance' },
  { page: 'reports', labelKey: 'reports', icon: 'BarChart', roles: ['admin','manager'], section: 'finance' },
  { page: 'documents', labelKey: 'documents', icon: 'File', roles: ['admin','manager','employee'], section: 'management' },
  { page: 'notifications', labelKey: 'notifications', icon: 'Bell', roles: ['admin','manager','employee'], section: 'management' },
  { page: 'locations', labelKey: 'locations', icon: 'MapPin', roles: ['admin'], section: 'management' },
  { page: 'settings', labelKey: 'settings', icon: 'Settings', roles: ['admin'], section: 'management' },
]

const SECTIONS = ['workforce', 'people', 'finance', 'management'] as const

function Sidebar({ user, activePage, setActivePage, lang, unreadCount, onLogout }: {
  user: Employee
  activePage: Page
  setActivePage: (p: Page) => void
  lang: Lang
  unreadCount: number
  onLogout: () => void
}) {
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role))

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">SF</div>
        <div className="sidebar-logo-text">Staff<span>Force</span></div>
      </div>

      <nav className="sidebar-nav">
        {SECTIONS.map(section => {
          const items = visibleItems.filter(i => i.section === section)
          if (!items.length) return null
          return (
            <div key={section}>
              <div className="sidebar-section-label">{t(lang, section as Parameters<typeof t>[1])}</div>
              {items.map(item => {
                const IconComp = Icon[item.icon]
                return (
                  <button
                    key={item.page}
                    className={`sidebar-item ${activePage === item.page ? 'active' : ''}`}
                    onClick={() => setActivePage(item.page)}
                  >
                    <span className="sidebar-item-icon"><IconComp /></span>
                    {t(lang, item.labelKey as Parameters<typeof t>[1])}
                    {item.page === 'notifications' && unreadCount > 0 && (
                      <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials(user)}</div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div className="sidebar-user-name truncate">{fullName(user)}</div>
          <div className="sidebar-user-role">{user.role}</div>
        </div>
        <button className="btn-ghost btn-icon" onClick={onLogout} title={t(lang, 'signOut')}>
          <Icon.Logout />
        </button>
      </div>
    </aside>
  )
}

// ─── Dashboard Module ─────────────────────────────────────────────────────────

function DashboardModule({ user, lang }: { user: Employee; lang: Lang }) {
  const [stats, setStats] = useState({
    clockedIn: 0, hoursWeek: 0, laborCostMTD: 0,
    openShifts: 0, pendingTimeOff: 0, lateToday: 0
  })
  const [activeEntries, setActiveEntries] = useState<(TimeEntry & { employee: Employee })[]>([])
  const [upcomingShifts, setUpcomingShifts] = useState<(Shift & { employee: Employee; department: Department })[]>([])
  const [pendingEntries, setPendingEntries] = useState<(TimeEntry & { employee: Employee })[]>([])
  const [pendingTOff, setPendingTOff] = useState<(TimeOff & { employee: Employee })[]>([])
  const [alerts, setAlerts] = useState<{ type: string; msg: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    const now = new Date().toISOString()
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString()
    const monthStart = startOfMonth(new Date()).toISOString()
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)

    // Active clock-ins
    const { data: active } = await supabase
      .from('time_entries')
      .select('*, employee:employees(*, department:departments(*))')
      .is('clock_out', null)
      .order('clock_in', { ascending: false })

    // Hours this week
    const { data: weekEntries } = await supabase
      .from('time_entries')
      .select('clock_in, clock_out, break_mins')
      .gte('clock_in', weekStart)
      .not('clock_out', 'is', null)

    const hoursWeek = (weekEntries || []).reduce((sum, e) => {
      if (!e.clock_out) return sum
      const h = Math.max(0, (differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) - (e.break_mins||0)) / 60)
      return sum + h
    }, 0)

    // Labor cost MTD
    const { data: monthEntries } = await supabase
      .from('time_entries')
      .select('clock_in, clock_out, break_mins, employee:employees(hourly_rate, employment_type, salary_annual)')
      .gte('clock_in', monthStart)
      .not('clock_out', 'is', null)

    const laborCostMTD = (monthEntries || []).reduce((sum, e: Record<string, unknown>) => {
      const emp = e.employee as unknown as Employee
      if (!emp || !e.clock_out) return sum
      if (emp.employment_type === 'salary') return sum + emp.salary_annual / 24
      const h = Math.max(0, (differenceInMinutes(parseISO(e.clock_out as string), parseISO(e.clock_in as string)) - ((e.break_mins as number)||0)) / 60)
      return sum + h * emp.hourly_rate
    }, 0)

    // Open shifts (scheduled, in future)
    const { count: openShifts } = await supabase
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gt('start_time', now)

    // Pending time off
    const { count: pendingTOffCount } = await supabase
      .from('time_off')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Upcoming shifts (next 24h)
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const { data: upcoming } = await supabase
      .from('shifts')
      .select('*, employee:employees(first_name, last_name), department:departments(name,color)')
      .eq('status', 'scheduled')
      .gte('start_time', now)
      .lte('start_time', tomorrow)
      .order('start_time')
      .limit(10)

    // Pending timesheets
    const { data: pendingTS } = await supabase
      .from('time_entries')
      .select('*, employee:employees(first_name, last_name)')
      .eq('status', 'pending')
      .not('clock_out', 'is', null)
      .order('clock_in', { ascending: false })
      .limit(10)

    // Pending time off requests
    const { data: pendingTO } = await supabase
      .from('time_off')
      .select('*, employee:employees(first_name, last_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    // Late today: scheduled shift started >15min ago, no clock_in
    const { data: todayShifts } = await supabase
      .from('shifts')
      .select('employee_id, start_time')
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', now)
      .eq('status', 'scheduled')

    const { data: todayClocked } = await supabase
      .from('time_entries')
      .select('employee_id')
      .gte('clock_in', todayStart.toISOString())

    const clockedIds = new Set((todayClocked||[]).map((e: Record<string,unknown>) => e.employee_id))
    const lateToday = (todayShifts||[]).filter((s: Record<string,unknown>) => {
      const minsLate = differenceInMinutes(new Date(), parseISO(s.start_time as string))
      return minsLate > 15 && !clockedIds.has(s.employee_id)
    }).length

    // Alerts: expiring docs
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const { data: expiringDocs } = await supabase
      .from('documents')
      .select('name, expiry_date, employee:employees(first_name, last_name)')
      .lt('expiry_date', in30)
      .gte('expiry_date', new Date().toISOString().slice(0, 10))
      .limit(5)

    const docAlerts = (expiringDocs || []).map((d: Record<string,unknown>) => {
      const emp = d.employee as unknown as Employee
      return { type: 'warning', msg: `${d.name} for ${emp?.first_name} expires ${d.expiry_date}` }
    })

    setStats({
      clockedIn: (active || []).length,
      hoursWeek: Math.round(hoursWeek * 10) / 10,
      laborCostMTD,
      openShifts: openShifts || 0,
      pendingTimeOff: pendingTOffCount || 0,
      lateToday
    })
    setActiveEntries((active || []) as (TimeEntry & { employee: Employee })[])
    setUpcomingShifts((upcoming || []) as (Shift & { employee: Employee; department: Department })[])
    setPendingEntries((pendingTS || []) as (TimeEntry & { employee: Employee })[])
    setPendingTOff((pendingTO || []) as (TimeOff & { employee: Employee })[])
    setAlerts(docAlerts)
    setLoading(false)
  }

  if (loading) return <div className="loading-overlay"><span className="spinner" />{t(lang, 'loading')}</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'dashboard')}</h1>
        <span className="text-sm text-muted2">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-4 mb-20">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--success-dim)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'clockedInNow')}</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats.clockedIn}</div>
          <div className="stat-card-sub">employees working</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--info-dim)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'hoursThisWeek')}</div>
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>{stats.hoursWeek}</div>
          <div className="stat-card-sub">total hours logged</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--v-dim)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v3)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'laborCostMTD')}</div>
          <div className="stat-card-value" style={{ color: 'var(--v3)' }}>{formatCurrency(stats.laborCostMTD)}</div>
          <div className="stat-card-sub">month to date</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'openShifts')}</div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{stats.openShifts}</div>
          <div className="stat-card-sub">upcoming scheduled</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><path d="M18 7V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16"/><path d="M22 20H2"/><path d="M18 20V10a4 4 0 0 0-8 0v10"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'pendingTimeOff')}</div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{stats.pendingTimeOff}</div>
          <div className="stat-card-sub">awaiting approval</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: stats.lateToday > 0 ? 'var(--danger-dim)' : 'var(--bg4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stats.lateToday > 0 ? 'var(--danger)' : 'var(--text3)'} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="stat-card-label">{t(lang, 'lateToday')}</div>
          <div className="stat-card-value" style={{ color: stats.lateToday > 0 ? 'var(--danger)' : 'var(--text)' }}>{stats.lateToday}</div>
          <div className="stat-card-sub">employees late</div>
        </div>
      </div>

      <div className="grid grid-2 gap-20" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Who's In */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t(lang, 'whoIsIn')}</h3>
            <span className="badge badge-success">{activeEntries.length} active</span>
          </div>
          {activeEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏢</div>
              <div className="empty-state-text">{t(lang, 'noActiveEmployees')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeEntries.slice(0,8).map(entry => {
                const mins = differenceInMinutes(new Date(), parseISO(entry.clock_in))
                const hrs = Math.floor(mins / 60)
                const m = mins % 60
                return (
                  <div key={entry.id} className="flex items-center gap-8">
                    <div className="avatar avatar-sm">{initials(entry.employee)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(entry.employee)}</div>
                      <div className="text-xs text-muted2">Since {fmtTime(entry.clock_in)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{hrs}h {m}m</div>
                    <div className="dot dot-success" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming Shifts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t(lang, 'upcomingShifts')}</h3>
            <span className="text-xs text-muted2">Next 24 hours</span>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-text">{t(lang, 'noUpcomingShifts')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingShifts.map(shift => (
                <div key={shift.id} className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm">{shift.employee ? initials(shift.employee) : '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{shift.employee ? fullName(shift.employee) : 'Unknown'}</div>
                    <div className="text-xs text-muted2">{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</div>
                  </div>
                  {shift.department && (
                    <span className="badge" style={{ background: shift.department.color + '22', color: shift.department.color, fontSize: 10 }}>
                      {shift.department.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t(lang, 'pendingApprovals')}</h3>
            <span className="badge badge-warning">{pendingEntries.length + pendingTOff.length}</span>
          </div>
          {pendingEntries.length === 0 && pendingTOff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">{t(lang, 'noPendingApprovals')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingEntries.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm">{initials(entry.employee)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(entry.employee)}</div>
                    <div className="text-xs text-muted2">Timesheet · {fmtDate(entry.clock_in)}</div>
                  </div>
                  <span className="badge badge-warning">Timesheet</span>
                </div>
              ))}
              {pendingTOff.slice(0, 3).map(req => (
                <div key={req.id} className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm">{req.employee ? initials(req.employee) : '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{req.employee ? fullName(req.employee) : 'Unknown'}</div>
                    <div className="text-xs text-muted2">Time Off · {req.start_date} to {req.end_date}</div>
                  </div>
                  <span className="badge badge-info">Time Off</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t(lang, 'alerts')}</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-text">No alerts at this time</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((alert, i) => (
                <div key={i} className="warn-box">
                  <Icon.Alert />
                  <span>{alert.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── Clock In/Out Module ──────────────────────────────────────────────────────

function ClockModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [geoStatus, setGeoStatus] = useState<'checking' | 'ok' | 'denied' | 'outside' | 'exempt'>('checking')
  const [distance, setDistance] = useState(0)
  const [location, setLocation] = useState<Location | null>(null)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [elapsed, setElapsed] = useState('')
  const [clockLoading, setClockLoading] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!activeEntry) return
    const interval = setInterval(() => {
      const mins = differenceInMinutes(new Date(), parseISO(activeEntry.clock_in))
      const h = Math.floor(mins / 60)
      const m = mins % 60
      setElapsed(`${h}h ${m}m`)
    }, 10000)
    const mins = differenceInMinutes(new Date(), parseISO(activeEntry.clock_in))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    setElapsed(`${h}h ${m}m`)
    return () => clearInterval(interval)
  }, [activeEntry])

  const loadData = async () => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)

    // Get employee location
    if (user.location_id) {
      const { data: loc } = await supabase.from('locations').select('*').eq('id', user.location_id).single()
      setLocation(loc)
    }

    // Get active entry
    const { data: active } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', user.id)
      .is('clock_out', null)
      .single()
    setActiveEntry(active || null)

    // Today's entries
    const { data: todayE } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', user.id)
      .gte('clock_in', todayStart.toISOString())
      .order('clock_in', { ascending: false })
    setTodayEntries(todayE || [])

    // Geo check
    if (user.geo_exempt) {
      setGeoStatus('exempt')
      return
    }
    if (!user.location_id) {
      setGeoStatus('exempt')
      return
    }
    const { data: loc } = await supabase.from('locations').select('*').eq('id', user.location_id).single()
    if (!loc || !loc.lat || !loc.lng) { setGeoStatus('exempt'); return }

    const result = await checkGeofence({ lat: loc.lat, lng: loc.lng, radius_meters: loc.radius_meters })
    if (result.coords) setCoords(result.coords)
    if (result.distance === -1) { setGeoStatus('denied'); return }
    setDistance(result.distance)
    setGeoStatus(result.allowed ? 'ok' : 'outside')
  }

  const handleClock = async () => {
    if (geoStatus !== 'ok' && geoStatus !== 'exempt') return
    setClockLoading(true)
    try {
      if (!activeEntry) {
        // Clock in
        const { data, error } = await supabase.from('time_entries').insert({
          employee_id: user.id,
          location_id: user.location_id,
          clock_in: new Date().toISOString(),
          clock_in_lat: coords?.lat,
          clock_in_lng: coords?.lng,
          within_geofence: geoStatus === 'ok' || geoStatus === 'exempt',
          status: 'pending',
        }).select().single()
        if (error) throw error
        setActiveEntry(data)
        addToast('success', 'Clocked in successfully!')
      } else {
        // Clock out
        const { error } = await supabase.from('time_entries').update({
          clock_out: new Date().toISOString(),
          clock_out_lat: coords?.lat,
          clock_out_lng: coords?.lng,
        }).eq('id', activeEntry.id)
        if (error) throw error
        setActiveEntry(null)
        setElapsed('')
        addToast('success', 'Clocked out successfully!')
      }
      await loadData()
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setClockLoading(false)
    }
  }

  const canClock = geoStatus === 'ok' || geoStatus === 'exempt'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'clockInOut')}</h1>
      </div>

      <div className="clock-screen">
        {/* Geo Status Banner */}
        {geoStatus === 'denied' && (
          <div className="geo-status geo-error">
            <Icon.Alert />
            {t(lang, 'gpsBlocked')}
          </div>
        )}
        {geoStatus === 'outside' && location && (
          <div className="geo-status geo-error">
            <Icon.Alert />
            {t(lang, 'outsideGeofence', { distance, location: location.name })}
          </div>
        )}
        {geoStatus === 'ok' && (
          <div className="geo-status geo-ok">
            <Icon.MapPin />
            {t(lang, 'withinGeofence')}
          </div>
        )}
        {geoStatus === 'exempt' && (
          <div className="geo-status geo-info">
            <Icon.Info />
            {t(lang, 'geoExempt')}
          </div>
        )}
        {geoStatus === 'checking' && (
          <div className="geo-status geo-warning">
            <span className="spinner" style={{ width: 14, height: 14 }} />
            Checking your location...
          </div>
        )}

        {/* Clock Card */}
        <div className="clock-status-card">
          <div className="text-sm text-muted2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {user.first_name} {user.last_name}
          </div>
          <div className="clock-time-display">
            {activeEntry ? elapsed || '0h 0m' : '—'}
          </div>
          <div style={{ fontSize: 14, color: activeEntry ? 'var(--success)' : 'var(--text3)', marginBottom: 24, fontWeight: 500 }}>
            {activeEntry ? `${t(lang, 'currentlyWorking')} · Since ${fmtTime(activeEntry.clock_in)}` : t(lang, 'notClockedIn')}
          </div>

          <button
            className={`clock-btn ${activeEntry ? 'clock-btn-out' : 'clock-btn-in'}`}
            onClick={handleClock}
            disabled={!canClock || clockLoading}
          >
            {clockLoading ? <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> :
              activeEntry ? t(lang, 'clockOut') : t(lang, 'clockIn')}
          </button>
        </div>

        {/* Today's history */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t(lang, 'todayHistory')}</h3>
            <span className="text-sm text-muted2">
              {todayEntries.filter(e => e.clock_out).reduce((s, e) => {
                if (!e.clock_out) return s
                return s + Math.max(0, (differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) - (e.break_mins||0)) / 60)
              }, 0).toFixed(1)}h total
            </span>
          </div>
          {todayEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">{t(lang, 'noEntriesYet')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {todayEntries.map(entry => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--success)' }}>{t(lang, 'clockedInAt')}</span> {fmtTime(entry.clock_in)}
                      {entry.clock_out && <> · <span style={{ color: 'var(--danger)' }}>{t(lang, 'clockedOutAt')}</span> {fmtTime(entry.clock_out)}</>}
                    </div>
                    {entry.break_mins > 0 && <div className="text-xs text-muted2">Break: {entry.break_mins}min</div>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {entry.clock_out ? `${getTotalHoursForEntry(entry).toFixed(1)}h` : <span style={{ color: 'var(--success)', fontSize: 11 }}>Active</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Schedule Module ──────────────────────────────────────────────────────────

function ScheduleModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [shifts, setShifts] = useState<(Shift & { employee: Employee; department: Department })[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [filterDept, setFilterDept] = useState('')

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { loadData() }, [weekStart])

  const loadData = async () => {
    setLoading(true)
    const [{ data: s }, { data: e }, { data: d }] = await Promise.all([
      supabase.from('shifts').select('*, employee:employees(first_name, last_name, department_id), department:departments(name, color)')
        .gte('start_time', weekStart.toISOString()).lte('start_time', weekEnd.toISOString()).order('start_time'),
      supabase.from('employees').select('*, department:departments(name, color)').eq('status', 'active').order('first_name'),
      supabase.from('departments').select('*').order('name'),
    ])
    setShifts((s || []) as (Shift & { employee: Employee; department: Department })[])
    setEmployees(e || [])
    setDepartments(d || [])
    setLoading(false)
  }

  const deleteShift = async (id: string) => {
    if (!confirm('Delete this shift?')) return
    await supabase.from('shifts').delete().eq('id', id)
    addToast('success', 'Shift deleted.')
    loadData()
  }

  const filteredEmployees = employees.filter(e => !filterDept || e.department_id === filterDept)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'schedule')}</h1>
        <div className="page-header-actions">
          <select className="form-select" style={{ width: 160 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">{t(lang, 'all')} Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
            <Icon.ChevronLeft />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <button className="btn btn-secondary" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
            <Icon.ChevronRight />
          </button>
          <button className="btn btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>Today</button>
          {(user.role === 'admin' || user.role === 'manager') && (
            <button className="btn btn-primary" onClick={() => { setEditShift(null); setShowAddModal(true) }}>
              <Icon.Plus />{t(lang, 'addShift')}
            </button>
          )}
        </div>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div style={{ overflowX: 'auto' }}>
          <div className="schedule-grid" style={{ minWidth: 900 }}>
            {/* Header */}
            <div className="schedule-header-cell" style={{ background: 'var(--bg3)' }}>Employee</div>
            {days.map(day => (
              <div key={day.toISOString()} className="schedule-header-cell" style={isToday(day) ? { color: 'var(--v3)', background: 'var(--v-dim)' } : {}}>
                <div style={{ fontSize: 11 }}>{format(day, 'EEE')}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{format(day, 'd')}</div>
              </div>
            ))}

            {/* Rows */}
            {filteredEmployees.map(emp => (
              <div key={emp.id} style={{ display: 'contents' }}>
                <div className="schedule-row-label">
                  <div className="flex items-center gap-6">
                    <div className="avatar avatar-sm">{initials(emp)}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{fullName(emp)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text4)' }}>{emp.position || 'Employee'}</div>
                    </div>
                  </div>
                </div>
                {days.map(day => {
                  const dayShifts = shifts.filter(s =>
                    s.employee_id === emp.id && isSameDay(parseISO(s.start_time), day)
                  )
                  return (
                    <div key={day.toISOString()} className="schedule-cell" onClick={() => {
                      if (user.role === 'admin' || user.role === 'manager') {
                        setEditShift({ employee_id: emp.id, start_time: day.toISOString(), end_time: day.toISOString() } as Shift)
                        setShowAddModal(true)
                      }
                    }}>
                      {dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className="schedule-shift"
                          style={shift.department ? { borderColor: shift.department.color, background: shift.department.color + '22' } : {}}
                          onClick={e => { e.stopPropagation(); setEditShift(shift); setShowAddModal(true) }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 11 }}>{fmtTime(shift.start_time)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtTime(shift.end_time)}</div>
                          {shift.position && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{shift.position}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <ShiftModal
          shift={editShift}
          employees={employees}
          departments={departments}
          lang={lang}
          onClose={() => { setShowAddModal(false); setEditShift(null) }}
          onSave={() => { setShowAddModal(false); setEditShift(null); loadData() }}
          onDelete={deleteShift}
          addToast={addToast}
          defaultLocationId={user.location_id}
        />
      )}
    </div>
  )
}

function ShiftModal({ shift, employees, departments, lang, onClose, onSave, onDelete, addToast, defaultLocationId }: {
  shift: Shift | null
  employees: Employee[]
  departments: Department[]
  lang: Lang
  onClose: () => void
  onSave: () => void
  onDelete: (id: string) => void
  addToast: (type: Toast['type'], msg: string) => void
  defaultLocationId?: string
}) {
  const [form, setForm] = useState({
    employee_id: shift?.employee_id || '',
    department_id: shift?.department_id || '',
    start_time: shift?.start_time ? shift.start_time.slice(0, 16) : '',
    end_time: shift?.end_time ? shift.end_time.slice(0, 16) : '',
    position: shift?.position || '',
    notes: shift?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const isEdit = !!(shift?.id)

  const save = async () => {
    if (!form.employee_id || !form.start_time || !form.end_time) {
      addToast('error', 'Employee, start and end time are required.')
      return
    }
    setSaving(true)
    const payload = {
      employee_id: form.employee_id,
      department_id: form.department_id || null,
      location_id: defaultLocationId || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      position: form.position || null,
      notes: form.notes || null,
      status: 'scheduled',
    }
    if (isEdit && shift?.id) {
      await supabase.from('shifts').update(payload).eq('id', shift.id)
    } else {
      await supabase.from('shifts').insert(payload)
    }
    addToast('success', isEdit ? 'Shift updated.' : 'Shift added.')
    setSaving(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="md">
      <div className="modal-header">
        <h2 className="modal-title">{isEdit ? t(lang, 'editShift') : t(lang, 'addShift')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee...</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{fullName(emp)}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'startTime')} <span className="required">*</span></label>
            <input className="form-input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'endTime')} <span className="required">*</span></label>
            <input className="form-input" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'department')}</label>
            <select className="form-select" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'position')}</label>
            <input className="form-input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'shiftNotes')}</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && shift?.id && (
          <button className="btn btn-danger" onClick={() => { onDelete(shift.id); onClose() }}><Icon.Trash />{t(lang, 'delete')}</button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : t(lang, 'save')}
        </button>
      </div>
    </Modal>
  )
}

// ─── Timesheets Module ─────────────────────────────────────────────────────────

function TimesheetsModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [entries, setEntries] = useState<(TimeEntry & { employee: Employee })[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmp, setFilterEmp] = useState(user.role === 'employee' ? user.id : '')
  const [filterStatus, setFilterStatus] = useState('')
  const [dateFrom, setDateFrom] = useState(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => { loadData() }, [filterEmp, filterStatus, dateFrom, dateTo])

  const loadData = async () => {
    setLoading(true)
    let q = supabase.from('time_entries')
      .select('*, employee:employees(first_name, last_name, hourly_rate, employment_type, department:departments(name))')
      .gte('clock_in', new Date(dateFrom).toISOString())
      .lte('clock_in', new Date(dateTo + 'T23:59:59').toISOString())
      .not('clock_out', 'is', null)
      .order('clock_in', { ascending: false })

    if (user.role === 'employee') q = q.eq('employee_id', user.id)
    else if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterStatus) q = q.eq('status', filterStatus)

    const { data } = await q
    setEntries((data || []) as (TimeEntry & { employee: Employee })[])

    if (user.role !== 'employee') {
      const { data: emps } = await supabase.from('employees').select('*').eq('status', 'active').order('first_name')
      setEmployees(emps || [])
    }
    setLoading(false)
  }

  const approveEntry = async (id: string) => {
    await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', id)
    addToast('success', 'Entry approved.')
    loadData()
  }

  const rejectEntry = async (id: string) => {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id)
    addToast('info', 'Entry rejected.')
    loadData()
  }

  const approveAll = async () => {
    const pending = entries.filter(e => e.status === 'pending')
    if (!pending.length) return
    await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).in('id', pending.map(e => e.id))
    addToast('success', `${pending.length} entries approved.`)
    loadData()
  }

  const exportCSV = () => {
    const headers = 'Employee,Date,Clock In,Clock Out,Regular Hrs,Break Min,Status\n'
    const rows = entries.map(e => {
      const h = getTotalHoursForEntry(e).toFixed(2)
      return `${e.employee ? fullName(e.employee) : ''},${e.clock_in.slice(0,10)},${fmtTime(e.clock_in)},${e.clock_out ? fmtTime(e.clock_out) : ''},${h},${e.break_mins},${e.status}`
    }).join('\n')
    downloadFile(headers + rows, 'timesheets.csv', 'text/csv')
  }

  const getDailyHours = (empId: string, date: string) => {
    return entries.filter(e => e.employee_id === empId && e.clock_in.slice(0,10) === date).reduce((s, e) => s + getTotalHoursForEntry(e), 0)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'timesheets')}</h1>
        <div className="page-header-actions">
          {(user.role === 'admin' || user.role === 'manager') && (
            <button className="btn btn-success" onClick={approveAll}><Icon.Check />{t(lang, 'approveAll')}</button>
          )}
          <button className="btn btn-secondary" onClick={exportCSV}><Icon.Download />{t(lang, 'exportCSV')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 160 }} />
        <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 160 }} />
        {user.role !== 'employee' && (
          <select className="form-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ width: 180 }}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        )}
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
          <option value="">{t(lang, 'all')} Status</option>
          <option value="pending">{t(lang, 'pending')}</option>
          <option value="approved">{t(lang, 'approved')}</option>
          <option value="rejected">{t(lang, 'rejected')}</option>
        </select>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(lang, 'employees')}</th>
                  <th>Date</th>
                  <th>{t(lang, 'clockInTime')}</th>
                  <th>{t(lang, 'clockOutTime')}</th>
                  <th>{t(lang, 'regularHours')}</th>
                  <th>{t(lang, 'breakMins')}</th>
                  <th>OT</th>
                  <th>Status</th>
                  {(user.role === 'admin' || user.role === 'manager') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>No entries found.</td></tr>
                )}
                {entries.map(entry => {
                  const hours = getTotalHoursForEntry(entry)
                  const dayHours = getDailyHours(entry.employee_id!, entry.clock_in.slice(0,10))
                  const isOT = dayHours > 8 || hours > 8
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="flex items-center gap-8">
                          {entry.employee && <div className="avatar avatar-sm">{initials(entry.employee)}</div>}
                          <span style={{ fontSize: 13 }}>{entry.employee ? fullName(entry.employee) : '—'}</span>
                        </div>
                      </td>
                      <td className="td-muted">{format(parseISO(entry.clock_in), 'MMM d, yyyy')}</td>
                      <td>{fmtTime(entry.clock_in)}</td>
                      <td>{entry.clock_out ? fmtTime(entry.clock_out) : <span className="badge badge-success">Active</span>}</td>
                      <td style={{ color: isOT ? 'var(--warning)' : 'inherit', fontWeight: isOT ? 600 : 400 }}>
                        {hours.toFixed(2)}h {isOT && <span className="badge badge-warning" style={{ fontSize: 9 }}>OT</span>}
                      </td>
                      <td className="td-muted">{entry.break_mins}m</td>
                      <td>{isOT ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Yes</span> : <span className="td-muted">—</span>}</td>
                      <td>
                        <span className={`badge badge-${entry.status === 'approved' ? 'success' : entry.status === 'rejected' ? 'danger' : 'warning'}`}>
                          {t(lang, entry.status as Parameters<typeof t>[1])}
                        </span>
                      </td>
                      {(user.role === 'admin' || user.role === 'manager') && (
                        <td>
                          <div className="flex gap-4">
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditEntry(entry); setShowEditModal(true) }}><Icon.Edit /></button>
                            {entry.status === 'pending' && <>
                              <button className="btn btn-success btn-sm" onClick={() => approveEntry(entry.id)}><Icon.Check /></button>
                              <button className="btn btn-danger btn-sm" onClick={() => rejectEntry(entry.id)}><Icon.X /></button>
                            </>}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEditModal && editEntry && (
        <EditTimeEntryModal
          entry={editEntry}
          lang={lang}
          onClose={() => { setShowEditModal(false); setEditEntry(null) }}
          onSave={() => { setShowEditModal(false); setEditEntry(null); loadData() }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function EditTimeEntryModal({ entry, lang, onClose, onSave, addToast }: {
  entry: TimeEntry; lang: Lang; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [clockIn, setClockIn] = useState(entry.clock_in.slice(0, 16))
  const [clockOut, setClockOut] = useState(entry.clock_out ? entry.clock_out.slice(0, 16) : '')
  const [breakMins, setBreakMins] = useState(entry.break_mins.toString())
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('time_entries').update({
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      break_mins: parseInt(breakMins) || 0,
      notes: notes || null,
    }).eq('id', entry.id)
    addToast('success', 'Entry updated.')
    setSaving(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'editEntry')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">{t(lang, 'clockInTime')}</label>
          <input className="form-input" type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'clockOutTime')}</label>
          <input className="form-input" type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'breakMins')}</label>
          <input className="form-input" type="number" min="0" value={breakMins} onChange={e => setBreakMins(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'notes')}</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : t(lang, 'save')}</button>
      </div>
    </Modal>
  )
}

// ─── Time Off Module ──────────────────────────────────────────────────────────

function TimeOffModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [requests, setRequests] = useState<(TimeOff & { employee: Employee })[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('mine')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { loadData() }, [activeTab, filterStatus])

  const loadData = async () => {
    setLoading(true)
    let q = supabase.from('time_off')
      .select('*, employee:employees(first_name, last_name, pto_balance, department:departments(name))')
      .order('created_at', { ascending: false })

    if (activeTab === 'mine' || user.role === 'employee') q = q.eq('employee_id', user.id)
    if (filterStatus) q = q.eq('status', filterStatus)

    const { data } = await q
    setRequests((data || []) as (TimeOff & { employee: Employee })[])
    setLoading(false)
  }

  const handleAction = async (id: string, action: 'approved' | 'denied') => {
    const req = requests.find(r => r.id === id)
    await supabase.from('time_off').update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    // Deduct PTO if approved vacation/sick/personal
    if (action === 'approved' && req && req.type !== 'unpaid' && req.employee_id) {
      const days = req.days || 0
      const { error: rpcErr } = await supabase.rpc('decrement_pto', { emp_id: req.employee_id, days_used: days })
      if (rpcErr) {
        await supabase.from('employees').update({ pto_balance: Math.max(0, (req.employee?.pto_balance || 0) - days) }).eq('id', req.employee_id)
      }
    }

    // Notification
    if (req?.employee_id) {
      await supabase.from('notifications').insert({
        employee_id: req.employee_id,
        title: `Time Off ${action === 'approved' ? 'Approved' : 'Denied'}`,
        message: `Your ${req.type} request from ${req.start_date} to ${req.end_date} was ${action}.`,
        type: action === 'approved' ? 'success' : 'warning',
      })
    }

    addToast(action === 'approved' ? 'success' : 'info', `Request ${action}.`)
    loadData()
  }

  // Group by date for calendar view
  const approvedRequests = requests.filter(r => r.status === 'approved')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'timeOff')}</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Icon.Plus />{t(lang, 'requestTimeOff')}
          </button>
        </div>
      </div>

      {/* PTO Balance card */}
      <div className="highlight mb-16 flex items-center gap-16">
        <div>
          <div className="text-xs text-muted2 mb-4">{t(lang, 'ptoBalance')}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28 }}>
            {user.pto_balance.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text3)' }}>{t(lang, 'days')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {user.role !== 'employee' && (
        <div className="tabs">
          <button className={`tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>{t(lang, 'myTimeOff')}</button>
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>{t(lang, 'allTimeOff')}</button>
        </div>
      )}

      <div className="filter-bar">
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
          <option value="">{t(lang, 'all')} Status</option>
          <option value="pending">{t(lang, 'pending')}</option>
          <option value="approved">{t(lang, 'approved')}</option>
          <option value="denied">Denied</option>
        </select>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {activeTab === 'all' && user.role !== 'employee' && <th>Employee</th>}
                  <th>Type</th>
                  <th>{t(lang, 'startDate')}</th>
                  <th>{t(lang, 'endDate')}</th>
                  <th>Days</th>
                  <th>{t(lang, 'reason')}</th>
                  <th>Status</th>
                  {(user.role === 'admin' || user.role === 'manager') && activeTab === 'all' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>{t(lang, 'noRequests')}</td></tr>
                )}
                {requests.map(req => (
                  <tr key={req.id}>
                    {activeTab === 'all' && user.role !== 'employee' && (
                      <td>
                        <div className="flex items-center gap-8">
                          {req.employee && <div className="avatar avatar-sm">{initials(req.employee)}</div>}
                          <span>{req.employee ? fullName(req.employee) : '—'}</span>
                        </div>
                      </td>
                    )}
                    <td><span className="badge badge-info">{req.type}</span></td>
                    <td>{req.start_date}</td>
                    <td>{req.end_date}</td>
                    <td>{req.days || '—'}</td>
                    <td className="td-muted" style={{ maxWidth: 200 }}><span className="truncate">{req.reason || '—'}</span></td>
                    <td>
                      <span className={`badge badge-${req.status === 'approved' ? 'success' : req.status === 'denied' ? 'danger' : 'warning'}`}>
                        {req.status}
                      </span>
                    </td>
                    {(user.role === 'admin' || user.role === 'manager') && activeTab === 'all' && (
                      <td>
                        {req.status === 'pending' && (
                          <div className="flex gap-4">
                            <button className="btn btn-success btn-sm" onClick={() => handleAction(req.id, 'approved')}><Icon.Check />{t(lang, 'approve')}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAction(req.id, 'denied')}><Icon.X />{t(lang, 'deny')}</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <RequestTimeOffModal
          user={user} lang={lang}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadData() }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function RequestTimeOffModal({ user, lang, onClose, onSave, addToast }: {
  user: Employee; lang: Lang; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [form, setForm] = useState({ type: 'vacation', start_date: '', end_date: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.start_date || !form.end_date) { addToast('error', 'Start and end dates required.'); return }
    setSaving(true)
    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
    await supabase.from('time_off').insert({
      employee_id: user.id,
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      reason: form.reason || null,
      status: 'pending',
    })
    addToast('success', t(lang, 'requestSubmitted'))
    setSaving(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'requestTimeOff')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">{t(lang, 'type')}</label>
          <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="vacation">{t(lang, 'vacation')}</option>
            <option value="sick">{t(lang, 'sick')}</option>
            <option value="personal">{t(lang, 'personal')}</option>
            <option value="unpaid">{t(lang, 'unpaid')}</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'startDate')}</label>
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'endDate')}</label>
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'reason')}</label>
          <textarea className="form-textarea" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
        </div>
        <div className="info-box"><Icon.Info />Your balance: {user.pto_balance.toFixed(1)} days available.</div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'Submit Request'}</button>
      </div>
    </Modal>
  )
}

// ─── Availability Module ───────────────────────────────────────────────────────

function AvailabilityModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const
  const [availability, setAvailability] = useState<Record<number, { available: boolean; start_time: string; end_time: string; allDay: boolean }>>({
    0: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    1: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    2: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    3: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    4: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    5: { available: true, start_time: '09:00', end_time: '17:00', allDay: false },
    6: { available: false, start_time: '09:00', end_time: '17:00', allDay: false },
  })
  const [saving, setSaving] = useState(false)
  const [allEmployeeAvail, setAllEmployeeAvail] = useState<(Availability & { employee: Employee })[]>([])
  const [viewEmp, setViewEmp] = useState<string>(user.id)

  useEffect(() => { loadData() }, [viewEmp])

  const loadData = async () => {
    const { data } = await supabase.from('availability').select('*').eq('employee_id', viewEmp)
    if (data && data.length > 0) {
      const map: typeof availability = { ...availability }
      data.forEach((a: Availability) => {
        map[a.day_of_week] = {
          available: a.available,
          start_time: a.start_time || '09:00',
          end_time: a.end_time || '17:00',
          allDay: !a.start_time,
        }
      })
      setAvailability(map)
    }

    if (user.role !== 'employee') {
      const { data: all } = await supabase
        .from('availability')
        .select('*, employee:employees(first_name, last_name)')
      setAllEmployeeAvail((all || []) as (Availability & { employee: Employee })[])
    }
  }

  const save = async () => {
    setSaving(true)
    const rows = Object.entries(availability).map(([day, a]) => ({
      employee_id: viewEmp,
      day_of_week: parseInt(day),
      available: a.available,
      start_time: a.allDay ? null : a.start_time,
      end_time: a.allDay ? null : a.end_time,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('availability').upsert(rows, { onConflict: 'employee_id,day_of_week' })
    addToast('success', t(lang, 'availabilitySaved'))
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'availability')}</h1>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : t(lang, 'saveAvailability')}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        {DAYS.map((day, i) => {
          const a = availability[i]
          return (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 100, fontSize: 13, fontWeight: 500 }}>{t(lang, day)}</div>
              <label className="checkbox-row">
                <input type="checkbox" checked={a.available} onChange={e => setAvailability(av => ({ ...av, [i]: { ...av[i], available: e.target.checked } }))} />
                <span style={{ fontSize: 12 }}>{a.available ? t(lang, 'available') : t(lang, 'unavailable')}</span>
              </label>
              {a.available && (
                <>
                  <label className="checkbox-row" style={{ marginLeft: 8 }}>
                    <input type="checkbox" checked={a.allDay} onChange={e => setAvailability(av => ({ ...av, [i]: { ...av[i], allDay: e.target.checked } }))} />
                    <span style={{ fontSize: 12 }}>{t(lang, 'allDay')}</span>
                  </label>
                  {!a.allDay && (
                    <div className="flex gap-8 items-center">
                      <input type="time" className="form-input" style={{ width: 110 }} value={a.start_time} onChange={e => setAvailability(av => ({ ...av, [i]: { ...av[i], start_time: e.target.value } }))} />
                      <span className="text-muted2">to</span>
                      <input type="time" className="form-input" style={{ width: 110 }} value={a.end_time} onChange={e => setAvailability(av => ({ ...av, [i]: { ...av[i], end_time: e.target.value } }))} />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shift Swap Module ─────────────────────────────────────────────────────────

function ShiftSwapModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [swaps, setSwaps] = useState<(ShiftSwap & { requester: Employee; target: Employee; shift: Shift; target_shift: Shift })[]>([])
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [allShifts, setAllShifts] = useState<(Shift & { employee: Employee })[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const now = new Date().toISOString()

    const [{ data: s }, { data: ms }, { data: as_ }, { data: emps }] = await Promise.all([
      supabase.from('shift_swaps').select('*, requester:employees!requester_id(first_name, last_name), target:employees!target_id(first_name, last_name), shift:shifts!shift_id(*), target_shift:shifts!target_shift_id(*)')
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`).order('created_at', { ascending: false }),
      supabase.from('shifts').select('*').eq('employee_id', user.id).gt('start_time', now).eq('status', 'scheduled').order('start_time'),
      supabase.from('shifts').select('*, employee:employees(first_name, last_name)').gt('start_time', now).eq('status', 'scheduled').neq('employee_id', user.id).order('start_time').limit(50),
      supabase.from('employees').select('*').eq('status', 'active').neq('id', user.id),
    ])
    setSwaps((s || []) as typeof swaps)
    setMyShifts(ms || [])
    setAllShifts((as_ || []) as (Shift & { employee: Employee })[])
    setEmployees(emps || [])
    setLoading(false)
  }

  const handleAction = async (id: string, action: 'approved' | 'denied') => {
    await supabase.from('shift_swaps').update({ status: action, approved_by: user.id }).eq('id', id)
    addToast(action === 'approved' ? 'success' : 'info', `Swap request ${action}.`)
    loadData()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'shiftSwap')}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icon.Plus />{t(lang, 'requestSwap')}
        </button>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          {swaps.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">{t(lang, 'noSwaps')}</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Requester</th><th>Their Shift</th><th>Target</th><th>Target Shift</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {swaps.map(swap => (
                    <tr key={swap.id}>
                      <td>{swap.requester ? fullName(swap.requester) : '—'}</td>
                      <td className="td-muted">{swap.shift ? `${fmtDate(swap.shift.start_time)} ${fmtTime(swap.shift.start_time)}` : '—'}</td>
                      <td>{swap.target ? fullName(swap.target) : '—'}</td>
                      <td className="td-muted">{swap.target_shift ? `${fmtDate(swap.target_shift.start_time)} ${fmtTime(swap.target_shift.start_time)}` : '—'}</td>
                      <td><span className={`badge badge-${swap.status === 'approved' ? 'success' : swap.status === 'denied' ? 'danger' : 'warning'}`}>{swap.status}</span></td>
                      <td>
                        {swap.status === 'pending' && (user.role === 'admin' || user.role === 'manager' || swap.target_id === user.id) && (
                          <div className="flex gap-4">
                            <button className="btn btn-success btn-sm" onClick={() => handleAction(swap.id, 'approved')}><Icon.Check /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAction(swap.id, 'denied')}><Icon.X /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal onClose={() => setShowModal(false)} size="md">
          <div className="modal-header">
            <h2 className="modal-title">{t(lang, 'requestSwap')}</h2>
            <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><Icon.X /></button>
          </div>
          <SwapForm user={user} lang={lang} myShifts={myShifts} allShifts={allShifts} employees={employees}
            onSave={() => { setShowModal(false); loadData() }} onClose={() => setShowModal(false)} addToast={addToast} />
        </Modal>
      )}
    </div>
  )
}

function SwapForm({ user, lang, myShifts, allShifts, employees, onSave, onClose, addToast }: {
  user: Employee; lang: Lang; myShifts: Shift[]; allShifts: (Shift & { employee: Employee })[]; employees: Employee[];
  onSave: () => void; onClose: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [form, setForm] = useState({ shift_id: '', target_id: '', target_shift_id: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const targetShifts = allShifts.filter(s => s.employee_id === form.target_id)

  const save = async () => {
    if (!form.shift_id || !form.target_id) { addToast('error', 'Select your shift and target employee.'); return }
    setSaving(true)
    await supabase.from('shift_swaps').insert({
      requester_id: user.id,
      target_id: form.target_id,
      shift_id: form.shift_id,
      target_shift_id: form.target_shift_id || null,
      reason: form.reason || null,
      status: 'pending',
    })
    addToast('success', t(lang, 'swapRequested'))
    setSaving(false)
    onSave()
  }

  return (
    <div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">{t(lang, 'myShift')}</label>
          <select className="form-select" value={form.shift_id} onChange={e => setForm(f => ({ ...f, shift_id: e.target.value }))}>
            <option value="">Select your shift...</option>
            {myShifts.map(s => <option key={s.id} value={s.id}>{fmtDate(s.start_time)} {fmtTime(s.start_time)} – {fmtTime(s.end_time)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'swapWith')}</label>
          <select className="form-select" value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value, target_shift_id: '' }))}>
            <option value="">Select employee...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </div>
        {form.target_id && (
          <div className="form-group">
            <label className="form-label">Their Shift (optional)</label>
            <select className="form-select" value={form.target_shift_id} onChange={e => setForm(f => ({ ...f, target_shift_id: e.target.value }))}>
              <option value="">No specific shift</option>
              {targetShifts.map(s => <option key={s.id} value={s.id}>{fmtDate(s.start_time)} {fmtTime(s.start_time)} – {fmtTime(s.end_time)}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{t(lang, 'swapReason')}</label>
          <textarea className="form-textarea" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : t(lang, 'requestSwap')}</button>
      </div>
    </div>
  )
}

// ─── Employees Module ─────────────────────────────────────────────────────────

function EmployeesModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => { loadData() }, [filterDept, filterStatus])

  const loadData = async () => {
    setLoading(true)
    let q = supabase.from('employees')
      .select('*, department:departments(name, color), location:locations(name)')
      .order('first_name')

    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterDept) q = q.eq('department_id', filterDept)

    const [{ data: emps }, { data: depts }, { data: locs }] = await Promise.all([
      q,
      supabase.from('departments').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
    ])
    setEmployees(emps || [])
    setDepartments(depts || [])
    setLocations(locs || [])
    setLoading(false)
  }

  const filtered = employees.filter(e =>
    !search || fullName(e).toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setSelectedEmp(null); setIsNew(true); setShowModal(true) }
  const openEdit = (emp: Employee) => { setSelectedEmp(emp); setIsNew(false); setShowModal(true) }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'employees')}</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openNew}><Icon.Plus />{t(lang, 'newEmployee')}</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <Icon.Search />
          <input className="search-input" placeholder={t(lang, 'searchEmployees')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-select" style={{ width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">{t(lang, 'active')}</option>
          <option value="inactive">{t(lang, 'inactive')}</option>
          <option value="terminated">{t(lang, 'terminated')}</option>
        </select>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Name</th><th>Position</th><th>Department</th><th>Type</th><th>Rate</th><th>Hire Date</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>{t(lang, 'noEmployees')}</td></tr>
                )}
                {filtered.map(emp => (
                  <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(emp)}>
                    <td>
                      <div className="flex items-center gap-10">
                        <div className="avatar avatar-md">{initials(emp)}</div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{fullName(emp)}</div>
                          <div className="text-xs text-muted2">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td-muted">{emp.position || '—'}</td>
                    <td>
                      {emp.department && (
                        <span className="badge" style={{ background: emp.department.color + '22', color: emp.department.color }}>{emp.department.name}</span>
                      )}
                    </td>
                    <td><span className="badge badge-muted">{emp.employment_type}</span></td>
                    <td style={{ fontWeight: 500 }}>
                      {emp.employment_type === 'hourly' ? `$${emp.hourly_rate}/hr` : `$${emp.salary_annual.toLocaleString()}/yr`}
                    </td>
                    <td className="td-muted">{emp.hire_date ? fmtDate(emp.hire_date) : '—'}</td>
                    <td>
                      <span className={`badge badge-${emp.status === 'active' ? 'success' : emp.status === 'terminated' ? 'danger' : 'warning'}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}><Icon.Edit /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={isNew ? null : selectedEmp}
          departments={departments}
          locations={locations}
          lang={lang}
          user={user}
          onClose={() => { setShowModal(false); setSelectedEmp(null) }}
          onSave={() => { setShowModal(false); setSelectedEmp(null); loadData() }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function EmployeeModal({ employee, departments, locations, lang, user, onClose, onSave, addToast }: {
  employee: Employee | null; departments: Department[]; locations: Location[]; lang: Lang; user: Employee;
  onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [tab, setTab] = useState('personal')
  const [form, setForm] = useState({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    position: employee?.position || '',
    department_id: employee?.department_id || '',
    location_id: employee?.location_id || '',
    hire_date: employee?.hire_date || '',
    employment_type: employee?.employment_type || 'hourly',
    hourly_rate: employee?.hourly_rate?.toString() || '0',
    salary_annual: employee?.salary_annual?.toString() || '0',
    role: employee?.role || 'employee',
    status: employee?.status || 'active',
    geo_exempt: employee?.geo_exempt || false,
    language: employee?.language || 'en',
    pin: employee?.pin || '',
    bank_name: employee?.bank_name || '',
    bank_account_type: employee?.bank_account_type || 'checking',
    bank_routing: employee?.bank_routing || '',
    bank_account: employee?.bank_account || '',
    pto_balance: employee?.pto_balance?.toString() || '0',
    pto_accrual_rate: employee?.pto_accrual_rate?.toString() || '0',
    internal_notes: employee?.internal_notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [performances, setPerformances] = useState<Performance[]>([])
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([])

  useEffect(() => {
    if (employee?.id) {
      supabase.from('performance').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false }).then(({ data }) => setPerformances(data || []))
      supabase.from('payroll_entries').select('*, period:payroll_periods(start_date, end_date, frequency)').eq('employee_id', employee.id).order('created_at', { ascending: false }).limit(10).then(({ data }) => setPayrollEntries((data || []) as PayrollEntry[]))
    }
  }, [employee])

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const save = async () => {
    if (!form.first_name || !form.last_name) { addToast('error', 'First and last name required.'); return }
    setSaving(true)
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      position: form.position || null,
      department_id: form.department_id || null,
      location_id: form.location_id || null,
      hire_date: form.hire_date || null,
      employment_type: form.employment_type,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      salary_annual: parseFloat(form.salary_annual) || 0,
      role: form.role,
      status: form.status,
      geo_exempt: form.geo_exempt,
      language: form.language,
      pin: form.pin || null,
      bank_name: form.bank_name || null,
      bank_account_type: form.bank_account_type || null,
      bank_routing: form.bank_routing || null,
      bank_account: form.bank_account || null,
      pto_balance: parseFloat(form.pto_balance) || 0,
      pto_accrual_rate: parseFloat(form.pto_accrual_rate) || 0,
      internal_notes: form.internal_notes || null,
    }

    if (employee?.id) {
      await supabase.from('employees').update(payload).eq('id', employee.id)
      addToast('success', 'Employee updated.')
    } else {
      await supabase.from('employees').insert(payload)
      addToast('success', 'Employee created.')
    }
    setSaving(false)
    onSave()
  }

  const TABS = [
    { id: 'personal', label: t(lang, 'personalInfo') },
    { id: 'bank', label: t(lang, 'bankAccount') },
    { id: 'timeattend', label: 'Time & Attendance' },
    { id: 'payhistory', label: t(lang, 'payrollHistory') },
    { id: 'performance', label: t(lang, 'performance') },
    ...(user.role === 'admin' || user.role === 'manager' ? [{ id: 'notes', label: 'Notes' }] : []),
  ]

  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-header">
        <div className="flex items-center gap-12">
          {employee && <div className="avatar avatar-lg">{initials(employee)}</div>}
          <div>
            <h2 className="modal-title">{employee ? fullName(employee) : t(lang, 'newEmployee')}</h2>
            {employee && <div className="text-sm text-muted2">{employee.position} · {employee.role}</div>}
          </div>
        </div>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>

      <div className="tabs" style={{ padding: '0 24px', marginBottom: 0 }}>
        {TABS.map(tab_ => <button key={tab_.id} className={`tab ${tab === tab_.id ? 'active' : ''}`} onClick={() => setTab(tab_.id)}>{tab_.label}</button>)}
      </div>

      <div className="modal-body" style={{ gap: 14 }}>
        {tab === 'personal' && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'firstName')} <span className="required">*</span></label>
                <input className="form-input" value={form.first_name} onChange={f('first_name')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'lastName')} <span className="required">*</span></label>
                <input className="form-input" value={form.last_name} onChange={f('last_name')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'email')}</label>
                <input className="form-input" type="email" value={form.email} onChange={f('email')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'phone')}</label>
                <input className="form-input" type="tel" value={form.phone} onChange={f('phone')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'position')}</label>
                <input className="form-input" value={form.position} onChange={f('position')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'department')}</label>
                <select className="form-select" value={form.department_id} onChange={f('department_id')}>
                  <option value="">None</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'location')}</label>
                <select className="form-select" value={form.location_id} onChange={f('location_id')}>
                  <option value="">None</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'hireDate')}</label>
                <input className="form-input" type="date" value={form.hire_date} onChange={f('hire_date')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'employmentType')}</label>
                <select className="form-select" value={form.employment_type} onChange={f('employment_type')}>
                  <option value="hourly">{t(lang, 'hourly')}</option>
                  <option value="salary">{t(lang, 'salary')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{form.employment_type === 'hourly' ? t(lang, 'hourlyRate') : t(lang, 'annualSalary')}</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.employment_type === 'hourly' ? form.hourly_rate : form.salary_annual}
                  onChange={e => setForm(p => ({ ...p, [form.employment_type === 'hourly' ? 'hourly_rate' : 'salary_annual']: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'role')}</label>
                <select className="form-select" value={form.role} onChange={f('role')} disabled={user.role !== 'admin'}>
                  <option value="employee">{t(lang, 'employee')}</option>
                  <option value="manager">{t(lang, 'manager')}</option>
                  <option value="admin">{t(lang, 'admin')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'status')}</label>
                <select className="form-select" value={form.status} onChange={f('status')}>
                  <option value="active">{t(lang, 'active')}</option>
                  <option value="inactive">{t(lang, 'inactive')}</option>
                  <option value="terminated">{t(lang, 'terminated')}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'language')}</label>
                <select className="form-select" value={form.language} onChange={f('language')}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">PIN (4-6 digits)</label>
                <input className="form-input" type="text" maxLength={6} value={form.pin} onChange={f('pin')} placeholder="Employee kiosk PIN" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">PTO Balance (days)</label>
                <input className="form-input" type="number" min="0" step="0.1" value={form.pto_balance} onChange={f('pto_balance')} />
              </div>
              <div className="form-group">
                <label className="form-label">PTO Accrual Rate (hrs/hr worked)</label>
                <input className="form-input" type="number" min="0" step="0.001" value={form.pto_accrual_rate} onChange={f('pto_accrual_rate')} />
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.geo_exempt} onChange={e => setForm(p => ({ ...p, geo_exempt: e.target.checked }))} />
              <span>{t(lang, 'geoExemptLabel')} — bypass geofencing for remote employees</span>
            </label>
          </>
        )}

        {tab === 'bank' && (
          <>
            <div className="info-box"><Icon.Info />{t(lang, 'directDepositNote')}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(lang, 'bankName')}</label>
                <input className="form-input" value={form.bank_name} onChange={f('bank_name')} placeholder="Bank of America" />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'accountType')}</label>
                <select className="form-select" value={form.bank_account_type} onChange={f('bank_account_type')}>
                  <option value="checking">{t(lang, 'checking')}</option>
                  <option value="savings">{t(lang, 'savings')}</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t(lang, 'routingNumber')}</label>
              <input className="form-input" value={form.bank_routing} onChange={f('bank_routing')} maxLength={9} placeholder="9 digits" />
            </div>
            <div className="form-group">
              <label className="form-label">{t(lang, 'accountNumber')}</label>
              <input className="form-input" value={form.bank_account} onChange={f('bank_account')} placeholder="Account number" />
            </div>
          </>
        )}

        {tab === 'timeattend' && employee && (
          <TimeAttendanceTab employeeId={employee.id} lang={lang} />
        )}

        {tab === 'payhistory' && (
          <div>
            {payrollEntries.length === 0 ? (
              <div className="empty-state"><div className="empty-state-text">No payroll history.</div></div>
            ) : payrollEntries.map(pe => (
              <div key={pe.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{pe.period ? `${pe.period.start_date} – ${pe.period.end_date}` : 'Unknown period'}</div>
                  <div className="text-xs text-muted2">{pe.regular_hours}h reg + {pe.overtime_hours}h OT</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(pe.net_pay)}</div>
                  <div className="text-xs text-muted2">Gross: {formatCurrency(pe.gross_pay)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'performance' && employee && (
          <PerformanceTab employeeId={employee.id} user={user} lang={lang} addToast={addToast} />
        )}

        {tab === 'notes' && (
          <div className="form-group">
            <label className="form-label">{t(lang, 'internalNotes')}</label>
            <textarea className="form-textarea" value={form.internal_notes} onChange={f('internal_notes')} rows={8} placeholder="Internal notes visible only to admins and managers..." />
          </div>
        )}
      </div>

      {(tab === 'personal' || tab === 'bank' || tab === 'notes') && (
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : t(lang, 'save')}
          </button>
        </div>
      )}
    </Modal>
  )
}

function TimeAttendanceTab({ employeeId, lang }: { employeeId: string; lang: Lang }) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  useEffect(() => {
    supabase.from('time_entries').select('*').eq('employee_id', employeeId)
      .gte('clock_in', startOfMonth(new Date()).toISOString())
      .not('clock_out', 'is', null).order('clock_in', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }, [employeeId])

  const totalHours = entries.reduce((s, e) => s + getTotalHoursForEntry(e), 0)

  return (
    <div>
      <div className="highlight mb-12">
        <div className="text-xs text-muted2 mb-4">Total Hours This Month</div>
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24 }}>{totalHours.toFixed(1)}h</div>
      </div>
      {entries.length === 0 ? <div className="empty-state"><div className="empty-state-text">No entries this month.</div></div> :
        entries.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div>
              <span style={{ fontWeight: 500 }}>{fmtDate(e.clock_in)}</span>
              <span className="td-muted"> · {fmtTime(e.clock_in)} → {e.clock_out ? fmtTime(e.clock_out) : 'Active'}</span>
            </div>
            <div style={{ fontWeight: 600 }}>{getTotalHoursForEntry(e).toFixed(2)}h</div>
          </div>
        ))
      }
    </div>
  )
}

function PerformanceTab({ employeeId, user, lang, addToast }: { employeeId: string; user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [perfs, setPerfs] = useState<Performance[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rating: 3, period: '', strengths: '', improvements: '', notes: '' })

  useEffect(() => {
    supabase.from('performance').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
      .then(({ data }) => setPerfs(data || []))
  }, [employeeId])

  const save = async () => {
    await supabase.from('performance').insert({ ...form, employee_id: employeeId, reviewer_id: user.id })
    addToast('success', 'Review saved.')
    setShowForm(false)
    supabase.from('performance').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).then(({ data }) => setPerfs(data || []))
  }

  return (
    <div>
      {(user.role === 'admin' || user.role === 'manager') && !showForm && (
        <button className="btn btn-primary btn-sm mb-12" onClick={() => setShowForm(true)}><Icon.Plus />Add Review</button>
      )}
      {showForm && (
        <div className="card mb-12" style={{ padding: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Rating (1-5)</label>
              <input className="form-input" type="number" min={1} max={5} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) || 3 }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Period</label>
              <input className="form-input" placeholder="Q1 2025" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Strengths</label>
            <textarea className="form-textarea" rows={2} value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Areas for Improvement</label>
            <textarea className="form-textarea" rows={2} value={form.improvements} onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))} />
          </div>
          <div className="flex gap-8 mt-8">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save Review</button>
          </div>
        </div>
      )}
      {perfs.length === 0 ? <div className="empty-state"><div className="empty-state-text">No performance reviews.</div></div> :
        perfs.map(p => (
          <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.period || 'Review'}</span>
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ color: i < (p.rating || 0) ? 'var(--warning)' : 'var(--text4)', fontSize: 12 }}>★</span>
                ))}
              </div>
            </div>
            {p.strengths && <div className="text-sm text-muted2 mb-4">✓ {p.strengths}</div>}
            {p.improvements && <div className="text-sm text-muted2">△ {p.improvements}</div>}
          </div>
        ))
      }
    </div>
  )
}

// ─── Payroll Module ───────────────────────────────────────────────────────────

function PayrollModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null)
  const [periodEntries, setPeriodEntries] = useState<PayrollEntry[]>([])
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [showPaystub, setShowPaystub] = useState<PayrollEntry | null>(null)
  const [running, setRunning] = useState(false)
  const [config, setConfig] = useState<PayrollConfig>(defaultPayrollConfig)
  const [companyName, setCompanyName] = useState('My Company')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: p }, { data: e }, { data: cfg }] = await Promise.all([
      supabase.from('payroll_periods').select('*').order('start_date', { ascending: false }).limit(20),
      supabase.from('employees').select('*').eq('status', 'active'),
      supabase.from('app_config').select('*').single(),
    ])
    setPeriods(p || [])
    setEmployees(e || [])
    if (cfg?.payroll_config) setConfig({ ...defaultPayrollConfig, ...cfg.payroll_config })
    if (cfg?.company_name) setCompanyName(cfg.company_name)
    setLoading(false)
  }

  const openPeriod = async (period: PayrollPeriod) => {
    setActivePeriod(period)
    const { data } = await supabase
      .from('payroll_entries')
      .select('*, employee:employees(first_name, last_name, position, bank_routing, bank_account, bank_account_type, bank_name)')
      .eq('period_id', period.id)
      .order('created_at')
    setPeriodEntries((data || []) as PayrollEntry[])
  }

  const runPayroll = async () => {
    if (!activePeriod) return
    setRunning(true)
    try {
      for (const emp of employees) {
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('status', 'approved')
          .gte('clock_in', activePeriod.start_date)
          .lte('clock_in', activePeriod.end_date + 'T23:59:59')

        if (!timeEntries?.length && emp.employment_type === 'hourly') continue

        const gross = calculateGrossPay(timeEntries || [], emp, config)
        const deductions = calculateDeductions(gross.grossPay, config)

        const existing = periodEntries.find(pe => pe.employee_id === emp.id)
        const payload = {
          period_id: activePeriod.id,
          employee_id: emp.id,
          regular_hours: gross.regularHours,
          overtime_hours: gross.overtimeHours,
          regular_pay: gross.regularPay,
          overtime_pay: gross.overtimePay,
          gross_pay: gross.grossPay,
          federal_tax: deductions.federalTax,
          fica: deductions.fica,
          state_tax: deductions.stateTax,
          health_insurance: deductions.healthInsurance,
          retirement_401k: deductions.retirement401k,
          net_pay: deductions.netPay,
          bank_routing: emp.bank_routing || null,
          bank_account: emp.bank_account || null,
          bank_account_type: emp.bank_account_type || null,
          bank_name: emp.bank_name || null,
          status: 'calculated',
        }

        if (existing) {
          await supabase.from('payroll_entries').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('payroll_entries').insert(payload)
        }
      }
      addToast('success', 'Payroll calculated successfully.')
      await openPeriod(activePeriod)
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const markPaid = async () => {
    if (!activePeriod) return
    await supabase.from('payroll_periods').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', activePeriod.id)
    await supabase.from('payroll_entries').update({ status: 'paid' }).eq('period_id', activePeriod.id)
    addToast('success', 'Period marked as paid.')
    loadData()
    setActivePeriod(p => p ? { ...p, status: 'paid' } : p)
  }

  const downloadNACHA = () => {
    const nacha = generateNACHA(periodEntries, companyName, '021000021', '1234567890', activePeriod?.pay_date || format(new Date(), 'yyyy-MM-dd'))
    downloadFile(nacha, `payroll_${activePeriod?.start_date}.ach`)
  }

  const downloadCSVExport = () => {
    const csv = generatePayrollCSV(periodEntries)
    downloadFile(csv, `payroll_${activePeriod?.start_date}.csv`, 'text/csv')
  }

  const totalGross = periodEntries.reduce((s, e) => s + e.gross_pay, 0)
  const totalNet = periodEntries.reduce((s, e) => s + e.net_pay, 0)
  const totalOT = periodEntries.reduce((s, e) => s + e.overtime_hours, 0)

  if (loading) return <div className="loading-overlay"><span className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'payroll')}</h1>
        <button className="btn btn-primary" onClick={() => setShowNewPeriod(true)}>
          <Icon.Plus />{t(lang, 'newPeriod')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Period List */}
        <div className="card" style={{ padding: 0, height: 'fit-content' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pay Periods
          </div>
          {periods.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">{t(lang, 'noPayPeriods')}</div></div>
          ) : periods.map(p => (
            <div
              key={p.id}
              onClick={() => openPeriod(p)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: activePeriod?.id === p.id ? 'var(--v-dim)' : 'transparent',
                borderLeft: activePeriod?.id === p.id ? '3px solid var(--v)' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.start_date} – {p.end_date}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="text-xs text-muted2">{p.frequency}</span>
                <span className={`badge badge-${p.status === 'paid' ? 'success' : p.status === 'processing' ? 'warning' : 'muted'}`} style={{ fontSize: 10 }}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Period Detail */}
        <div>
          {!activePeriod ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">💼</div>
                <div className="empty-state-text">Select a pay period to view details</div>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-3 mb-16">
                <div className="stat-card">
                  <div className="stat-card-label">Total Gross Pay</div>
                  <div className="stat-card-value" style={{ color: 'var(--v3)', fontSize: 22 }}>{formatCurrency(totalGross)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Total Net Pay</div>
                  <div className="stat-card-value" style={{ color: 'var(--success)', fontSize: 22 }}>{formatCurrency(totalNet)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">OT Hours</div>
                  <div className="stat-card-value" style={{ color: 'var(--warning)', fontSize: 22 }}>{totalOT.toFixed(1)}h</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-8 mb-16">
                <button className="btn btn-primary" onClick={runPayroll} disabled={running || activePeriod.status === 'paid'}>
                  {running ? <span className="spinner" /> : <Icon.DollarSign />}{t(lang, 'runPayroll')}
                </button>
                {activePeriod.status !== 'paid' && periodEntries.length > 0 && (
                  <button className="btn btn-success" onClick={markPaid}><Icon.Check />{t(lang, 'markAsPaid')}</button>
                )}
                {periodEntries.length > 0 && (
                  <>
                    <button className="btn btn-secondary" onClick={downloadNACHA}><Icon.Download />{t(lang, 'downloadNACHA')}</button>
                    <button className="btn btn-secondary" onClick={downloadCSVExport}><Icon.Download />{t(lang, 'downloadCSV')}</button>
                  </>
                )}
              </div>

              {/* Entries Table */}
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>Employee</th>
                      <th>Reg Hrs</th><th>OT Hrs</th>
                      <th>Gross Pay</th><th>Deductions</th><th>Net Pay</th>
                      <th>Bank</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {periodEntries.length === 0 && (
                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Run payroll to calculate entries.</td></tr>
                      )}
                      {periodEntries.map(entry => {
                        const totalDeductions = entry.federal_tax + entry.fica + entry.state_tax + entry.health_insurance + entry.retirement_401k
                        return (
                          <tr key={entry.id}>
                            <td>
                              <div className="flex items-center gap-8">
                                {entry.employee && <div className="avatar avatar-sm">{initials(entry.employee)}</div>}
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 13 }}>{entry.employee ? fullName(entry.employee) : '—'}</div>
                                  <div className="text-xs text-muted2">{entry.employee?.position}</div>
                                </div>
                              </div>
                            </td>
                            <td>{entry.regular_hours}h</td>
                            <td style={{ color: entry.overtime_hours > 0 ? 'var(--warning)' : 'inherit' }}>{entry.overtime_hours}h</td>
                            <td style={{ fontWeight: 600 }}>{formatCurrency(entry.gross_pay)}</td>
                            <td style={{ color: 'var(--danger)' }}>-{formatCurrency(totalDeductions)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(entry.net_pay)}</td>
                            <td>
                              {entry.bank_routing ? (
                                <span className="badge badge-success">✓ {entry.bank_account_type}</span>
                              ) : (
                                <span className="badge badge-danger">No bank</span>
                              )}
                            </td>
                            <td><span className={`badge badge-${entry.status === 'paid' ? 'success' : entry.status === 'calculated' ? 'info' : 'muted'}`}>{entry.status}</span></td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={() => setShowPaystub(entry)}>
                                <Icon.Eye />{t(lang, 'viewPaystub')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewPeriod && (
        <NewPeriodModal lang={lang} onClose={() => setShowNewPeriod(false)} onSave={() => { setShowNewPeriod(false); loadData() }} addToast={addToast} />
      )}

      {showPaystub && activePeriod && (
        <PaystubModal entry={showPaystub} period={activePeriod} companyName={companyName} lang={lang} onClose={() => setShowPaystub(null)} />
      )}
    </div>
  )
}

function NewPeriodModal({ lang, onClose, onSave, addToast }: { lang: Lang; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void }) {
  const [form, setForm] = useState({ frequency: 'biweekly', start_date: format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'), end_date: '', pay_date: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.start_date || !form.end_date || !form.pay_date) { addToast('error', 'All date fields required.'); return }
    setSaving(true)
    await supabase.from('payroll_periods').insert({ ...form, status: 'draft' })
    addToast('success', 'Pay period created.')
    setSaving(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'newPeriod')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">{t(lang, 'frequency')}</label>
          <select className="form-select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
            <option value="weekly">{t(lang, 'weekly')}</option>
            <option value="biweekly">{t(lang, 'biweekly')}</option>
            <option value="monthly">{t(lang, 'monthly')}</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'startDate')}</label>
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'endDate')}</label>
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'payDate')}</label>
          <input className="form-input" type="date" value={form.pay_date} onChange={e => setForm(f => ({ ...f, pay_date: e.target.value }))} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : t(lang, 'save')}</button>
      </div>
    </Modal>
  )
}

function PaystubModal({ entry, period, companyName, lang, onClose }: { entry: PayrollEntry; period: PayrollPeriod; companyName: string; lang: Lang; onClose: () => void }) {
  const totalDeductions = entry.federal_tax + entry.fica + entry.state_tax + entry.health_insurance + entry.retirement_401k
  return (
    <Modal onClose={onClose} size="md">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'earningsStatement')}</h2>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Icon.Print />{'Print'}</button>
          <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
        </div>
      </div>
      <div className="modal-body">
        <div className="paystub">
          <div className="paystub-header">
            <div>
              <div className="paystub-logo">{companyName.split(' ')[0]}<span>{companyName.split(' ').slice(1).join(' ') || 'Force'}</span></div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Payroll Department</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12 }}><strong>{t(lang, 'payDate')}:</strong> {period.pay_date}</div>
              <div style={{ fontSize: 12 }}><strong>Period:</strong> {period.start_date} – {period.end_date}</div>
              <div style={{ fontSize: 12 }}><strong>Frequency:</strong> {period.frequency}</div>
            </div>
          </div>

          <div className="paystub-section">
            <div className="paystub-section-title">Employee</div>
            <div className="paystub-row"><span>{t(lang, 'employeeId')}</span><span>{entry.employee_id?.slice(0, 8).toUpperCase()}</span></div>
            <div className="paystub-row"><span>Name</span><span>{entry.employee ? fullName(entry.employee) : '—'}</span></div>
            <div className="paystub-row"><span>Position</span><span>{entry.employee?.position || '—'}</span></div>
          </div>

          <div className="paystub-section">
            <div className="paystub-section-title">{t(lang, 'earnings')}</div>
            <div className="paystub-row"><span>Regular ({entry.regular_hours}h)</span><span>{formatCurrency(entry.regular_pay)}</span></div>
            {entry.overtime_hours > 0 && <div className="paystub-row"><span>Overtime ({entry.overtime_hours}h @ 1.5x)</span><span>{formatCurrency(entry.overtime_pay)}</span></div>}
            <div className="paystub-row paystub-total"><span>{t(lang, 'grossPay')}</span><span>{formatCurrency(entry.gross_pay)}</span></div>
          </div>

          <div className="paystub-section">
            <div className="paystub-section-title">{t(lang, 'deductions')}</div>
            <div className="paystub-row"><span>{t(lang, 'federalTax')}</span><span>-{formatCurrency(entry.federal_tax)}</span></div>
            <div className="paystub-row"><span>{t(lang, 'fica')}</span><span>-{formatCurrency(entry.fica)}</span></div>
            <div className="paystub-row"><span>{t(lang, 'stateTax')}</span><span>-{formatCurrency(entry.state_tax)}</span></div>
            <div className="paystub-row"><span>{t(lang, 'healthInsurance')}</span><span>-{formatCurrency(entry.health_insurance)}</span></div>
            <div className="paystub-row"><span>{t(lang, 'retirement401k')}</span><span>-{formatCurrency(entry.retirement_401k)}</span></div>
            <div className="paystub-row paystub-total"><span>{t(lang, 'totalDeductions')}</span><span>-{formatCurrency(totalDeductions)}</span></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div>
              {entry.bank_name && <div style={{ fontSize: 12, color: '#64748B' }}>{t(lang, 'directDepositTo')}: {entry.bank_name} ····{entry.bank_account?.slice(-4)}</div>}
            </div>
            <div className="paystub-net">{t(lang, 'netPay')}: {formatCurrency(entry.net_pay)}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Reports Module ───────────────────────────────────────────────────────────

function ReportsModule({ user, lang }: { user: Employee; lang: Lang }) {
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const generateReport = async () => {
    if (!activeReport) return
    setLoading(true)
    setData([])
    const start = new Date(dateFrom).toISOString()
    const end = new Date(dateTo + 'T23:59:59').toISOString()

    if (activeReport === 'hours') {
      const { data: entries } = await supabase.from('time_entries')
        .select('employee_id, clock_in, clock_out, break_mins, employee:employees(first_name, last_name, department:departments(name))')
        .gte('clock_in', start).lte('clock_in', end).not('clock_out', 'is', null)

      const grouped: Record<string, { name: string; dept: string; hours: number; entries: number }> = {}
      for (const e of entries || []) {
        const emp = e.employee as unknown as Employee & { department: { name: string } }
        if (!grouped[e.employee_id!]) grouped[e.employee_id!] = { name: emp ? fullName(emp) : '?', dept: emp?.department?.name || '—', hours: 0, entries: 0 }
        const h = Math.max(0, (differenceInMinutes(parseISO(e.clock_out!), parseISO(e.clock_in)) - (e.break_mins || 0)) / 60)
        grouped[e.employee_id!].hours += h
        grouped[e.employee_id!].entries += 1
      }
      setData(Object.values(grouped).sort((a, b) => (b as { hours: number }).hours - (a as { hours: number }).hours) as Record<string, unknown>[])
    }

    if (activeReport === 'labor') {
      const { data: entries } = await supabase.from('time_entries')
        .select('employee_id, clock_in, clock_out, break_mins, employee:employees(first_name, last_name, hourly_rate, employment_type, salary_annual, department:departments(name))')
        .gte('clock_in', start).lte('clock_in', end).not('clock_out', 'is', null)

      const grouped: Record<string, { name: string; dept: string; hours: number; cost: number }> = {}
      for (const e of entries || []) {
        const emp = e.employee as unknown as Employee & { department: { name: string } }
        if (!grouped[e.employee_id!]) grouped[e.employee_id!] = { name: emp ? fullName(emp) : '?', dept: emp?.department?.name || '—', hours: 0, cost: 0 }
        const h = Math.max(0, (differenceInMinutes(parseISO(e.clock_out!), parseISO(e.clock_in)) - (e.break_mins || 0)) / 60)
        grouped[e.employee_id!].hours += h
        grouped[e.employee_id!].cost += emp?.employment_type === 'hourly' ? h * (emp?.hourly_rate || 0) : (emp?.salary_annual || 0) / 26
      }
      setData(Object.values(grouped).sort((a, b) => (b as { cost: number }).cost - (a as { cost: number }).cost) as Record<string, unknown>[])
    }

    if (activeReport === 'attendance') {
      const { data: shifts } = await supabase.from('shifts')
        .select('employee_id, start_time, employee:employees(first_name, last_name)')
        .gte('start_time', start).lte('start_time', end).eq('status', 'scheduled')

      const { data: entries } = await supabase.from('time_entries')
        .select('employee_id, clock_in').gte('clock_in', start).lte('clock_in', end)

      const clockedDays = new Set(entries?.map(e => `${e.employee_id}_${e.clock_in.slice(0, 10)}`))
      const grouped: Record<string, { name: string; scheduled: number; present: number; absent: number }> = {}

      for (const s of shifts || []) {
        const emp = s.employee as unknown as Employee
        if (!grouped[s.employee_id!]) grouped[s.employee_id!] = { name: emp ? fullName(emp) : '?', scheduled: 0, present: 0, absent: 0 }
        grouped[s.employee_id!].scheduled += 1
        const key = `${s.employee_id}_${s.start_time.slice(0, 10)}`
        if (clockedDays.has(key)) grouped[s.employee_id!].present += 1
        else grouped[s.employee_id!].absent += 1
      }
      setData(Object.values(grouped) as Record<string, unknown>[])
    }

    setLoading(false)
  }

  const REPORTS = [
    { id: 'hours', label: t(lang, 'hoursReport') },
    { id: 'labor', label: t(lang, 'laborCostReport') },
    { id: 'attendance', label: t(lang, 'attendanceReport') },
  ]

  const maxValue = data.length > 0 ? Math.max(...data.map(d => parseFloat(String(d.hours || d.cost || 0)))) : 1

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'reports')}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Report selector */}
        <div className="card" style={{ padding: 0, height: 'fit-content' }}>
          {REPORTS.map(r => (
            <button key={r.id}
              onClick={() => setActiveReport(r.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 16px', fontSize: 13,
                background: activeReport === r.id ? 'var(--v-dim)' : 'transparent',
                color: activeReport === r.id ? 'var(--v3)' : 'var(--text2)',
                borderLeft: activeReport === r.id ? '3px solid var(--v)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)', borderTop: 'none', borderRight: 'none',
                cursor: 'pointer', fontWeight: activeReport === r.id ? 600 : 400,
              }}
            >{r.label}</button>
          ))}
        </div>

        {/* Report content */}
        <div>
          <div className="card mb-16">
            <div className="flex gap-12 items-center">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">From</label>
                <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">To</label>
                <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div style={{ paddingTop: 20 }}>
                <button className="btn btn-primary" onClick={generateReport} disabled={!activeReport || loading}>
                  {loading ? <span className="spinner" /> : t(lang, 'generate')}
                </button>
              </div>
            </div>
          </div>

          {data.length > 0 && (
            <div className="card">
              {/* SVG Bar Chart */}
              <div style={{ marginBottom: 20 }}>
                <svg width="100%" height={Math.max(200, data.length * 36)} viewBox={`0 0 600 ${Math.max(200, data.length * 36)}`} preserveAspectRatio="xMidYMid meet">
                  {data.slice(0, 15).map((row, i) => {
                    const val = parseFloat(String(row.hours || row.cost || 0))
                    const barW = Math.max(4, (val / maxValue) * 400)
                    const y = i * 36 + 4
                    return (
                      <g key={i}>
                        <text x={0} y={y + 14} fontSize={11} fill="var(--text3)" textAnchor="start">
                          {String(row.name).split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </text>
                        <rect x={30} y={y} width={barW} height={22} rx={4} fill="var(--v)" opacity={0.8} />
                        <text x={barW + 36} y={y + 14} fontSize={11} fill="var(--text2)">
                          {activeReport === 'labor' ? formatCurrency(val) : `${val.toFixed(1)}h`}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Employee</th>
                    <th>Department</th>
                    {activeReport === 'hours' && <><th>Total Hours</th><th>Entries</th></>}
                    {activeReport === 'labor' && <><th>Hours</th><th>Labor Cost</th></>}
                    {activeReport === 'attendance' && <><th>Scheduled</th><th>Present</th><th>Absent</th><th>Rate</th></>}
                  </tr></thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{String(row.name)}</td>
                        <td className="td-muted">{String(row.dept)}</td>
                        {activeReport === 'hours' && <><td>{(row.hours as number).toFixed(1)}h</td><td>{String(row.entries)}</td></>}
                        {activeReport === 'labor' && <><td>{(row.hours as number).toFixed(1)}h</td><td style={{ fontWeight: 600 }}>{formatCurrency(row.cost as number)}</td></>}
                        {activeReport === 'attendance' && (
                          <>
                            <td>{String(row.scheduled)}</td>
                            <td style={{ color: 'var(--success)' }}>{String(row.present)}</td>
                            <td style={{ color: 'var(--danger)' }}>{String(row.absent)}</td>
                            <td>{(((row.present as number) / ((row.scheduled as number) || 1)) * 100).toFixed(0)}%</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!activeReport && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">{t(lang, 'selectReport')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Documents Module ─────────────────────────────────────────────────────────

function DocumentsModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [documents, setDocuments] = useState<(Document & { employee: Employee })[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [filterEmp, setFilterEmp] = useState(user.role === 'employee' ? user.id : '')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [filterEmp, filterType])

  const loadData = async () => {
    setLoading(true)
    let q = supabase.from('documents')
      .select('*, employee:employees(first_name, last_name)')
      .order('created_at', { ascending: false })
    if (user.role === 'employee') q = q.eq('employee_id', user.id)
    else if (filterEmp) q = q.eq('employee_id', filterEmp)
    if (filterType) q = q.eq('type', filterType)

    const [{ data: docs }, { data: emps }] = await Promise.all([
      q,
      user.role !== 'employee' ? supabase.from('employees').select('*').eq('status', 'active') : Promise.resolve({ data: [] }),
    ])
    setDocuments((docs || []) as (Document & { employee: Employee })[])
    setEmployees(emps || [])
    setLoading(false)
  }

  const now = new Date()
  const in30 = new Date(Date.now() + 30 * 86400000)

  const getExpirybadge = (expiry: string | null) => {
    if (!expiry) return null
    const d = new Date(expiry)
    if (d < now) return <span className="badge badge-danger">{t(lang, 'expired')}</span>
    if (d < in30) return <span className="badge badge-warning">{t(lang, 'expiringSoon')}</span>
    return <span className="badge badge-success">Valid</span>
  }

  const filtered = documents.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'documents')}</h1>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          <Icon.Upload />{t(lang, 'uploadDocument')}
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <Icon.Search />
          <input className="search-input" placeholder={t(lang, 'search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {user.role !== 'employee' && (
          <select className="form-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ width: 180 }}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        )}
        <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 150 }}>
          <option value="">All Types</option>
          {['contract', 'id', 'certificate', 'policy', 'tax', 'other'].map(t_ => <option key={t_} value={t_}>{t_}</option>)}
        </select>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>{t(lang, 'documentName')}</th>
                {user.role !== 'employee' && <th>Employee</th>}
                <th>Type</th><th>{t(lang, 'expiryDate')}</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>{t(lang, 'noDocuments')}</td></tr>
                )}
                {filtered.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div className="flex items-center gap-8">
                        <Icon.File />
                        <span style={{ fontWeight: 500 }}>{doc.name}</span>
                      </div>
                    </td>
                    {user.role !== 'employee' && <td>{doc.employee ? fullName(doc.employee) : '—'}</td>}
                    <td><span className="badge badge-muted">{doc.type}</span></td>
                    <td>{doc.expiry_date ? fmtDate(doc.expiry_date) : <span className="td-muted">—</span>}</td>
                    <td>{getExpirybadge(doc.expiry_date)}</td>
                    <td>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                          <Icon.Download />{t(lang, 'download')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadDocumentModal user={user} lang={lang} employees={employees} onClose={() => setShowUpload(false)} onSave={() => { setShowUpload(false); loadData() }} addToast={addToast} />
      )}
    </div>
  )
}

function UploadDocumentModal({ user, lang, employees, onClose, onSave, addToast }: {
  user: Employee; lang: Lang; employees: Employee[]; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [form, setForm] = useState({ name: '', type: 'contract', expiry_date: '', employee_id: user.id, url: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    if (!form.name) { addToast('error', 'Document name required.'); return }
    setUploading(true)
    let url = form.url

    if (file) {
      const path = `${form.employee_id}/${Date.now()}_${file.name}`
      const { data: uploaded, error } = await supabase.storage.from('documents').upload(path, file)
      if (error) { addToast('error', error.message); setUploading(false); return }
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
      url = pub.publicUrl
    }

    await supabase.from('documents').insert({
      name: form.name,
      type: form.type,
      employee_id: form.employee_id,
      expiry_date: form.expiry_date || null,
      url,
    })
    addToast('success', 'Document uploaded.')
    setUploading(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'uploadDocument')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        {user.role !== 'employee' && (
          <div className="form-group">
            <label className="form-label">Employee</label>
            <select className="form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value={user.id}>Me</option>
              {employees.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{t(lang, 'documentName')} <span className="required">*</span></label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {['contract', 'id', 'certificate', 'policy', 'tax', 'other'].map(t_ => <option key={t_} value={t_}>{t_}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'expiryDate')}</label>
            <input className="form-input" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">File</label>
          <input className="form-input" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="form-group">
          <label className="form-label">Or paste URL</label>
          <input className="form-input" type="url" placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={uploading}>{uploading ? <span className="spinner" /> : t(lang, 'save')}</button>
      </div>
    </Modal>
  )
}

// ─── Notifications Module ─────────────────────────────────────────────────────

function NotificationsModule({ user, lang, addToast, onRead }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void; onRead: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // Realtime
    const channel = supabase.channel('notifications_' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `employee_id=eq.${user.id}` },
        () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadData = async () => {
    const { data } = await supabase.from('notifications')
      .select('*').eq('employee_id', user.id).order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
    setLoading(false)
    onRead()
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('employee_id', user.id).eq('read', false)
    loadData()
  }

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(n => n.map(notif => notif.id === id ? { ...notif, read: true } : notif))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'notifications')}</h1>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}><Icon.Check />{t(lang, 'markAllRead')}</button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div className="loading-overlay"><span className="spinner" /></div> :
          notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-text">{t(lang, 'noNotifications')}</div>
            </div>
          ) : notifications.map(notif => (
            <div key={notif.id} className={`notif-item ${!notif.read ? 'unread' : ''}`} onClick={() => markOneRead(notif.id)}>
              <div className={`notif-dot ${notif.read ? 'read' : ''}`} />
              <div className="notif-content">
                <div className="notif-title">{notif.title}</div>
                <div className="notif-msg">{notif.message}</div>
                <div className="notif-time">{formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}</div>
              </div>
              <span className={`badge badge-${notif.type === 'success' ? 'success' : notif.type === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: 10 }}>
                {notif.type}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Hiring Module ────────────────────────────────────────────────────────────

function HiringModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [candidates, setCandidates] = useState<(Candidate & { job: JobPosting })[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [showNewJob, setShowNewJob] = useState(false)
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [tab, setTab] = useState<'jobs' | 'pipeline'>('jobs')

  const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'] as const

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: j }, { data: c }, { data: d }, { data: l }] = await Promise.all([
      supabase.from('job_postings').select('*, department:departments(name)').order('created_at', { ascending: false }),
      supabase.from('candidates').select('*, job:job_postings(title)').order('created_at', { ascending: false }),
      supabase.from('departments').select('*'),
      supabase.from('locations').select('*'),
    ])
    setJobs(j || [])
    setCandidates((c || []) as (Candidate & { job: JobPosting })[])
    setDepartments(d || [])
    setLocations(l || [])
    setLoading(false)
  }

  const moveStage = async (candidateId: string, newStage: string) => {
    await supabase.from('candidates').update({ stage: newStage }).eq('id', candidateId)
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stage: newStage } : c))
  }

  const convertToEmployee = async (candidate: Candidate) => {
    const job = jobs.find(j => j.id === candidate.job_id)
    await supabase.from('employees').insert({
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone,
      position: job?.title || '',
      department_id: job?.department_id || null,
      status: 'active',
      role: 'employee',
      employment_type: 'hourly',
      hourly_rate: 0,
      salary_annual: 0,
      pto_balance: 0,
      pto_accrual_rate: 0,
      hire_date: new Date().toISOString().slice(0, 10),
    })
    await supabase.from('candidates').update({ stage: 'hired' }).eq('id', candidate.id)
    addToast('success', `${candidate.first_name} ${candidate.last_name} converted to employee.`)
    loadData()
  }

  const pipelineCandidates = activeJobId
    ? candidates.filter(c => c.job_id === activeJobId)
    : candidates

  if (loading) return <div className="loading-overlay"><span className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'hiring')}</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setShowNewCandidate(true)}><Icon.Plus />Add Candidate</button>
          <button className="btn btn-primary" onClick={() => setShowNewJob(true)}><Icon.Plus />{t(lang, 'newJob')}</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>Job Postings ({jobs.length})</button>
        <button className={`tab ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>{t(lang, 'pipeline')} ({candidates.length})</button>
      </div>

      {tab === 'jobs' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Job Title</th><th>Department</th><th>Type</th><th>Location</th><th>Candidates</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {jobs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>{t(lang, 'noJobs')}</td></tr>}
                {jobs.map(job => {
                  const cCount = candidates.filter(c => c.job_id === job.id).length
                  return (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 500 }}>{job.title}</td>
                      <td>{(job as unknown as unknown as Record<string, unknown>).department ? <span className="badge badge-violet">{((job as unknown as unknown as Record<string, unknown>).department as { name: string }).name}</span> : '—'}</td>
                      <td className="td-muted">{job.employment_type}</td>
                      <td className="td-muted">{job.location || '—'}</td>
                      <td>
                        <span className="badge badge-info">{cCount} candidates</span>
                      </td>
                      <td>
                        <span className={`badge badge-${job.status === 'open' ? 'success' : 'muted'}`}>{job.status}</span>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setActiveJobId(job.id); setTab('pipeline') }}>
                          View Pipeline
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div>
          {/* Filter by job */}
          <div className="flex gap-8 mb-16 items-center">
            <select className="form-select" style={{ width: 220 }} value={activeJobId || ''} onChange={e => setActiveJobId(e.target.value || null)}>
              <option value="">All Jobs</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <span className="text-sm text-muted2">{pipelineCandidates.length} candidates</span>
          </div>

          <div className="pipeline-columns">
            {STAGES.map(stage => {
              const stageCandidates = pipelineCandidates.filter(c => c.stage === stage)
              return (
                <div key={stage} className="pipeline-col">
                  <div className="pipeline-col-header">
                    <span style={{ textTransform: 'capitalize' }}>{t(lang, stage as Parameters<typeof t>[1])}</span>
                    <span className="badge badge-muted" style={{ fontSize: 10 }}>{stageCandidates.length}</span>
                  </div>
                  {stageCandidates.map(candidate => (
                    <div key={candidate.id} className="pipeline-card">
                      <div className="pipeline-card-name">{candidate.first_name} {candidate.last_name}</div>
                      <div className="pipeline-card-meta">{candidate.job?.title || 'No job'}</div>
                      {candidate.rating && (
                        <div style={{ marginTop: 4 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} style={{ color: i < candidate.rating! ? 'var(--warning)' : 'var(--text4)', fontSize: 11 }}>★</span>
                          ))}
                        </div>
                      )}
                      {/* Stage actions */}
                      <div className="flex gap-4 mt-8" style={{ flexWrap: 'wrap' }}>
                        {STAGES.filter(s => s !== stage).map(s => (
                          <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                            onClick={() => moveStage(candidate.id, s as string)}>
                            → {t(lang, s as Parameters<typeof t>[1])}
                          </button>
                        ))}
                        {stage !== 'hired' && (
                          <button className="btn btn-success btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                            onClick={() => convertToEmployee(candidate)}>
                            ✓ Hire
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageCandidates.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: 'var(--text4)' }}>Empty</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showNewJob && (
        <NewJobModal lang={lang} departments={departments} locations={locations}
          onClose={() => setShowNewJob(false)} onSave={() => { setShowNewJob(false); loadData() }} addToast={addToast} />
      )}

      {showNewCandidate && (
        <NewCandidateModal lang={lang} jobs={jobs}
          onClose={() => setShowNewCandidate(false)} onSave={() => { setShowNewCandidate(false); loadData() }} addToast={addToast} />
      )}
    </div>
  )
}

function NewJobModal({ lang, departments, locations, onClose, onSave, addToast }: {
  lang: Lang; departments: Department[]; locations: Location[]; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void
}) {
  const [form, setForm] = useState({ title: '', department_id: '', employment_type: 'fulltime', location: '', description: '', salary_min: '', salary_max: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.title) { addToast('error', 'Title required.'); return }
    setSaving(true)
    await supabase.from('job_postings').insert({ ...form, status: 'open', department_id: form.department_id || null, salary_min: parseFloat(form.salary_min) || null, salary_max: parseFloat(form.salary_max) || null })
    addToast('success', 'Job posted.')
    setSaving(false)
    onSave()
  }
  return (
    <Modal onClose={onClose} size="md">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'newJob')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Job Title <span className="required">*</span></label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <select className="form-select" value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
              <option value="fulltime">Full-Time</option>
              <option value="parttime">Part-Time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Salary Min</label>
            <input className="form-input" type="number" value={form.salary_min} onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Salary Max</label>
            <input className="form-input" type="number" value={form.salary_max} onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'Post Job'}</button>
      </div>
    </Modal>
  )
}

function NewCandidateModal({ lang, jobs, onClose, onSave, addToast }: { lang: Lang; jobs: JobPosting[]; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_id: '', resume_url: '', rating: 3, notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.first_name || !form.last_name) { addToast('error', 'Name required.'); return }
    setSaving(true)
    await supabase.from('candidates').insert({ ...form, stage: 'applied', job_id: form.job_id || null })
    addToast('success', 'Candidate added.')
    setSaving(false)
    onSave()
  }
  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{t(lang, 'addCandidate')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">First Name <span className="required">*</span></label>
            <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Last Name <span className="required">*</span></label>
            <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Applying For</label>
          <select className="form-select" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}>
            <option value="">Select job...</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Rating (1-5)</label>
          <input className="form-input" type="number" min={1} max={5} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Resume URL</label>
          <input className="form-input" type="url" value={form.resume_url} onChange={e => setForm(f => ({ ...f, resume_url: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : t(lang, 'save')}</button>
      </div>
    </Modal>
  )
}

// ─── Messaging Module ─────────────────────────────────────────────────────────

function MessagingModule({ user, lang }: { user: Employee; lang: Lang }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [threads, setThreads] = useState<{ other: Employee; lastMsg: Message | null; unread: number }[]>([])
  const [activeThread, setActiveThread] = useState<Employee | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadEmployees() }, [])

  useEffect(() => {
    if (!activeThread) return
    loadMessages(activeThread.id)
    const channel = supabase.channel('msgs_' + user.id + '_' + activeThread.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message
          if ((msg.sender_id === user.id && msg.receiver_id === activeThread.id) ||
              (msg.sender_id === activeThread.id && msg.receiver_id === user.id)) {
            setMessages(prev => [...prev, msg])
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeThread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadEmployees = async () => {
    const { data: emps } = await supabase.from('employees').select('*').eq('status', 'active').neq('id', user.id).order('first_name')
    setEmployees(emps || [])
    // Build threads
    const { data: recentMsgs } = await supabase.from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const threadMap: Record<string, { other: Employee; lastMsg: Message; unread: number }> = {}
    for (const msg of recentMsgs || []) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
      const other = (emps || []).find(e => e.id === otherId)
      if (!other) continue
      if (!threadMap[otherId]) {
        threadMap[otherId] = { other, lastMsg: msg, unread: 0 }
      }
      if (!msg.read && msg.receiver_id === user.id) threadMap[otherId].unread++
    }
    setThreads(Object.values(threadMap))
  }

  const loadMessages = async (otherId: string) => {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at')
    setMessages(data || [])
    // Mark as read
    await supabase.from('messages').update({ read: true }).eq('receiver_id', user.id).eq('sender_id', otherId).eq('read', false)
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread) return
    setSending(true)
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeThread.id,
      content: newMsg.trim(),
      read: false,
    })
    setNewMsg('')
    setSending(false)
  }

  const filteredEmps = employees.filter(e =>
    !search || fullName(e).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'messaging')}</h1>
      </div>

      <div className="msg-layout">
        {/* Thread list */}
        <div className="msg-list">
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <input className="search-input" placeholder={t(lang, 'searchPeople')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: 12 }} />
          </div>

          {/* Existing threads */}
          {threads.filter(t => !search || fullName(t.other).toLowerCase().includes(search.toLowerCase())).map(thread => (
            <div key={thread.other.id} className={`msg-list-item ${activeThread?.id === thread.other.id ? 'active' : ''}`}
              onClick={() => setActiveThread(thread.other)}>
              <div className="flex items-center gap-8">
                <div className="avatar avatar-sm">{initials(thread.other)}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(thread.other)}</div>
                  <div className="text-xs text-muted2 truncate">{thread.lastMsg?.content || ''}</div>
                </div>
                {thread.unread > 0 && <span className="sidebar-badge">{thread.unread}</span>}
              </div>
            </div>
          ))}

          {/* All employees (for starting new conversations) */}
          {search && filteredEmps.filter(e => !threads.find(t => t.other.id === e.id)).map(emp => (
            <div key={emp.id} className={`msg-list-item ${activeThread?.id === emp.id ? 'active' : ''}`}
              onClick={() => { setActiveThread(emp); setMessages([]) }}>
              <div className="flex items-center gap-8">
                <div className="avatar avatar-sm">{initials(emp)}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fullName(emp)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Thread */}
        {!activeThread ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)' }}>
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-text">Select a conversation or search for someone</div>
            </div>
          </div>
        ) : (
          <div className="msg-thread">
            <div className="msg-thread-header">
              <div className="flex items-center gap-10">
                <div className="avatar avatar-md">{initials(activeThread)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(activeThread)}</div>
                  <div className="text-xs text-muted2">{activeThread.position || activeThread.role}</div>
                </div>
              </div>
            </div>

            <div className="msg-thread-body">
              {messages.length === 0 && (
                <div className="empty-state"><div className="empty-state-text">{t(lang, 'noMessages')}</div></div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender_id === user.id ? 'flex-end' : 'flex-start' }}>
                  <div className={`msg-bubble ${msg.sender_id === user.id ? 'mine' : 'theirs'}`}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>
                    {format(parseISO(msg.created_at), 'h:mm a')}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="msg-input-area">
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder={t(lang, 'typeMessage')}
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={!newMsg.trim() || sending}>
                <Icon.Send />{t(lang, 'send')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Locations Module ─────────────────────────────────────────────────────────

function LocationsModule({ user, lang, addToast }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editLoc, setEditLoc] = useState<Location | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('locations').select('*').order('name')
    setLocations(data || [])
    setLoading(false)
  }

  const deleteLoc = async (id: string) => {
    if (!confirm('Delete this location?')) return
    await supabase.from('locations').delete().eq('id', id)
    addToast('success', 'Location deleted.')
    loadData()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'locations')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditLoc(null); setShowModal(true) }}>
          <Icon.Plus />{t(lang, 'newLocation')}
        </button>
      </div>

      {loading ? <div className="loading-overlay"><span className="spinner" /></div> : (
        <div className="grid grid-auto gap-16">
          {locations.length === 0 && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📍</div>
                <div className="empty-state-text">{t(lang, 'noLocations')}</div>
              </div>
            </div>
          )}
          {locations.map(loc => (
            <div key={loc.id} className="card">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{loc.name}</div>
                  {loc.address && <div className="text-sm text-muted2 mt-4">{loc.address}</div>}
                </div>
                <div className="flex gap-4">
                  <button className="btn btn-ghost btn-icon" onClick={() => { setEditLoc(loc); setShowModal(true) }}><Icon.Edit /></button>
                  <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteLoc(loc.id)}><Icon.Trash /></button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {loc.lat && loc.lng && (
                  <div className="text-sm text-muted2">
                    <span style={{ color: 'var(--text3)' }}>GPS:</span> {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </div>
                )}
                {loc.radius_meters && (
                  <div className="flex items-center gap-6">
                    <Icon.MapPin />
                    <span className="text-sm">Geofence: {loc.radius_meters}m radius</span>
                  </div>
                )}
                {loc.timezone && <div className="text-sm text-muted2">TZ: {loc.timezone}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <LocationModal
          location={editLoc} lang={lang}
          onClose={() => { setShowModal(false); setEditLoc(null) }}
          onSave={() => { setShowModal(false); setEditLoc(null); loadData() }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function LocationModal({ location, lang, onClose, onSave, addToast }: { location: Location | null; lang: Lang; onClose: () => void; onSave: () => void; addToast: (type: Toast['type'], msg: string) => void }) {
  const [form, setForm] = useState({
    name: location?.name || '',
    address: location?.address || '',
    lat: location?.lat?.toString() || '',
    lng: location?.lng?.toString() || '',
    radius_meters: location?.radius_meters?.toString() || '100',
    timezone: location?.timezone || 'America/New_York',
    currency: location?.currency || 'USD',
  })
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  const detectLocation = () => {
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setDetecting(false) },
      () => { addToast('error', 'Could not detect location.'); setDetecting(false) }
    )
  }

  const save = async () => {
    if (!form.name) { addToast('error', 'Name required.'); return }
    setSaving(true)
    const payload = { name: form.name, address: form.address || null, lat: parseFloat(form.lat) || null, lng: parseFloat(form.lng) || null, radius_meters: parseInt(form.radius_meters) || 100, timezone: form.timezone, currency: form.currency }
    if (location?.id) await supabase.from('locations').update(payload).eq('id', location.id)
    else await supabase.from('locations').insert(payload)
    addToast('success', location ? 'Location updated.' : 'Location created.')
    setSaving(false)
    onSave()
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="modal-header">
        <h2 className="modal-title">{location ? 'Edit Location' : t(lang, 'newLocation')}</h2>
        <button className="btn-ghost btn-icon" onClick={onClose}><Icon.X /></button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Name <span className="required">*</span></label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">{t(lang, 'address')}</label>
          <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'latitude')}</label>
            <input className="form-input" type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'longitude')}</label>
            <input className="form-input" type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={detectLocation} disabled={detecting}>
          {detecting ? <span className="spinner" /> : <Icon.MapPin />}Detect Current Location
        </button>
        <div className="form-group">
          <label className="form-label">{t(lang, 'radiusMeters')}</label>
          <input className="form-input" type="number" min="10" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} />
          <span className="form-hint">Employees must be within this radius to clock in.</span>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t(lang, 'timezone')}</label>
            <select className="form-select" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Puerto_Rico'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'currency')}</label>
            <select className="form-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {['USD','EUR','GBP','CAD','MXN'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : t(lang, 'save')}</button>
      </div>
    </Modal>
  )
}

// ─── Settings Module ──────────────────────────────────────────────────────────

function SettingsModule({ user, lang, addToast, onThemeChange }: { user: Employee; lang: Lang; addToast: (type: Toast['type'], msg: string) => void; onThemeChange: () => void }) {
  const [tab, setTab] = useState('company')
  const [config, setConfig] = useState<{
    company_name: string; company_logo: string;
    payroll_config: PayrollConfig;
    geofencing_enabled: boolean;
    theme: ThemeConfig;
  }>({
    company_name: '',
    company_logo: '',
    payroll_config: { ...defaultPayrollConfig },
    geofencing_enabled: true,
    theme: { ...defaultTheme },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: cfg }, { data: emps }] = await Promise.all([
      supabase.from('app_config').select('*').single(),
      supabase.from('employees').select('*').eq('status', 'active').order('first_name'),
    ])
    if (cfg) {
      setConfig({
        company_name: cfg.company_name || '',
        company_logo: cfg.company_logo || '',
        payroll_config: { ...defaultPayrollConfig, ...(cfg.payroll_config || {}) },
        geofencing_enabled: cfg.geofencing_enabled ?? true,
        theme: { ...defaultTheme, ...(cfg.theme || {}) },
      })
      if (cfg.theme) applyTheme({ ...defaultTheme, ...cfg.theme })
    }
    setEmployees(emps || [])
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('app_config').upsert({
      id: 1,
      company_name: config.company_name,
      company_logo: config.company_logo,
      payroll_config: config.payroll_config,
      geofencing_enabled: config.geofencing_enabled,
      theme: config.theme,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (!error) {
      applyTheme(config.theme)
      onThemeChange()
      addToast('success', t(lang, 'saved'))
    } else {
      addToast('error', error.message)
    }
    setSaving(false)
  }

  const resetTheme = () => {
    setConfig(c => ({ ...c, theme: { ...defaultTheme } }))
    applyTheme(defaultTheme)
  }

  const pc = config.payroll_config
  const th = config.theme

  const TABS = [
    { id: 'company', label: t(lang, 'company') },
    { id: 'payroll', label: t(lang, 'payrollRules') },
    { id: 'geo', label: t(lang, 'geofencing') },
    { id: 'theme', label: t(lang, 'theme') },
    { id: 'users', label: t(lang, 'usersAndRoles') },
    { id: 'data', label: t(lang, 'dataManagement') },
  ]

  if (loading) return <div className="loading-overlay"><span className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">{t(lang, 'settings')}</h1>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : t(lang, 'save')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Nav */}
        <div className="card" style={{ padding: 0, height: 'fit-content' }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '11px 16px', fontSize: 13,
                background: tab === tabItem.id ? 'var(--v-dim)' : 'transparent',
                color: tab === tabItem.id ? 'var(--v3)' : 'var(--text2)',
                borderLeft: tab === tabItem.id ? '3px solid var(--v)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)', borderTop: 'none', borderRight: 'none',
                cursor: 'pointer', fontWeight: tab === tabItem.id ? 600 : 400,
              }}
            >{tabItem.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {tab === 'company' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 className="card-title">{t(lang, 'company')}</h3>
              <div className="form-group">
                <label className="form-label">{t(lang, 'companyName')}</label>
                <input className="form-input" value={config.company_name} onChange={e => setConfig(c => ({ ...c, company_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input className="form-input" type="url" placeholder="https://..." value={config.company_logo} onChange={e => setConfig(c => ({ ...c, company_logo: e.target.value }))} />
              </div>
            </div>
          )}

          {tab === 'payroll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 className="card-title">{t(lang, 'payrollRules')}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t(lang, 'dailyOtThreshold')}</label>
                  <input className="form-input" type="number" min="1" step="0.5" value={pc.dailyOtThreshold} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, dailyOtThreshold: parseFloat(e.target.value) || 8 } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t(lang, 'weeklyOtThreshold')}</label>
                  <input className="form-input" type="number" min="1" step="1" value={pc.weeklyOtThreshold} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, weeklyOtThreshold: parseFloat(e.target.value) || 40 } }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'otMultiplier')}</label>
                <input className="form-input" type="number" min="1" step="0.1" value={pc.otMultiplier} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, otMultiplier: parseFloat(e.target.value) || 1.5 } }))} />
              </div>
              <hr className="divider" />
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Tax & Deduction Rates</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Federal Tax %</label>
                  <input className="form-input" type="number" min="0" max="1" step="0.001" value={pc.federalTaxPct} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, federalTaxPct: parseFloat(e.target.value) || 0 } }))} />
                  <span className="form-hint">e.g. 0.12 = 12%</span>
                </div>
                <div className="form-group">
                  <label className="form-label">FICA %</label>
                  <input className="form-input" type="number" min="0" max="1" step="0.001" value={pc.ficaPct} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, ficaPct: parseFloat(e.target.value) || 0 } }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">State Tax %</label>
                  <input className="form-input" type="number" min="0" max="1" step="0.001" value={pc.stateTaxPct} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, stateTaxPct: parseFloat(e.target.value) || 0 } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Health Insurance ($)</label>
                  <input className="form-input" type="number" min="0" step="1" value={pc.healthInsurance} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, healthInsurance: parseFloat(e.target.value) || 0 } }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">401(k) %</label>
                <input className="form-input" type="number" min="0" max="1" step="0.001" value={pc.retirement401kPct} onChange={e => setConfig(c => ({ ...c, payroll_config: { ...c.payroll_config, retirement401kPct: parseFloat(e.target.value) || 0 } }))} />
              </div>
            </div>
          )}

          {tab === 'geo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 className="card-title">{t(lang, 'geofencing')}</h3>
              <label className="checkbox-row">
                <input type="checkbox" checked={config.geofencing_enabled} onChange={e => setConfig(c => ({ ...c, geofencing_enabled: e.target.checked }))} />
                <div>
                  <div style={{ fontWeight: 500 }}>{t(lang, 'geofencingEnabled')}</div>
                  <div className="text-sm text-muted2">When enabled, employees must be within their assigned location's radius to clock in.</div>
                </div>
              </label>
              {config.geofencing_enabled && (
                <div className="info-box"><Icon.Info />Geofence radii are configured per-location in the Locations module.</div>
              )}
            </div>
          )}

          {tab === 'theme' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="flex justify-between items-center">
                <h3 className="card-title">{t(lang, 'theme')}</h3>
                <button className="btn btn-secondary btn-sm" onClick={resetTheme}>{t(lang, 'resetTheme')}</button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Background</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.bg} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, bg: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Card Background</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.bg2} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, bg2: e.target.value } }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primary Color</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.v} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, v: e.target.value, v2: e.target.value, v3: e.target.value, v4: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Text Color</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.text} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, text: e.target.value } }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Success</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.success} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, success: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Danger</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.danger} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, danger: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Warning</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={th.warning} onChange={e => setConfig(c => ({ ...c, theme: { ...c.theme, warning: e.target.value } }))} />
                </div>
              </div>
              <div className="info-box"><Icon.Info />Theme preview updates live. Click Save to persist across sessions.</div>
            </div>
          )}

          {tab === 'users' && (
            <div>
              <h3 className="card-title mb-16">{t(lang, 'usersAndRoles')}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <div className="flex items-center gap-8">
                            <div className="avatar avatar-sm">{initials(emp)}</div>
                            <span style={{ fontWeight: 500 }}>{fullName(emp)}</span>
                          </div>
                        </td>
                        <td className="td-muted">{emp.email || '—'}</td>
                        <td><span className={`badge badge-${emp.role === 'admin' ? 'violet' : emp.role === 'manager' ? 'info' : 'muted'}`}>{emp.role}</span></td>
                        <td><span className="badge badge-success">{emp.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 className="card-title">{t(lang, 'dataManagement')}</h3>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Export</h4>
                <div className="flex gap-8">
                  <button className="btn btn-secondary" onClick={async () => {
                    const { data: emps } = await supabase.from('employees').select('*')
                    downloadFile(JSON.stringify(emps, null, 2), 'employees_backup.json', 'application/json')
                  }}><Icon.Download />Export Employees</button>
                  <button className="btn btn-secondary" onClick={async () => {
                    const { data: entries } = await supabase.from('time_entries').select('*').limit(10000)
                    downloadFile(JSON.stringify(entries, null, 2), 'timesheets_backup.json', 'application/json')
                  }}><Icon.Download />Export Timesheets</button>
                </div>
              </div>
              <hr className="divider" />
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>Danger Zone</h4>
                <div className="warn-box"><Icon.Alert />These actions are irreversible. Use with caution.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ user, lang, setLang, activePage, setActivePage, unreadCount, loadUnread, onLogout, children }: {
  user: Employee
  lang: Lang
  setLang: (l: Lang) => void
  activePage: Page
  setActivePage: (p: Page) => void
  unreadCount: number
  loadUnread: () => void
  onLogout: () => void
  children: React.ReactNode
}) {
  const PAGE_LABELS: Record<Page, string> = {
    dashboard: 'dashboard', clockinout: 'clockInOut', schedule: 'schedule',
    timesheets: 'timesheets', timeoff: 'timeOff', availability: 'availability',
    shiftswap: 'shiftSwap', employees: 'employees', hiring: 'hiring',
    messaging: 'messaging', payroll: 'payroll', reports: 'reports',
    documents: 'documents', notifications: 'notifications', locations: 'locations', settings: 'settings',
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        activePage={activePage}
        setActivePage={setActivePage}
        lang={lang}
        unreadCount={unreadCount}
        onLogout={onLogout}
      />
      <div className="main-area">
        <header className="topbar">
          <h2 className="topbar-title">{t(lang, PAGE_LABELS[activePage] as Parameters<typeof t>[1])}</h2>
          <div className="topbar-actions">
            <div className="lang-toggle">
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
              <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
            </div>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function StaffForce() {
  const [user, setUser] = useState<Employee | null>(null)
  const [lang, setLang] = useState<Lang>('en')
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [unreadCount, setUnreadCount] = useState(0)
  const { toasts, addToast } = useToast()

  // Load saved language
  useEffect(() => {
    const saved = localStorage.getItem('sf_lang') as Lang
    if (saved) setLang(saved)
  }, [])

  // Load theme from DB on mount
  useEffect(() => {
    supabase.from('app_config').select('theme').single().then(({ data }) => {
      if (data?.theme) applyTheme({ ...defaultTheme, ...data.theme })
    })
  }, [])

  // Unread notifications count
  const loadUnread = useCallback(async () => {
    if (!user) return
    const { count } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', user.id).eq('read', false)
    setUnreadCount(count || 0)
  }, [user])

  useEffect(() => {
    if (user) loadUnread()
  }, [user, loadUnread])

  // Update language preference
  const handleSetLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem('sf_lang', l)
    if (user) supabase.from('employees').update({ language: l }).eq('id', user.id)
  }

  const handleLogin = (emp: Employee) => {
    setUser(emp)
    if (emp.language) setLang(emp.language as Lang)
    // Set default page based on role
    if (emp.role === 'employee') setActivePage('clockinout')
    else setActivePage('dashboard')
  }

  const handleLogout = async () => {
    // signed out
    setUser(null)
    setActivePage('dashboard')
    setUnreadCount(0)
  }

  if (!user) {
    return (
      <>
        <Head>
          <title>StaffForce — Workforce Management</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <LoginScreen onLogin={handleLogin} lang={lang} setLang={handleSetLang} />
        <ToastContainer toasts={toasts} />
      </>
    )
  }

  const renderPage = () => {
    const props = { user, lang, addToast }

    switch (activePage) {
      case 'dashboard':      return <DashboardModule user={user} lang={lang} />
      case 'clockinout':     return <ClockModule {...props} />
      case 'schedule':       return <ScheduleModule {...props} />
      case 'timesheets':     return <TimesheetsModule {...props} />
      case 'timeoff':        return <TimeOffModule {...props} />
      case 'availability':   return <AvailabilityModule {...props} />
      case 'shiftswap':      return <ShiftSwapModule {...props} />
      case 'employees':
        return user.role !== 'employee' ? <EmployeesModule {...props} /> : <DashboardModule user={user} lang={lang} />
      case 'hiring':
        return user.role !== 'employee' ? <HiringModule {...props} /> : <DashboardModule user={user} lang={lang} />
      case 'messaging':      return <MessagingModule user={user} lang={lang} />
      case 'payroll':
        return user.role === 'admin' ? <PayrollModule {...props} /> : <DashboardModule user={user} lang={lang} />
      case 'reports':
        return user.role !== 'employee' ? <ReportsModule user={user} lang={lang} /> : <DashboardModule user={user} lang={lang} />
      case 'documents':      return <DocumentsModule {...props} />
      case 'notifications':  return <NotificationsModule {...props} onRead={loadUnread} />
      case 'locations':
        return user.role === 'admin' ? <LocationsModule {...props} /> : <DashboardModule user={user} lang={lang} />
      case 'settings':
        return user.role === 'admin' ? <SettingsModule {...props} onThemeChange={loadUnread} /> : <DashboardModule user={user} lang={lang} />
      default:               return <DashboardModule user={user} lang={lang} />
    }
  }

  return (
    <>
      <Head>
        <title>StaffForce — Workforce Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Complete workforce management platform" />
      </Head>
      <AppShell
        user={user}
        lang={lang}
        setLang={handleSetLang}
        activePage={activePage}
        setActivePage={setActivePage}
        unreadCount={unreadCount}
        loadUnread={loadUnread}
        onLogout={handleLogout}
      >
        {renderPage()}
      </AppShell>
      <ToastContainer toasts={toasts} />
    </>
  )
}
