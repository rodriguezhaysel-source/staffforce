import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import type { Employee, Notification } from '../lib/store'

interface Props { user: Employee; lang: string; onCountChange?: (n: number) => void }

export default function Notifications({ user, lang, onCountChange }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([])

  useEffect(() => { load(); const ch = supabase.channel('notifs-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `employee_id=eq.${user.id}` }, () => load()).subscribe(); return () => { supabase.removeChannel(ch) } }, [])

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('employee_id', user.id).order('created_at' as any, { ascending: false })
    const n: Notification[] = data || []
    setNotifs(n)
    onCountChange && onCountChange(n.filter(x => !x.read).length)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id); load()
  }

  async function markAll() {
    await supabase.from('notifications').update({ read: true }).eq('employee_id', user.id); load()
  }

  const unread = notifs.filter(n => !n.read).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{unread} unread</div>
        {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAll}>{t(lang, 'markAllRead')}</button>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {notifs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-title">{t(lang, 'noNotifications')}</div></div>
        ) : notifs.map(n => (
          <div key={n.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', background: n.read ? undefined : '#F0F7FF', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'var(--color-border)' : 'var(--color-accent)', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{n.created_at ? format(new Date(n.created_at as any), 'MMM d, HH:mm') : ''}</div>
            </div>
            {!n.read && <button className="btn btn-secondary btn-sm" onClick={() => markRead(n.id)}>{t(lang, 'markRead')}</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
