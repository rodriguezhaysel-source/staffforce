import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, addDays, differenceInMinutes, isAfter, startOfWeek } from 'date-fns'
import { empName, empInitials, fmtMoney, fmtHours, entryHours } from './shared/utils'
import { Icon } from './shared/Icons'
import type { Employee, Department, TimeEntry, TimeOff, Shift, Document } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[] }

export default function Dashboard({ user, lang, employees, departments }: Props) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [pendingTimeOffs, setPendingTimeOffs] = useState<TimeOff[]>([])
  const [pendingTimesheets, setPendingTimesheets] = useState<TimeEntry[]>([])
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([])
  const [expiringDocs, setExpiringDocs] = useState<Document[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => { load() }, [])

  async function load() {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const todayEnd = format(new Date(), "yyyy-MM-dd'T'23:59:59")
    const thirtyDays = format(addDays(new Date(), 30), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')

    const [a, w, pto, pts, sh, d] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('time_entries').select('*').gte('clock_in', weekStart),
      supabase.from('time_off').select('*').eq('status', 'pending'),
      supabase.from('time_entries').select('*').eq('status', 'pending'),
      supabase.from('shifts').select('*').gte('start_time', new Date().toISOString()).lte('start_time', todayEnd),
      supabase.from('documents').select('*').lte('expiry_date', thirtyDays).gt('expiry_date', today),
    ])
    setActiveEntries(a.data || [])
    setWeekEntries(w.data || [])
    setPendingTimeOffs(pto.data || [])
    setPendingTimesheets(pts.data || [])
    setUpcomingShifts(sh.data || [])
    setExpiringDocs(d.data || [])
  }

  const weekHours = weekEntries.reduce((acc, e) => acc + entryHours(e), 0)
  const laborCost = weekEntries.reduce((acc, e) => {
    const emp = employees.find(em => em.id === e.employee_id)
    if (!emp) return acc
    const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
    return acc + entryHours(e) * rate
  }, 0)
  const lateToday = upcomingShifts.filter(s => !activeEntries.find(e => e.employee_id === s.employee_id) && isAfter(now, new Date(s.start_time))).length

  return (
    <div>
      <div className="stat-grid">
        {[
          { label: t(lang, 'clockedInNow'), value: activeEntries.length, sub: t(lang, 'employees') },
          { label: t(lang, 'hoursThisWeek'), value: weekHours.toFixed(1), sub: t(lang, 'hours') },
          { label: t(lang, 'laborCostMtd'), value: fmtMoney(laborCost), sub: '', mono: true, sm: true },
          { label: t(lang, 'pendingTimeOff'), value: pendingTimeOffs.length, sub: t(lang, 'pending') },
          { label: t(lang, 'pendingApprovals'), value: pendingTimesheets.length, sub: 'timesheets' },
          { label: t(lang, 'lateToday'), value: lateToday, sub: t(lang, 'employees'), danger: lateToday > 0 },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: s.sm ? 20 : undefined, color: s.danger ? 'var(--color-danger)' : undefined }}>{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t(lang, 'whosIn')}</span>
            <span className="badge badge-success">{activeEntries.length}</span>
          </div>
          {activeEntries.length === 0
            ? <div className="empty-state"><div className="empty-state-sub">{t(lang, 'noData')}</div></div>
            : activeEntries.slice(0, 8).map(e => {
              const emp = employees.find(em => em.id === e.employee_id)
              const mins = differenceInMinutes(now, new Date(e.clock_in))
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="avatar">{empInitials(emp)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{empName(emp)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{emp?.position}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--color-success)' }}>{fmtHours(mins)}</span>
                </div>
              )
            })
          }
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{t(lang, 'upcomingShifts')}</span></div>
          {upcomingShifts.length === 0
            ? <div className="empty-state"><div className="empty-state-sub">{t(lang, 'noData')}</div></div>
            : upcomingShifts.slice(0, 8).map(s => {
              const emp = employees.find(em => em.id === s.employee_id)
              const dept = departments.find(d => d.id === s.department_id)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="avatar" style={{ background: dept?.color || 'var(--color-accent)' }}>{empInitials(emp)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{empName(emp)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{format(new Date(s.start_time), 'HH:mm')} - {format(new Date(s.end_time), 'HH:mm')}</div>
                  </div>
                  {dept && <span className="badge" style={{ background: dept.color + '22', color: dept.color }}>{dept.name}</span>}
                </div>
              )
            })
          }
        </div>

        {expiringDocs.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t(lang, 'alerts')}</span><span className="badge badge-warning">{expiringDocs.length}</span></div>
            {expiringDocs.map(d => (
              <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <Icon name="alert" size={16} color="var(--color-warning)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{empName(employees.find(e => e.id === d.employee_id))} - expires {d.expiry_date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(pendingTimesheets.length > 0 || pendingTimeOffs.length > 0) && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t(lang, 'pendingApprovals')}</span></div>
            {pendingTimesheets.length > 0 && <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 6, fontSize: 13 }}><strong>{pendingTimesheets.length}</strong> timesheet entries pending</div>}
            {pendingTimeOffs.length > 0 && <div style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 6, fontSize: 13 }}><strong>{pendingTimeOffs.length}</strong> time off requests pending</div>}
          </div>
        )}
      </div>
    </div>
  )
}
