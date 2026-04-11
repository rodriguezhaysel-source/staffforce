import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import type { Employee } from '../lib/store'
import { Modal } from './shared/Modal'

interface Props {
  onLogin: (emp: Employee) => void
}

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
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>StaffForce</h1>
          <p>Workforce Management Platform</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div className="topbar-lang">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
          </div>
        </div>
        <div className="login-toggle">
          <button className={mode === 'email' ? 'active' : ''} onClick={() => setMode('email')}>{t(lang, 'loginWithEmail')}</button>
          <button className={mode === 'pin' ? 'active' : ''} onClick={() => setMode('pin')}>{t(lang, 'loginWithPin')}</button>
        </div>
        {mode === 'email' ? (
          <>
            <div className="form-group">
              <label>{t(lang, 'email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
            </div>
            <div className="form-group">
              <label>{t(lang, 'password')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={handleEmailLogin}>{t(lang, 'login')}</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 13 }} onClick={() => setForgotOpen(true)}>{t(lang, 'forgotPassword')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label>{t(lang, 'pin')}</label>
              <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePinLogin()} placeholder="4-6 digits" style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={handlePinLogin}>{t(lang, 'login')}</button>
          </>
        )}
        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}
      </div>

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
    </div>
  )
}
