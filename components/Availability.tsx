import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { empName } from './shared/utils'
import type { Employee, Availability as AvailType } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

export default function Availability({ user, lang, employees }: Props) {
  const [avail, setAvail] = useState<AvailType[]>([])
  const [filterEmp, setFilterEmp] = useState(user.id)
  const canEdit = user.role === 'admin' || user.role === 'manager' || filterEmp === user.id

  useEffect(() => { load() }, [filterEmp])

  async function load() {
    const { data } = await supabase.from('availability').select('*').eq('employee_id', filterEmp)
    setAvail(data || [])
  }

  function getDay(dow: number) { return avail.find(a => a.day_of_week === dow) }

  async function toggle(dow: number) {
    const ex = getDay(dow)
    if (ex) { await supabase.from('availability').update({ available: !ex.available }).eq('id', ex.id) }
    else { await supabase.from('availability').insert({ employee_id: filterEmp, day_of_week: dow, available: true, start_time: '09:00', end_time: '17:00' }) }
    load()
  }

  async function updateTime(dow: number, field: 'start_time' | 'end_time', val: string) {
    const ex = getDay(dow)
    if (ex) { await supabase.from('availability').update({ [field]: val }).eq('id', ex.id); load() }
  }

  return (
    <div>
      {(user.role === 'admin' || user.role === 'manager') && (
        <div style={{ marginBottom: 16 }}>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ width: 220 }}>
            {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
          </select>
        </div>
      )}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>Availability</div>
        {DAYS.map((day, i) => {
          const dow = i + 1
          const a = getDay(dow)
          return (
            <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ width: 100, fontWeight: 600, fontSize: 13 }}>{day}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', fontSize: 13, fontWeight: 500 }}>
                <input type="checkbox" checked={a?.available || false} onChange={() => canEdit && toggle(dow)} style={{ width: 16, height: 16 }} />
                Available
              </label>
              {a?.available && <>
                <input type="time" value={a.start_time || '09:00'} onChange={e => canEdit && updateTime(dow, 'start_time', e.target.value)} style={{ width: 100 }} />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>to</span>
                <input type="time" value={a.end_time || '17:00'} onChange={e => canEdit && updateTime(dow, 'end_time', e.target.value)} style={{ width: 100 }} />
              </>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
