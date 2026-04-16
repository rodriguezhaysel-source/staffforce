import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName } from '../../lib/utils'
import { Card, Btn, Popup, Sel, C, EmptyState, Badge, PageHeader, Avatar } from '../ui'
import type { Employee, Recognition } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[] }

const CATEGORIES = ['teamwork', 'innovation', 'leadership', 'customer service', 'above & beyond', 'punctuality']
const CAT_COLORS: Record<string, 'blue'|'green'|'purple'|'yellow'|'gray'> = {
  teamwork: 'blue', innovation: 'purple', leadership: 'green',
  'customer service': 'yellow', 'above & beyond': 'green', punctuality: 'gray',
}

export default function Recognitions({ user, lang, employees }: Props) {
  const [items, setItems] = useState<Recognition[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ to_employee_id: '', message: '', category: 'teamwork' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('recognitions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data || [])
  }

  async function save() {
    if (!form.to_employee_id || !form.message.trim()) return
    setSaving(true)
    await supabase.from('recognitions').insert({ ...form, from_employee_id: user.id })
    const toEmp = employees.find(e => e.id === form.to_employee_id)
    if (toEmp) {
      await supabase.from('notifications').insert({
        employee_id: form.to_employee_id,
        title: '🌟 You received a recognition!',
        message: `${empName(user)} recognized you for ${form.category}: "${form.message.slice(0, 80)}"`,
        type: 'success',
        read: false,
      })
    }
    setSaving(false)
    setOpen(false)
    setForm({ to_employee_id: '', message: '', category: 'teamwork' })
    load()
  }

  const myReceived = items.filter(r => r.to_employee_id === user.id).length
  const myGiven = items.filter(r => r.from_employee_id === user.id).length

  return (
    <div>
      <PageHeader title="Recognitions" sub="Recognize your teammates for great work">
        <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>🌟 Recognize Someone</Btn>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Recognitions', value: items.length, color: C.accent },
          { label: 'You Received', value: myReceived, color: '#7C3AED' },
          { label: 'You Gave', value: myGiven, color: C.success },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(r => {
          const from = employees.find(e => e.id === r.from_employee_id)
          const to = employees.find(e => e.id === r.to_employee_id)
          const isForMe = r.to_employee_id === user.id
          return (
            <Card key={r.id} style={{ borderLeft: `4px solid ${isForMe ? '#7C3AED' : C.border}`, background: isForMe ? '#FAFAFF' : '#fff' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>🌟</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' as any }}>
                    <Avatar emp={from} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{empName(from)}</span>
                    <span style={{ fontSize: 12, color: C.textSub }}>recognized</span>
                    <Avatar emp={to} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{empName(to)}</span>
                    <Badge color={CAT_COLORS[r.category] || 'gray'}>{r.category}</Badge>
                    {isForMe && <Badge color="purple">You!</Badge>}
                  </div>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>"{r.message}"</p>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                    {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy · HH:mm') : ''}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
        {items.length === 0 && <Card><EmptyState title="No recognitions yet" sub="Be the first to recognize a teammate!" /></Card>}
      </div>

      <Popup open={open} onClose={() => setOpen(false)} title="Recognize a Teammate">
        <div style={{ padding: '20px 24px' }}>
          <Sel label="Recognize Who" value={form.to_employee_id} onChange={e => setForm(f => ({ ...f, to_employee_id: e.target.value }))}>
            <option value="">Select a teammate...</option>
            {employees.filter(e => e.id !== user.id && e.status === 'active').map(e => (
              <option key={e.id} value={e.id}>{empName(e)} — {e.position}</option>
            ))}
          </Sel>
          <Sel label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </Sel>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              placeholder="Tell them what they did great..."
              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any }}
            />
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Sending...' : '🌟 Send Recognition'}</Btn>
        </div>
      </Popup>
    </div>
  )
}
