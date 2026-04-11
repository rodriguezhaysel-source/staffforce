import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format } from 'date-fns'
import { Icon } from './shared/Icons'
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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadContacts() }, [])
  useEffect(() => { if (active) { loadMessages(active.id); subscribeMessages(active.id) } }, [active])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContacts() {
    const { data } = await supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    const msgs: Message[] = data || []
    const ids = new Set<string>()
    msgs.forEach(m => { if (m.sender_id !== user.id) ids.add(m.sender_id); if (m.receiver_id !== user.id) ids.add(m.receiver_id) })
    setContacts(employees.filter(e => ids.has(e.id)))
  }

  async function loadMessages(otherId: string) {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  function subscribeMessages(otherId: string) {
    const ch = supabase.channel('chat-' + user.id + '-' + otherId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadMessages(otherId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }

  async function send() {
    if (!input.trim() || !active) return
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: active.id, content: input.trim(), read: false, created_at: new Date().toISOString() })
    setInput(''); loadMessages(active.id)
  }

  function handleSearch(q: string) {
    setSearch(q)
    if (q.trim()) {
      setSearchResults(employees.filter(e => e.id !== user.id && empName(e).toLowerCase().includes(q.toLowerCase())).slice(0, 6))
    } else { setSearchResults([]) }
  }

  function startConv(emp: Employee) {
    if (!contacts.find(c => c.id === emp.id)) setContacts(prev => [emp, ...prev])
    setActive(emp); setSearch(''); setSearchResults([])
  }

  return (
    <div style={{ height: 'calc(100vh - 110px)' }}>
      <div className="messaging-layout" style={{ height: '100%' }}>
        <div className="conversations-list">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
            <input placeholder={t(lang, 'search') + '...'} value={search} onChange={e => handleSearch(e.target.value)} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {searchResults.map(e => (
                  <div key={e.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontSize: 13 }} onClick={() => startConv(e)}>
                    {empName(e)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {contacts.map(e => (
            <div key={e.id} className={`conversation-item ${active?.id === e.id ? 'active' : ''}`} onClick={() => { setActive(e); loadMessages(e.id) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{empInitials(e)}</div>
                <div>
                  <div className="conversation-name">{empName(e)}</div>
                  <div className="conversation-preview">{e.position}</div>
                </div>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>Search to start a conversation</div>}
        </div>

        <div className="chat-window">
          {active ? (
            <>
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{empInitials(active)}</div>
                  {empName(active)}
                </div>
              </div>
              <div className="chat-messages">
                {messages.map(m => (
                  <div key={m.id} className={`chat-bubble ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
                    <div>{m.content}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{m.created_at ? format(new Date(m.created_at), 'HH:mm') : ''}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="chat-input-row">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder={t(lang, 'typeMessage')} onKeyDown={e => e.key === 'Enter' && send()} />
                <button className="btn btn-primary" onClick={send}><Icon name="send" size={14} /></button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <Icon name="messaging" size={40} color="var(--color-border)" />
              <div className="empty-state-title" style={{ marginTop: 12 }}>Select a conversation</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
