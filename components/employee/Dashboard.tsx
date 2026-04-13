import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, addDays, differenceInMinutes } from 'date-fns'
import { entryHours, getDeptColor } from '../../lib/utils'
import { Card, Kpi, Badge, Avatar, C } from '../ui'
import type { Employee, Department, Location, Shift, TimeEntry } from '../../types'

interface Props {
  user: Employee
  lang: string
  employees: Employee[]
  departments: Department[]
  locations: Location[]
}

export default function Dashboard({ user, lang, employees, departments, locations }: Props) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [weeklyData, setWeeklyData] = useState<{ day: string; hours: number }[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [now, setNow] = useState(new Date())
  const canSeeAll = user.role === 'admin' || user.role === 'manager'

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    load()
    const ch = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 })
    const wsStr = format(ws, 'yyyy-MM-dd')
    const [ae, ts, we, pa, pto, notifs, ms] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('shifts').select('*').gte('start_time', today).lte('start_time', today + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', wsStr).not('clock_out', 'is', null),
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('time_off').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('employee_id', user.id).eq('read', false),
      supabase.from('shifts').select('*').eq('employee_id', user.id).gte('start_time', today).order('start_time'),
    ])
    setActiveEntries(ae.data || [])
    setTodayShifts(ts.data || [])
    setWeekEntries(we.data || [])
    setPendingApprovals((pa.count || 0) + (pto.count || 0))
    setUnreadNotifs(notifs.count || 0)
    setMyShifts(ms.data || [])
    // Build weekly chart data
    const entries: TimeEntry[] = we.data || []
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i)
      const key = format(d, 'yyyy-MM-dd')
      const hrs = entries.filter(e => e.clock_in?.slice(0, 10) === key).reduce((s, e) => s + entryHours(e), 0)
      return { day: format(d, 'EEE'), hours: Math.round(hrs * 10) / 10 }
    })
    setWeeklyData(days)
  }

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
  const myCurrentShift = myShifts.find(s => {
    const start = new Date(new Date(s.start_time).getTime() - 30 * 60000)
    return now >= start && now <= new Date(s.end_time)
  })
  const myNextShift = myShifts.find(s => new Date(s.start_time) > now)
  const maxHours = Math.max(...weeklyData.map(d => d.hours), 1)

  return (
    <div>
      {/* My shift banner */}
      {(myCurrentShift || myNextShift) && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: myCurrentShift ? '#F0FDF4' : '#EFF6FF', border: `1px solid ${myCurrentShift ? '#BBF7D0' : '#BFDBFE'}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: myCurrentShift ? '#059669' : '#2563EB', boxShadow: myCurrentShift ? '0 0 0 3px rgba(5,150,105,0.2)' : undefined, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: myCurrentShift ? '#065F46' : '#1D4ED8' }}>
              {myCurrentShift ? 'You are on shift now' : 'Next shift today'}
            </div>
            <div style={{ fontSize: 12, color: myCurrentShift ? '#059669' : '#2563EB', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              {format(new Date((myCurrentShift || myNextShift)!.start_time), 'HH:mm')} — {format(new Date((myCurrentShift || myNextShift)!.end_time), 'HH:mm')}
              {(myCurrentShift || myNextShift)!.position ? ` · ${(myCurrentShift || myNextShift)!.position}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Admin KPIs */}
      {canSeeAll && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Kpi label="Clocked In" value={clockedInCount} sub={`of ${totalActive} active`} color={clockedInCount > 0 ? C.success : C.textMuted} />
          <Kpi label="Not Clocked" value={notClockedCount} sub="active staff" color={notClockedCount > 3 ? C.warning : C.textMuted} />
          <Kpi label="Late Today" value={lateEmployees.length} sub=">15 min" color={lateEmployees.length > 0 ? C.danger : C.success} />
          <Kpi label="Week Hours" value={weekHours.toFixed(1) + 'h'} sub="current week" color={C.accent} />
          <Kpi label="Labor Cost" value={'$' + Math.round(laborCost).toLocaleString()} sub="week accrued" color={C.accent} />
          <Kpi label="Pending Actions" value={pendingApprovals} sub="need review" color={pendingApprovals > 0 ? C.danger : C.success} />
        </div>
      )}

      {/* Employee KPIs */}
      {!canSeeAll && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {(() => {
            const myHrs = [...activeEntries, ...weekEntries].filter(e => e.employee_id === user.id).reduce((s, e) => s + entryHours(e), 0)
            const myWeek = weekEntries.filter(e => e.employee_id === user.id).reduce((s, e) => s + entryHours(e), 0)
            return <>
              <Kpi label="Today's Hours" value={myHrs.toFixed(1) + 'h'} sub="worked today" color={C.accent} />
              <Kpi label="This Week" value={myWeek.toFixed(1) + 'h'} sub="total hours" color={C.accent} />
              <Kpi label="Notifications" value={unreadNotifs} sub="unread" color={unreadNotifs > 0 ? C.danger : C.textMuted} />
            </>
          })()}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: canSeeAll ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Weekly hours chart */}
        {canSeeAll && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 16 }}>Week Hours by Day</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {weeklyData.map((d, i) => {
                const pct = maxHours > 0 ? (d.hours / maxHours) : 0
                const isToday = i === Math.min(6, Math.max(0, new Date().getDay() === 0 ? 6 : new Date().getDay() - 1))
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>{d.hours > 0 ? d.hours : ''}</div>
                    <div style={{ width: '100%', height: Math.max(4, pct * 90), background: isToday ? C.accent : d.hours > 0 ? '#BFDBFE' : '#F1F5F9', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? C.accent : C.textMuted }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Today's coverage */}
        {canSeeAll && todayShifts.length > 0 && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Today's Coverage</div>
              <span style={{ fontSize: 12, color: C.textSub }}>{format(new Date(), 'EEE, MMM d')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {todayShifts.map(s => {
                const emp = employees.find(e => e.id === s.employee_id)
                const dept = departments.find(d => d.id === s.department_id)
                const deptColor = getDeptColor(s.department_id, departments)
                const clocked = activeEntries.find(e => e.employee_id === s.employee_id)
                const shiftStart = new Date(s.start_time)
                const isLate = !clocked && differenceInMinutes(now, shiftStart) > 15
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: isLate ? '#FEF2F2' : clocked ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${isLate ? '#FECACA' : clocked ? '#BBF7D0' : C.border}` }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isLate ? C.danger : clocked ? C.success : C.textMuted, flexShrink: 0 }} />
                    <Avatar emp={emp} size={26} color={deptColor} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp?.first_name} {emp?.last_name?.[0]}. <span style={{ fontWeight: 400, color: C.textSub }}>· {s.position || emp?.position}</span></div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>{format(new Date(s.start_time), 'HH:mm')} — {format(new Date(s.end_time), 'HH:mm')}</div>
                    </div>
                    {isLate && <Badge color="red">LATE {differenceInMinutes(now, shiftStart)}m</Badge>}
                    {clocked && <Badge color="green">IN</Badge>}
                    {!isLate && !clocked && new Date(s.start_time) > now && <Badge color="gray">UPCOMING</Badge>}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Late employees detail */}
        {canSeeAll && lateEmployees.length > 0 && (
          <Card style={{ borderLeft: `4px solid ${C.danger}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.danger, marginBottom: 12 }}>⚠ Late Employees</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lateEmployees.map(s => {
                const emp = employees.find(e => e.id === s.employee_id)
                const mins = differenceInMinutes(now, new Date(s.start_time))
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar emp={emp} size={28} color={C.danger} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{emp?.first_name} {emp?.last_name}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{emp?.position} · {s.position}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.danger, fontFamily: 'var(--font-mono)' }}>{mins}m late</div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Department breakdown */}
        {canSeeAll && departments.length > 0 && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 12 }}>Department Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {departments.map(dept => {
                const deptEmps = employees.filter(e => e.department_id === dept.id && e.status === 'active')
                const deptClocked = activeEntries.filter(ae => deptEmps.find(e => e.id === ae.employee_id))
                const pct = deptEmps.length > 0 ? Math.round(deptClocked.length / deptEmps.length * 100) : 0
                return (
                  <div key={dept.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{dept.name}</span>
                      <span style={{ fontSize: 12, color: C.textSub, fontFamily: 'var(--font-mono)' }}>{deptClocked.length}/{deptEmps.length}</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: dept.color || C.accent, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
