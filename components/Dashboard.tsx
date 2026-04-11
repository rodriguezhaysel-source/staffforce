import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, startOfWeek, addDays, differenceInMinutes } from 'date-fns'
import { entryHours } from './shared/utils'
import type { Employee, Department, Location, Shift, TimeEntry, Notification } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[]; locations: Location[] }

export default function Dashboard({ user, lang, employees, departments, locations }: Props) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [openTimeOff, setOpenTimeOff] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [now, setNow] = useState(new Date())

  const canSeeAll = user.role === 'admin' || user.role === 'manager'

  useEffect(() => {
    load()
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  // Realtime: clock entries
  useEffect(() => {
    const ch = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ws = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const [ae, ts, we, pa, pto, notifs, ms] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('shifts').select('*').gte('start_time', today).lte('start_time', today + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', ws).not('clock_out', 'is', null),
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('time_off').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('employee_id', user.id).eq('read', false),
      supabase.from('shifts').select('*').eq('employee_id', user.id).gte('start_time', today).order('start_time'),
    ])
    setActiveEntries(ae.data || [])
    setTodayShifts(ts.data || [])
    setWeekEntries(we.data || [])
    setPendingApprovals((pa.count||0) + (pto.count||0))
    setOpenTimeOff(pto.count || 0)
    setUnreadNotifs(notifs.count || 0)
    setMyShifts(ms.data || [])
  }

  // Compute stats
  const totalActive = employees.filter(e => e.status === 'active').length
  const clockedInCount = activeEntries.length
  const notClockedCount = totalActive - clockedInCount

  const lateEmployees = todayShifts.filter(s => {
    const shiftStart = new Date(s.start_time)
    const isClocked = activeEntries.find(e => e.employee_id === s.employee_id)
    return !isClocked && differenceInMinutes(now, shiftStart) > 15
  })

  const weekHours = weekEntries.reduce((s, e) => s + entryHours(e), 0)

  const laborCost = [...activeEntries, ...weekEntries].reduce((sum, e) => {
    const emp = employees.find(em => em.id === e.employee_id)
    if (!emp) return sum
    const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
    return sum + entryHours(e) * rate
  }, 0)

  const openShifts = todayShifts.filter(s => !activeEntries.find(e => e.employee_id === s.employee_id)).length

  const myCurrentShift = myShifts.find(s => {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    return now >= new Date(start.getTime() - 30*60000) && now <= end
  })

  const myNextShift = myShifts.find(s => new Date(s.start_time) > now)

  return (
    <div>
      {/* Personal shift card — always visible */}
      {(myCurrentShift || myNextShift) && (
        <div style={{ marginBottom: 16 }}>
          {myCurrentShift && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', boxShadow: '0 0 0 3px rgba(5,150,105,0.2)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#065F46' }}>You are on shift now</div>
                <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>
                  {format(new Date(myCurrentShift.start_time), 'HH:mm')} — {format(new Date(myCurrentShift.end_time), 'HH:mm')} · {myCurrentShift.position}
                </div>
              </div>
            </div>
          )}
          {!myCurrentShift && myNextShift && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1D4ED8' }}>Next shift today</div>
                <div style={{ fontSize: 12, color: '#2563EB', marginTop: 2 }}>
                  {format(new Date(myNextShift.start_time), 'HH:mm')} — {format(new Date(myNextShift.end_time), 'HH:mm')} · {myNextShift.position}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Grid */}
      {canSeeAll && (
        <div className="stats-grid">
          {[
            { label: 'Clocked In', value: clockedInCount, sub: `of ${totalActive} active`, color: clockedInCount > 0 ? '#059669' : '#94A3B8' },
            { label: 'Not Clocked', value: notClockedCount, sub: 'active employees', color: notClockedCount > 3 ? '#D97706' : '#94A3B8' },
            { label: 'Week Hours', value: weekHours.toFixed(1), sub: 'current week', color: '#2563EB', mono: true },
            { label: 'Labor Cost', value: `$${Math.round(laborCost)}`, sub: 'week accrued', color: '#2563EB', mono: true },
            { label: 'Late Today', value: lateEmployees.length, sub: '>15 min', color: lateEmployees.length > 0 ? '#DC2626' : '#94A3B8' },
            { label: 'Approvals', value: pendingApprovals, sub: 'pending', color: pendingApprovals > 0 ? '#DC2626' : '#059669' },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color, fontFamily: (k as any).mono ? 'var(--font-mono)' : 'inherit' }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* My personal stats */}
      {!canSeeAll && (
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
          {[
            { label: 'My Hours Today', value: (() => { const te = [...activeEntries, ...weekEntries].filter(e=>e.employee_id===user.id); return te.reduce((s,e)=>s+entryHours(e),0).toFixed(1) })(), sub: 'hours worked', color: '#2563EB', mono: true },
            { label: 'This Week', value: weekEntries.filter(e=>e.employee_id===user.id).reduce((s,e)=>s+entryHours(e),0).toFixed(1), sub: 'hours', color: '#2563EB', mono: true },
            { label: 'Notifications', value: unreadNotifs, sub: 'unread', color: unreadNotifs > 0 ? '#DC2626' : '#94A3B8' },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color, fontFamily: (k as any).mono ? 'var(--font-mono)' : 'inherit' }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Today's shift coverage */}
      {canSeeAll && todayShifts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Today's Coverage</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>{format(new Date(), 'EEEE, MMM d')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayShifts.map(s => {
              const emp = employees.find(e => e.id === s.employee_id)
              const dept = departments.find(d => d.id === s.department_id)
              const color = dept?.color || '#2563EB'
              const clocked = activeEntries.find(e => e.employee_id === s.employee_id)
              const shiftStart = new Date(s.start_time)
              const isLate = !clocked && differenceInMinutes(now, shiftStart) > 15
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: isLate ? '#FEF2F2' : clocked ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${isLate ? '#FECACA' : clocked ? '#BBF7D0' : '#E2E6EC'}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isLate ? '#DC2626' : clocked ? '#059669' : '#94A3B8', flexShrink: 0 }} />
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: color }}>
                    {(emp as any)?.avatar_url ? <img src={(emp as any).avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (emp?.first_name?.[0]||'')+(emp?.last_name?.[0]||'')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{emp?.first_name} {emp?.last_name?.[0]}. <span style={{ fontWeight: 500, color: '#64748B', fontSize: 12 }}>· {s.position || emp?.position}</span></div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{format(new Date(s.start_time), 'HH:mm')} — {format(new Date(s.end_time), 'HH:mm')}</div>
                  </div>
                  {isLate && <span className="badge badge-danger">LATE {differenceInMinutes(now, shiftStart)}m</span>}
                  {clocked && <span className="badge badge-success">CLOCKED IN</span>}
                  {!isLate && !clocked && new Date(s.start_time) > now && <span className="badge badge-gray">UPCOMING</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
