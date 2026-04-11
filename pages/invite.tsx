import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function InvitePage() {
  const [step, setStep] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [employee, setEmployee] = useState<any>(null)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) { setStep('error'); return }
    setToken(t)
    validateToken(t)
  }, [])

  async function validateToken(t: string) {
    const { data } = await supabase.from('invite_tokens').select('*, employees(*)').eq('token', t).eq('used', false)
    if (!data || data.length === 0) { setStep('error'); return }
    const invite = data[0]
    if (new Date(invite.expires_at) < new Date()) { setStep('error'); return }
    setEmployee(invite.employees)
    setStep('form')
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleActivate() {
    setError('')
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (pin && (pin.length < 4 || pin.length > 6)) { setError('PIN must be 4-6 digits'); return }

    let avatar_url = ''
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `avatars/${employee.id}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('staffforce').upload(path, photoFile, { upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('staffforce').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }
    }

    const updates: any = { password_hash: password, status: 'active' }
    if (pin) updates.pin = pin
    if (avatar_url) updates.avatar_url = avatar_url

    await supabase.from('employees').update(updates).eq('id', employee.id)
    await supabase.from('invite_tokens').update({ used: true }).eq('token', token)

    await supabase.from('onboarding_tasks').insert([
      { employee_id: employee.id, task: 'Complete your profile', due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
      { employee_id: employee.id, task: 'Add your bank account', due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
      { employee_id: employee.id, task: 'Upload required documents', due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
      { employee_id: employee.id, task: 'Review your schedule', due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) },
    ])

    setStep('done')
    setTimeout(() => { window.location.href = '/' }, 3000)
  }

  if (step === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0F1A2E 0%, #0A6EBD 100%)' }}>
      <div style={{ color: '#fff', fontSize: 16 }}>Verifying your invitation...</div>
    </div>
  )

  if (step === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0F1A2E 0%, #0A6EBD 100%)', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>X</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invalid or Expired Link</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>This invitation link is invalid or has expired. Please contact your administrator for a new invitation.</p>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0F1A2E 0%, #0A6EBD 100%)', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Account Activated!</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>Welcome {employee?.first_name}! Redirecting you to the app...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0F1A2E 0%, #0A6EBD 100%)', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, maxWidth: 460, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1A2E', marginBottom: 4 }}>Activate Your Account</h1>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Welcome, {employee?.first_name} {employee?.last_name}</p>
          <p style={{ color: '#9CA3AF', fontSize: 12 }}>{employee?.position}</p>
        </div>

        {/* Photo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: photoPreview ? 'transparent' : '#0A6EBD', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', margin: '0 auto 8px', border: '3px solid #E5E7EB' }}>
              {photoPreview
                ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{employee?.first_name?.[0]}{employee?.last_name?.[0]}</span>
              }
            </div>
            <label style={{ cursor: 'pointer', fontSize: 12, color: '#0A6EBD', fontWeight: 600 }}>
              {photoPreview ? 'Change photo' : 'Add profile photo'}
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Password *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
        </div>

        {/* PIN */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>PIN (optional — for quick clock-in)</label>
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} placeholder="4-6 digits" style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', letterSpacing: 8, textAlign: 'center' }} />
        </div>

        {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button onClick={handleActivate} style={{ width: '100%', padding: '13px', background: '#0A6EBD', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Activate Account
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 16 }}>
          You can complete your profile, add bank accounts, and upload documents after logging in.
        </p>
      </div>
    </div>
  )
}
