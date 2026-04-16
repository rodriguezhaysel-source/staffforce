import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import type { Employee, Lang } from '../../types'

interface Props {
  onLogin: (emp: Employee) => void
  lang: Lang
  setLang: (l: Lang) => void
}

export default function Login({ onLogin, lang, setLang }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.employee) {
        setError(data.error || 'Invalid email or password')
        setLoading(false)
        return
      }
      onLogin(data.employee)
    } catch (err: any) {
      setError('Login failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0F1A2E 0%, #1a2e42 60%, #0D2B4E 100%)' }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, color: '#fff' }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #0A6EBD, #095AA3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(10,110,189,0.4)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>StaffForce</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Workforce Management</div>
            </div>
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1.5px' }}>
            Manage Your<br /><span style={{ color: '#60A5FA' }}>Workforce</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: 48 }}>
            Clock in, view your schedule, request time off, and stay connected with your team — all in one place.
          </p>
          {[
            { icon: '🗓', text: 'Visual schedule with shift management' },
            { icon: '⏱', text: 'GPS-verified clock in/out with geofencing' },
            { icon: '💰', text: 'Payroll processing with direct deposit' },
            { icon: '📊', text: 'Real-time attendance and labor reports' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(10,110,189,0.2)', border: '1px solid rgba(10,110,189,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 480, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', boxShadow: '-24px 0 80px rgba(0,0,0,0.3)' }}>
        {/* Lang switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {(['en', 'es'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 14px', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: lang === l ? '#0A6EBD' : 'transparent', color: lang === l ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginBottom: 6, letterSpacing: '-0.5px' }}>Employee Login</h2>
          <p style={{ fontSize: 14, color: '#64748B' }}>Sign in to access your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any }} onFocus={e => e.target.style.borderColor = '#0A6EBD'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any }} onFocus={e => e.target.style.borderColor = '#0A6EBD'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
          </div>
          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: '#0A6EBD', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 32, padding: '16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Need help?</div>
          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>Contact your manager or HR administrator to get your login credentials or reset your password.</p>
        </div>
      </div>
    </div>
  )
}
