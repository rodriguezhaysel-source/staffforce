import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { Modal } from './shared/Modal'
import type { Employee } from '../lib/store'

interface Props { onLogin: (emp: Employee) => void }

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<'email' | 'pin'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotNew, setForgotNew] = useState('')
  const [lang, setLang] = useState<'en' | 'es'>('en')

  async function handleEmailLogin() {
    setError('')
    const em = email.trim().toLowerCase()
    const pw = password.trim()
    const { data } = await supabase.from('employees').select('*').eq('email', em)
    const list: Employee[] = data || []
    const emp = list.find(e => e.password_hash === pw)
    if (emp) { onLogin(emp) } else { setError(t(lang, 'invalidCredentials')) }
  }

  async function handlePinLogin() {
    setError('')
    const { data } = await supabase.from('employees').select('*').eq('pin', pin.trim()).eq('status', 'active')
    const list: Employee[] = data || []
    if (list.length > 0) { onLogin(list[0]) } else { setError(t(lang, 'invalidPin')) }
  }

  async function handleForgotPassword() {
    setError('')
    const em = forgotEmail.trim().toLowerCase()
    const { data } = await supabase.from('employees').select('id').eq('email', em)
    if (!data || data.length === 0) { setError(t(lang, 'emailNotFound')); return }
    const { error: err } = await supabase.from('employees').update({ password_hash: forgotNew.trim() }).eq('email', em)
    if (err) { setError(t(lang, 'error')) } else {
      setSuccess(t(lang, 'passwordReset'))
      setForgotOpen(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #0F1A2E 0%, #1a2d4a 50%, #0A6EBD 100%)',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        color: '#fff',
      }} className="login-left-panel">
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>StaffForce</span>
          </div>

          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-1px' }}>
            Workforce Management<br />
            <span style={{ color: '#60A5FA' }}>Built for Teams</span>
          </h1>

          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 48 }}>
            Schedule, track time, process payroll and manage your entire team from one powerful platform.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '◎', text: 'Real-time scheduling and attendance' },
              { icon: '◈', text: 'Automated payroll with direct deposit' },
              { icon: '◉', text: 'Smart notifications and approvals' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#60A5FA', flexShrink: 0 }}>{item.icon}</div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        width: 480,
        minWidth: 480,
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 52px',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.25)',
      }} className="login-right-panel">

        {/* Lang toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
          <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setLang('en')} style={{ padding: '6px 16px', border: 'none', background: lang === 'en' ? '#0A6EBD' : 'transparent', color: lang === 'en' ? '#fff' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>EN</button>
            <button onClick={() => setLang('es')} style={{ padding: '6px 16px', border: 'none', background: lang === 'es' ? '#0A6EBD' : 'transparent', color: lang === 'es' ? '#fff' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ES</button>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8, letterSpacing: '-0.5px' }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#6B7280' }}>Sign in to your account to continue</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 28 }}>
          <button onClick={() => setMode('email')} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: mode === 'email' ? '#FFFFFF' : 'transparent',
            color: mode === 'email' ? '#111827' : '#6B7280',
            boxShadow: mode === 'email' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>{t(lang, 'loginWithEmail')}</button>
          <button onClick={() => setMode('pin')} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: mode === 'pin' ? '#FFFFFF' : 'transparent',
            color: mode === 'pin' ? '#111827' : '#6B7280',
            boxShadow: mode === 'pin' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>{t(lang, 'loginWithPin')}</button>
        </div>

        {mode === 'email' ? (
          <div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t(lang, 'email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                placeholder="you@company.com"
                style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#111827', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#0A6EBD'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t(lang, 'password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                placeholder="Your password"
                style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#111827', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#0A6EBD'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>
            <button onClick={handleEmailLogin} style={{
              width: '100%', padding: '14px', background: '#0A6EBD', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(10,110,189,0.35)', transition: 'all 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0860a8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0A6EBD')}
            >{t(lang, 'login')}</button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setForgotOpen(true)} style={{ background: 'none', border: 'none', color: '#0A6EBD', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                {t(lang, 'forgotPassword')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t(lang, 'pin')}</label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePinLogin()}
                placeholder="Enter your PIN"
                style={{ width: '100%', padding: '16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 28, fontFamily: 'var(--font-mono)', letterSpacing: 14, textAlign: 'center', outline: 'none', boxSizing: 'border-box', color: '#111827', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#0A6EBD'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
              <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>4 to 6 digits</div>
            </div>
            <button onClick={handlePinLogin} style={{
              width: '100%', padding: '14px', background: '#0A6EBD', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(10,110,189,0.35)',
            }}>{t(lang, 'login')}</button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ marginTop: 16, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#059669', fontWeight: 500 }}>{success}</div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #F3F4F6', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
          StaffForce — Workforce Management Platform
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title={t(lang, 'resetPassword')}>
        <div className="modal-body">
          <div className="form-group"><label>{t(lang, 'email')}</label><input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} /></div>
          <div className="form-group"><label>{t(lang, 'newPassword')}</label><input type="password" value={forgotNew} onChange={e => setForgotNew(e.target.value)} /></div>
          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setForgotOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={handleForgotPassword}>{t(lang, 'resetPassword')}</button>
        </div>
      </Modal>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { width: 100% !important; min-width: 0 !important; padding: 40px 32px !important; }
        }
      `}</style>
    </div>
  )
}
