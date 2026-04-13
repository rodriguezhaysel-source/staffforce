import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee } from '../../types'

interface Props { onLogin: (emp: Employee) => void }

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password_hash', password.trim())
      .eq('status', 'active')
      .in('role', ['admin'])
    const emp = data?.[0]
    if (!emp) {
      setError('Access denied. Admin credentials required.')
      setLoading(false)
      return
    }
    onLogin(emp)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0D1117' }}>
      {/* Left — brand */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 72px', color: '#fff' }}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 56 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>StaffForce</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Control Panel</div>
            </div>
          </div>

          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginBottom: 18, letterSpacing: '-1.5px' }}>
            Owner<br /><span style={{ color: '#60A5FA' }}>Dashboard</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: 48 }}>
            Complete visibility and control over your workforce operations.
          </p>

          {[
            { icon: '⚡', text: 'Real-time labor cost and coverage' },
            { icon: '📅', text: 'Visual schedule with position color scale' },
            { icon: '💰', text: 'One-click payroll processing and NACHA export' },
            { icon: '📊', text: 'Executive reports with charts' },
            { icon: '👥', text: 'Full employee lifecycle management' },
            { icon: '🔒', text: 'Audit log — every change, every user' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 13 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{item.icon}</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div style={{ width: 460, background: '#161B22', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F9FAFB', marginBottom: 6, letterSpacing: '-0.5px' }}>Admin Login</div>
          <div style={{ fontSize: 14, color: '#4B5563' }}>Restricted access — owners only</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com" required
              style={{ width: '100%', padding: '11px 14px', background: '#0D1117', border: '1.5px solid #21262D', borderRadius: 8, fontSize: 14, color: '#F9FAFB', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any }}
              onFocus={e => e.target.style.borderColor = '#2563EB'}
              onBlur={e => e.target.style.borderColor = '#21262D'}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ width: '100%', padding: '11px 14px', background: '#0D1117', border: '1.5px solid #21262D', borderRadius: 8, fontSize: 14, color: '#F9FAFB', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any }}
              onFocus={e => e.target.style.borderColor = '#2563EB'}
              onBlur={e => e.target.style.borderColor = '#21262D'}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FCA5A5', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#1D4ED8' : '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
          >
            {loading ? 'Signing in...' : 'Access Control Panel'}
          </button>
        </form>

        <div style={{ marginTop: 32, padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Employee portal</div>
          <a href="/" style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>← Go to employee login</a>
        </div>
      </div>
    </div>
  )
}
