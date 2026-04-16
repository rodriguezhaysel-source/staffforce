import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { empName } from '../../lib/utils'
import type { Employee, Availability as AvailType } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[] }
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

export default function Availability({ user, lang, employees }: Props) {
  const [avail, setAvail] = useState<AvailType[]>([])
  const [filterEmp, setFilterEmp] = useState(user.id)
  const [saving, setSaving] = useState(false)
  const canEdit = user.role === 'admin' || user.role === 'manager' || filterEmp === user.id

  useEffect(() => { load() }, [filterEmp])

  async function load() {
    const { data } = await supabase.from('availability').select('*').eq('employee_id', filterEmp)
    setAvail(data || [])
  }

  function getDay(dow: number) { return avail.find(a => a.day_of_week === dow) }

  async function toggle(dow: number) {
    if (!canEdit) return
    setSaving(true)
    const ex = getDay(dow)
    if (ex) {
      await supabase.from('availability').update({ available: !ex.available }).eq('id', ex.id)
    } else {
      await supabase.from('availability').insert({ employee_id:filterEmp, day_of_week:dow, available:true, start_time:'09:00', end_time:'17:00' })
    }
    setSaving(false); load()
  }

  async function updateTime(dow: number, field: 'start_time'|'end_time', val: string) {
    if (!canEdit) return
    const ex = getDay(dow)
    if (ex) { await supabase.from('availability').update({ [field]:val }).eq('id', ex.id); load() }
  }

  const viewEmp = employees.find(e=>e.id===filterEmp)

  return (
    <div>
      {(user.role === 'admin' || user.role === 'manager') && (
        <div className="card" style={{ padding:14, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.5px' }}>Viewing</label>
            <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={{ padding:'7px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', minWidth:220 }}>
              {employees.filter(e=>e.status==='active').map(e=><option key={e.id} value={e.id}>{empName(e)}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>Weekly Availability</div>
            {viewEmp && <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{empName(viewEmp)} · {viewEmp.position}</div>}
          </div>
          {saving && <div style={{ fontSize:12, color:'#64748B' }}>Saving...</div>}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {DAYS.map((day, i) => {
            const dow = i + 1
            const a = getDay(dow)
            return (
              <div key={dow} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 0', borderBottom:'1px solid #F8FAFC' }}>
                <div style={{ width:110, fontWeight:600, fontSize:13, color:a?.available?'#111827':'#94A3B8' }}>{day}</div>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:canEdit?'pointer':'default' }}>
                  <div
                    onClick={() => canEdit && toggle(dow)}
                    style={{ width:40, height:22, borderRadius:11, background:a?.available?'var(--primary)':'#E2E8F0', position:'relative', transition:'all 0.2s', cursor:canEdit?'pointer':'default', flexShrink:0 }}
                  >
                    <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:a?.available?20:2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:a?.available?'#059669':'#94A3B8' }}>
                    {a?.available ? 'Available' : 'Unavailable'}
                  </span>
                </label>
                {a?.available && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
                    <input type="time" value={a.start_time||'09:00'} onChange={e=>canEdit&&updateTime(dow,'start_time',e.target.value)} disabled={!canEdit} style={{ padding:'5px 8px', border:'1.5px solid var(--border)', borderRadius:7, fontSize:13, fontFamily:'var(--font-mono)', outline:'none', width:100 }} />
                    <span style={{ fontSize:12, color:'#94A3B8' }}>to</span>
                    <input type="time" value={a.end_time||'17:00'} onChange={e=>canEdit&&updateTime(dow,'end_time',e.target.value)} disabled={!canEdit} style={{ padding:'5px 8px', border:'1.5px solid var(--border)', borderRadius:7, fontSize:13, fontFamily:'var(--font-mono)', outline:'none', width:100 }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
