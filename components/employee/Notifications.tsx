import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import type { Employee, Notification } from '../../types'

interface Props { user: Employee; lang: string; onCountChange?: (n: number) => void }

export default function Notifications({ user, lang, onCountChange }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([])

  useEffect(() => {
    load()
    const ch = supabase.channel('notifs-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `employee_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('employee_id', user.id).order('created_at' as any, { ascending:false })
    const n: Notification[] = data || []
    setNotifs(n)
    onCountChange?.(n.filter(x => !x.read).length)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read:true }).eq('id', id); load()
  }
  async function markAll() {
    await supabase.from('notifications').update({ read:true }).eq('employee_id', user.id); load()
  }
  async function deleteAll() {
    await supabase.from('notifications').delete().eq('employee_id', user.id).eq('read', true); load()
  }

  const unread = notifs.filter(n => !n.read).length

  const typeColor: Record<string, string> = {
    success: '#059669', error: '#DC2626', info: '#0A6EBD', warning: '#D97706'
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:900, color:'#111827' }}>Notifications</div>
          <div style={{ fontSize:13, color:'#64748B', marginTop:2 }}>{unread} unread</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAll}>Mark All Read</button>}
          <button className="btn btn-secondary btn-sm" onClick={deleteAll}>Clear Read</button>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        {notifs.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <div className="empty-state-title">No notifications</div>
            <div className="empty-state-sub">You're all caught up</div>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} style={{ padding:'14px 20px', borderBottom:'1px solid #F8FAFC', background:n.read?'transparent':'#FAFBFF', display:'flex', gap:14, alignItems:'flex-start', transition:'background 0.15s' }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:n.read?'#E2E8F0':typeColor[n.type]||'#0A6EBD', marginTop:5, flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#111827' }}>{n.title}</div>
              <div style={{ fontSize:12, color:'#64748B', marginTop:3, lineHeight:1.5 }}>{n.message}</div>
              <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>{n.created_at ? format(new Date(n.created_at as any),'MMM d, HH:mm') : ''}</div>
            </div>
            {!n.read && (
              <button className="btn btn-secondary btn-sm" onClick={()=>markRead(n.id)} style={{ flexShrink:0 }}>Mark Read</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
