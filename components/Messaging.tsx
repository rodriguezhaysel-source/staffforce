import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { empName, empInitials } from './shared/utils'
import type { Employee, Message } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Messaging({ user, lang, employees }: Props) {
  const [contacts, setContacts] = useState<Employee[]>([])
  const [active, setActive] = useState<Employee | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Employee[]>([])
  const [unreadMap, setUnreadMap] = useState<Record<string,number>>({})
  const endRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => { loadContacts() }, [])
  useEffect(() => {
    if (active) {
      loadMessages(active.id)
      markRead(active.id)
      // Realtime
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = supabase.channel('chat-' + user.id + '-' + active.id)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, () => {
          loadMessages(active.id); markRead(active.id)
        })
        .subscribe()
    }
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [active])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function loadContacts() {
    const { data } = await supabase.from('messages').select('sender_id,receiver_id').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    const msgs: any[] = data || []
    const ids = new Set<string>()
    msgs.forEach(m => {
      if (m.sender_id !== user.id) ids.add(m.sender_id)
      if (m.receiver_id !== user.id) ids.add(m.receiver_id)
    })
    const contactEmps = employees.filter(e => ids.has(e.id))
    setContacts(contactEmps)
    // Load unread counts
    const { data: unread } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('read', false)
    const counts: Record<string,number> = {}
    ;(unread||[]).forEach((m:any) => { counts[m.sender_id] = (counts[m.sender_id]||0) + 1 })
    setUnreadMap(counts)
  }

  async function loadMessages(otherId: string) {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending:true })
    setMessages(data || [])
  }

  async function markRead(senderId: string) {
    await supabase.from('messages').update({ read:true }).eq('sender_id', senderId).eq('receiver_id', user.id).eq('read', false)
    setUnreadMap(m => ({ ...m, [senderId]:0 }))
  }

  async function send() {
    if (!input.trim() || !active) return
    const msg = input.trim()
    setInput('')
    await supabase.from('messages').insert({ sender_id:user.id, receiver_id:active.id, content:msg, read:false, created_at:new Date().toISOString() })
    loadMessages(active.id)
  }

  function handleSearch(q: string) {
    setSearch(q)
    if (q.trim()) {
      setSearchResults(employees.filter(e => e.id!==user.id && e.status==='active' && empName(e).toLowerCase().includes(q.toLowerCase())).slice(0,6))
    } else { setSearchResults([]) }
  }

  function startConv(emp: Employee) {
    if (!contacts.find(c=>c.id===emp.id)) setContacts(prev=>[emp,...prev])
    setActive(emp); setSearch(''); setSearchResults([])
  }

  const getDeptColor = (emp?: Employee) => '#0A6EBD'

  return (
    <div style={{ height:'calc(100vh - 220px)', minHeight:400 }}>
      <div className="messaging-layout" style={{ height:'100%' }}>
        {/* Contact list */}
        <div className="conversations-list">
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', position:'relative' }}>
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                placeholder="Search people..."
                value={search}
                onChange={e=>handleSearch(e.target.value)}
                style={{ width:'100%', padding:'7px 10px 7px 30px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--bg-main)' }}
              />
            </div>
            {searchResults.length > 0 && (
              <div style={{ position:'absolute', left:14, right:14, top:'100%', background:'#fff', border:'1px solid var(--border)', borderRadius:8, zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
                {searchResults.map(e=>(
                  <div key={e.id} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:9, borderBottom:'1px solid var(--border)' }} onClick={()=>startConv(e)}>
                    <div className="avatar" style={{ width:28, height:28, fontSize:10, background:'var(--primary)', flexShrink:0 }}>{empInitials(e)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{empName(e)}</div>
                      <div style={{ fontSize:11, color:'#94A3B8' }}>{e.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {contacts.length===0 && <div style={{ padding:20, fontSize:12, color:'#94A3B8', textAlign:'center' }}>Search to start a conversation</div>}
          {contacts.map(e=>(
            <div key={e.id} className={`conversation-item ${active?.id===e.id?'active':''}`} onClick={()=>{setActive(e);loadMessages(e.id)}}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div className="avatar" style={{ width:34, height:34, fontSize:11, background:'var(--primary)', overflow:'hidden' }}>
                    {(e as any).avatar_url ? <img src={(e as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : empInitials(e)}
                  </div>
                  {(unreadMap[e.id]||0) > 0 && <div style={{ position:'absolute', top:-2, right:-2, width:16, height:16, borderRadius:'50%', background:'#DC2626', color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff' }}>{unreadMap[e.id]}</div>}
                </div>
                <div>
                  <div className="conversation-name" style={{ fontWeight:(unreadMap[e.id]||0)>0?800:600 }}>{empName(e)}</div>
                  <div className="conversation-preview">{e.position}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat window */}
        <div className="chat-window">
          {active ? (
            <>
              <div className="chat-header">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className="avatar" style={{ width:32, height:32, fontSize:11, background:'var(--primary)', overflow:'hidden' }}>
                    {(active as any).avatar_url ? <img src={(active as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : empInitials(active)}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{empName(active)}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{active.position}</div>
                  </div>
                </div>
              </div>
              <div className="chat-messages">
                {messages.map(m=>(
                  <div key={m.id} className={`chat-bubble ${m.sender_id===user.id?'mine':'theirs'}`}>
                    <div>{m.content}</div>
                    <div style={{ fontSize:10, opacity:0.65, marginTop:4 }}>{m.created_at?format(new Date(m.created_at),'HH:mm'):''}{m.sender_id===user.id&&<span style={{ marginLeft:6 }}>{m.read?'✓✓':'✓'}</span>}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="chat-input-row">
                <input
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
                  style={{ flex:1, padding:'9px 14px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }}
                  onFocus={e=>e.target.style.borderColor='var(--primary)'}
                  onBlur={e=>e.target.style.borderColor='var(--border)'}
                />
                <button className="btn btn-primary btn-sm" onClick={send} disabled={!input.trim()}>Send</button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ margin:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <div className="empty-state-title" style={{ marginTop:12 }}>Select a conversation</div>
              <div className="empty-state-sub">Or search for someone to message</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
