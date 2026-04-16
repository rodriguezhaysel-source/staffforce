import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { Card, Btn, Popup, Inp, Sel, C, EmptyState, Badge, PageHeader } from '../ui'
import type { Employee, Announcement, Department } from '../../types'

interface Props { user: Employee; lang: string; departments: Department[] }

export default function Announcements({ user, lang, departments }: Props) {
  const [items, setItems] = useState<Announcement[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', target: 'all' })
  const [saving, setSaving] = useState(false)
  const canCreate = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .or(`target.eq.all,target.eq.${user.department_id}`)
      .order('created_at', { ascending: false })
    setItems(data || [])
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    await supabase.from('announcements').insert({ ...form, created_by: user.id })
    // Notify all employees
    const { data: emps } = await supabase.from('employees').select('id').eq('status', 'active')
    if (emps) {
      await supabase.from('notifications').insert(
        emps.map((e: any) => ({ employee_id: e.id, title: form.title, message: form.body.slice(0, 120), type: 'info', read: false }))
      )
    }
    setSaving(false)
    setOpen(false)
    setForm({ title: '', body: '', target: 'all' })
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader title="Announcements" sub="Company-wide and department announcements">
        {canCreate && <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>+ New Announcement</Btn>}
      </PageHeader>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(item => (
          <Card key={item.id} style={{ borderLeft: `4px solid ${C.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 4 }}>{item.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge color={item.target === 'all' ? 'blue' : 'purple'}>
                    {item.target === 'all' ? 'All Staff' : departments.find(d => d.id === item.target)?.name || item.target}
                  </Badge>
                  <span style={{ fontSize: 11, color: C.textMuted }}>
                    {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy · HH:mm') : ''}
                  </span>
                </div>
              </div>
              {canCreate && (
                <Btn variant="danger" size="sm" onClick={() => del(item.id)}>Delete</Btn>
              )}
            </div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{item.body}</p>
          </Card>
        ))}
        {items.length === 0 && <Card><EmptyState title="No announcements" sub="Announcements from your company will appear here" /></Card>}
      </div>

      <Popup open={open} onClose={() => setOpen(false)} title="New Announcement">
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Important update..." />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>Message</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={6}
              placeholder="Write your announcement here..."
              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any }}
            />
          </div>
          <Sel label="Target Audience" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
            <option value="all">All Staff</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Posting...' : 'Post Announcement'}</Btn>
        </div>
      </Popup>
    </div>
  )
}
