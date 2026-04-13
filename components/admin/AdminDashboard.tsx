import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, addDays, differenceInMinutes } from 'date-fns'
import { empName, entryHours, getDeptColor, fmtMoney } from '../../lib/utils'
import { ACard, AKpi, ABadge, AAvatar, AC } from './ui'
import type { Employee, Department, Location, Shift, TimeEntry } from '../../types'

interface Props { user: Employee; employees: Employee[]; departments: Department[]; locations: Location[] }

export default function AdminDashboard({ user, employees, departments, locations }: Props) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [pendingTimesheets, setPendingTimesheets] = useState(0)
  const [pendingPTO, setPendingPTO] = useState(0)
  const [weeklyChart, setWeeklyChart] = useState<{ day: string; hours: number; cost: number }[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    load()
    const timer = setInterval(() => { setNow(new Date()); load() }, 30000)
    const ch = supabase.channel('adm-dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ws = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const [ae, ts, we, pt, pto] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('shifts').select('*').gte('start_time', today).lte('start_time', today + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', ws).not('clock_out', 'is', null),
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('time_off').select('id', { count: 'exact' }).eq('status', 'pending'),
    ])
    setActiveEntries(ae.data || [])
    setTodayShifts(ts.data || [])
    setWeekEntries(we.data || [])
    setPendingTimesheets(pt.count || 0)
    setPendingPTO(pto.count || 0)

    // Weekly chart
    const entries: TimeEntry[] = we.data || []
    const chart = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
      const key = format(d, 'yyyy-MM-dd')
      const dayEntries = entries.filter(e => e.clock_in?.slice(0, 10) === key)
      const hours = dayEntries.reduce((s, e) => s + entryHours(e), 0)
      const cost = dayEntries.reduce((s, e) => {
        const emp = employees.find(em => em.id === e.employee_id)
        if (!emp) return s
        const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
        return s + entryHours(e) * rate
      }, 0)
      return { day: format(d, 'EEE'), hours: Math.round(hours * 10) / 10, cost: Math.round(cost) }
    })
    setWeeklyChart(chart)
  }

  const activeCount = employees.filter(e => e.status === 'active').length
  const clockedIn = activeEntries.length
  const notClockedIn = activeCount - clockedIn
  const lateList = todayShifts.filter(s => {
    const clocked = activeEntries.find(e => e.employee_id === s.employee_id)
    return !clocked && differenceInMinutes(now, new Date(s.start_time)) > 10
  })
  const weekHours = weekEntries.reduce((s, e) => s + entryHours(e), 0)
  const weekCost = weekEntries.reduce((s, e) => {
    const emp = employees.find(em => em.id === e.employee_id)
    if (!emp) return s
    const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
    return s + entryHours(e) * rate
  }, 0)
  const pendingTotal = pendingTimesheets + pendingPTO
  const maxHours = Math.max(...weeklyChart.map(d => d.hours), 1)
  const maxCost = Math.max(...weeklyChart.map(d => d.cost), 1)
  const todayIdx = Math.min(6, new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)

  return (
    <div>
      {/* Pending alerts bar */}
      {(pendingTotal > 0 || lateList.length > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, flexWrap: 'wrap' as any }}>
          {lateList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: AC.danger }} />
              {lateList.length} employee{lateList.length > 1 ? 's' : ''} late today
            </div>
          )}
          {pendingTimesheets > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: AC.warning }} />
              {pendingTimesheets} timesheets pending approval
            </div>
          )}
          {pendingPTO > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: AC.warning }} />
              {pendingPTO} PTO requests pending
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="adm-kpi-grid">
        <AKpi label="Clocked In Now" value={clockedIn} sub={`of ${activeCount} active`} color={clockedIn > 0 ? AC.success : AC.muted} accent={AC.success} />
        <AKpi label="Not Clocked In" value={notClockedIn} sub="should be working" color={notClockedIn > 2 ? AC.danger : AC.muted} accent={notClockedIn > 2 ? AC.danger : AC.muted} />
        <AKpi label="Late Today" value={lateList.length} sub=">10 min past shift start" color={lateList.length > 0 ? AC.danger : AC.success} accent={lateList.length > 0 ? AC.danger : AC.success} />
        <AKpi label="Week Hours" value={weekHours.toFixed(1) + 'h'} sub="current week" color={AC.accent} accent={AC.accent} />
        <AKpi label="Week Labor Cost" value={'$' + Math.round(weekCost).toLocaleString()} sub="accrued this week" color={AC.purple} accent={AC.purple} />
        <AKpi label="Pending Actions" value={pendingTotal} sub="need your review" color={pendingTotal > 0 ? AC.warning : AC.success} accent={pendingTotal > 0 ? AC.warning : AC.success} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Weekly hours chart */}
        <ACard>
          <div style={{ fontWeight: 800, fontSize: 14, color: AC.text, marginBottom: 4 }}>Hours This Week</div>
          <div style={{ fontSize: 12, color: AC.sub, marginBottom: 16 }}>Total: {weekHours.toFixed(1)}h</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {weeklyChart.map((d, i) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: AC.muted, fontFamily: 'IBM Plex Mono, monospace' }}>{d.hours > 0 ? d.hours : ''}</div>
                <div style={{ width: '100%', height: Math.max(4, (d.hours / maxHours) * 84), background: i === todayIdx ? AC.accent : '#BFDBFE', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: i === todayIdx ? AC.accent : AC.muted }}>{d.day}</div>
              </div>
            ))}
          </div>
        </ACard>

        {/* Weekly cost chart */}
        <ACard>
          <div style={{ fontWeight: 800, fontSize: 14, color: AC.text, marginBottom: 4 }}>Labor Cost This Week</div>
          <div style={{ fontSize: 12, color: AC.sub, marginBottom: 16 }}>Total: {fmtMoney(weekCost)}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {weeklyChart.map((d, i) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: AC.muted, fontFamily: 'IBM Plex Mono, monospace' }}>{d.cost > 0 ? '$' + d.cost.toLocaleString() : ''}</div>
                <div style={{ width: '100%', height: Math.max(4, (d.cost / maxCost) * 84), background: i === todayIdx ? AC.purple : '#DDD6FE', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: i === todayIdx ? AC.purple : AC.muted }}>{d.day}</div>
              </div>
            ))}
          </div>
        </ACard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Live status */}
        <ACard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Live — Who's Working Now</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: AC.success }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: AC.success, animation: 'pulse 2s infinite' }} />
              LIVE
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {activeEntries.map(ae => {
              const emp = employees.find(e => e.id === ae.employee_id)
              const dept = departments.find(d => d.id === emp?.department_id)
              const mins = ae.clock_in ? differenceInMinutes(now, new Date(ae.clock_in)) : 0
              const hrs = Math.floor(mins / 60), m = mins % 60
              return (
                <div key={ae.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: AC.success, flexShrink: 0 }} />
                  <AAvatar emp={emp} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{empName(emp)}</div>
                    <div style={{ fontSize: 10, color: AC.sub }}>{emp?.position} · {dept?.name}</div>
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: AC.success }}>{hrs}h {m}m</div>
                </div>
              )
            })}
            {activeEntries.length === 0 && <div style={{ fontSize: 13, color: AC.muted, textAlign: 'center', padding: '20px 0' }}>No one clocked in right now</div>}
          </div>
        </ACard>

        {/* Late + Not Clocked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lateList.length > 0 && (
            <ACard style={{ borderLeft: `4px solid ${AC.danger}` }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: AC.danger, marginBottom: 12 }}>⚠ Late Employees</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lateList.map(s => {
                  const emp = employees.find(e => e.id === s.employee_id)
                  const mins = differenceInMinutes(now, new Date(s.start_time))
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AAvatar emp={emp} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{empName(emp)}</div>
                        <div style={{ fontSize: 10, color: AC.sub }}>Shift started {format(new Date(s.start_time), 'HH:mm')}</div>
                      </div>
                      <ABadge color="red">{mins}m late</ABadge>
                    </div>
                  )
                })}
              </div>
            </ACard>
          )}

          {/* Department coverage */}
          <ACard>
            <div style={{ fontWeight: 800, fontSize: 14, color: AC.text, marginBottom: 12 }}>Department Coverage</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {departments.map(dept => {
                const deptEmps = employees.filter(e => e.department_id === dept.id && e.status === 'active')
                const clocked = activeEntries.filter(ae => deptEmps.find(e => e.id === ae.employee_id)).length
                const pct = deptEmps.length > 0 ? Math.round(clocked / deptEmps.length * 100) : 0
                return (
                  <div key={dept.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{dept.name}</span>
                      <span style={{ fontSize: 11, color: AC.sub, fontFamily: 'IBM Plex Mono, monospace' }}>{clocked}/{deptEmps.length}</span>
                    </div>
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: dept.color || AC.accent, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </ACard>
        </div>
      </div>
    </div>
  )
}
