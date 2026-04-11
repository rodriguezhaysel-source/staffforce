import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, differenceInMinutes } from 'date-fns'
import { Icon } from './shared/Icons'
import { empName, fmtMoney, entryHours } from './shared/utils'
import type { Employee, Department, Location, Shift, TimeEntry, TimeOff, Notification } from '../lib/store'

interface Props {
  user: Employee
  lang: string
  employees: Employee[]
  departments: Department[]
  locations: Location[]
}

type ScheduleView = 'week' | 'twoweeks' | 'month'

// ─── KPI Card ───────────────────────────────────────────
function KpiCard({ label, value, sub, color, onClick, alert }: {
  label: string; value: string | number; sub?: string
  color?: string; onClick?: () => void; alert?: number
}) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #E2E6EC', borderRadius: 10,
      padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative',
      transition: 'box-shadow 0.15s', flex: 1, minWidth: 140,
    }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
    >
      {alert && alert > 0 ? (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#DC2626', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px', minWidth: 18, textAlign: 'center' }}>{alert}</div>
      ) : null}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#111827', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── Alert Item ─────────────────────────────────────────
function AlertItem({ severity, message, time }: { severity: 'red' | 'yellow' | 'blue'; message: string; time?: string }) {
  const colors = { red: { bg: '#FEF2F2', border: '#FCA5A5', dot: '#DC2626' }, yellow: { bg: '#FFFBEB', border: '#FCD34D', dot: '#D97706' }, blue: { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB' } }
  const c = colors[severity]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{message}</div>
        {time && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{time}</div>}
      </div>
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      {children}
    </div>
  )
}

// ─── Coverage Badge ──────────────────────────────────────
function CoverageBadge({ count, total }: { count: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((count / total) * 100)
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626'
  const bg = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2'
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '2px 6px', textAlign: 'center' }}>
      {count}/{total}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function Dashboard({ user, lang, employees, departments, locations }: Props) {
  const [scheduleView, setScheduleView] = useState<ScheduleView>('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([])
  const [pendingTimeOffs, setPendingTimeOffs] = useState<TimeOff[]>([])
  const [pendingTimesheets, setPendingTimesheets] = useState<TimeEntry[]>([])
  const [alerts, setAlerts] = useState<{ severity: 'red' | 'yellow' | 'blue'; message: string; time?: string }[]>([])
  const [laborCostToday, setLaborCostToday] = useState(0)
  const [laborCostWeek, setLaborCostWeek] = useState(0)
  const [now, setNow] = useState(new Date())
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null)
  const [kpiEmployees, setKpiEmployees] = useState<Employee[]>([])
  const [publishing, setPublishing] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)

  const activeEmployees = employees.filter(e => e.status === 'active')
  const totalActive = activeEmployees.length

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { loadAll() }, [weekStart, scheduleView])

  async function loadAll() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const rangeEnd = scheduleView === 'month'
      ? format(endOfMonth(weekStart), 'yyyy-MM-dd')
      : scheduleView === 'twoweeks'
        ? format(addDays(weekStart, 13), 'yyyy-MM-dd')
        : format(addDays(weekStart, 6), 'yyyy-MM-dd')

    const [ae, pto, pts, sh, todayEntries, weekEntries] = await Promise.all([
      supabase.from('time_entries').select('*').is('clock_out', null),
      supabase.from('time_off').select('*').eq('status', 'pending'),
      supabase.from('time_entries').select('*').eq('status', 'pending'),
      supabase.from('shifts').select('*').gte('start_time', weekStartStr).lte('start_time', rangeEnd + 'T23:59:59'),
      supabase.from('time_entries').select('*').gte('clock_in', today).not('clock_out', 'is', null),
      supabase.from('time_entries').select('*').gte('clock_in', weekStartStr),
    ])

    setActiveEntries(ae.data || [])
    setPendingTimeOffs(pto.data || [])
    setPendingTimesheets(pts.data || [])
    setShifts(sh.data || [])

    // Labor costs
    const todayCost = (todayEntries.data || []).reduce((acc, e) => {
      const emp = employees.find(em => em.id === e.employee_id)
      if (!emp) return acc
      const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
      return acc + entryHours(e) * rate
    }, 0)
    setLaborCostToday(todayCost)

    const weekCost = (weekEntries.data || []).reduce((acc, e) => {
      const emp = employees.find(em => em.id === e.employee_id)
      if (!emp) return acc
      const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
      return acc + entryHours(e) * rate
    }, 0)
    setLaborCostWeek(weekCost)

    // Build alerts
    const newAlerts: typeof alerts = []
    const todayShifts = (sh.data || []).filter(s => s.start_time.slice(0, 10) === today)
    todayShifts.forEach(s => {
      const emp = employees.find(e => e.id === s.employee_id)
      const clocked = (ae.data || []).find(e => e.employee_id === s.employee_id)
      const shiftStart = new Date(s.start_time)
      const lateBy = differenceInMinutes(now, shiftStart)
      if (!clocked && lateBy > 15) {
        newAlerts.push({ severity: 'red', message: `${empName(emp)} is ${lateBy} min late for their shift`, time: format(shiftStart, 'HH:mm') })
      }
    })
    ;(pts.data || []).forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      newAlerts.push({ severity: 'yellow', message: `Timesheet pending approval — ${empName(emp)}`, time: e.clock_in?.slice(0, 10) })
    })
    ;(pto.data || []).forEach(r => {
      const emp = employees.find(em => em.id === r.employee_id)
      newAlerts.push({ severity: 'yellow', message: `Time off request — ${empName(emp)} (${r.type})`, time: r.start_date })
    })
    setAlerts(newAlerts)
  }

  async function publishAllDrafts() {
    setPublishing(true)
    const drafts = shifts.filter(s => s.status === 'draft')
    for (const s of drafts) {
      await supabase.from('shifts').update({ status: 'scheduled' }).eq('id', s.id)
    }
    const empIds = [...new Set(drafts.map(s => s.employee_id))]
    for (const empId of empIds) {
      await supabase.from('notifications').insert({ employee_id: empId, title: 'Schedule Published', message: 'Your schedule has been published.', type: 'info', read: false })
    }
    setPublishing(false)
    loadAll()
  }

  async function approveTimesheet(id: string) {
    setApproving(id)
    await supabase.from('time_entries').update({ status: 'approved', approved_by: user.id }).eq('id', id)
    setApproving(null)
    loadAll()
  }

  async function approveTimeOff(id: string, empId: string, days: number, type: string) {
    await supabase.from('time_off').update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (type === 'vacation') {
      const emp = employees.find(e => e.id === empId)
      if (emp) await supabase.from('employees').update({ pto_balance: Math.max(0, (emp.pto_balance || 0) - days) }).eq('id', empId)
    }
    await supabase.from('notifications').insert({ employee_id: empId, title: 'Time Off Approved', message: 'Your time off request has been approved.', type: 'success', read: false })
    loadAll()
  }

  async function rejectTimeOff(id: string, empId: string) {
    await supabase.from('time_off').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('notifications').insert({ employee_id: empId, title: 'Time Off Denied', message: 'Your time off request was denied.', type: 'error', read: false })
    loadAll()
  }

  function handleKpiClick(type: string) {
    if (expandedKpi === type) { setExpandedKpi(null); return }
    setExpandedKpi(type)
    if (type === 'clocked') setKpiEmployees(activeEmployees.filter(e => activeEntries.find(ae => ae.employee_id === e.id)))
    if (type === 'notclocked') setKpiEmployees(activeEmployees.filter(e => !activeEntries.find(ae => ae.employee_id === e.id)))
  }

  // ── Schedule rendering ──
  const draftCount = shifts.filter(s => s.status === 'draft').length

  function renderWeekGrid(days: Date[]) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 40, padding: '8px 10px', background: '#F8F9FB', border: '1px solid #E2E6EC', fontSize: 11, fontWeight: 700, color: '#6B7280', textAlign: 'left' }}>Dept</th>
              {days.map(d => {
                const dayShifts = shifts.filter(s => s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd'))
                const dayEmployeeIds = [...new Set(dayShifts.map(s => s.employee_id))]
                return (
                  <th key={d.toISOString()} style={{ padding: '8px 6px', background: isToday(d) ? '#EFF6FF' : '#F8F9FB', border: '1px solid #E2E6EC', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isToday(d) ? '#2563EB' : '#6B7280' }}>{format(d, 'EEE')}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isToday(d) ? '#2563EB' : '#111827' }}>{format(d, 'd')}</div>
                    <div style={{ marginTop: 4 }}><CoverageBadge count={dayEmployeeIds.length} total={totalActive} /></div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => {
              const deptShifts = shifts.filter(s => s.department_id === dept.id)
              if (deptShifts.length === 0) return null
              return (
                <tr key={dept.id}>
                  <td style={{ padding: '6px 10px', border: '1px solid #E2E6EC', background: dept.color + '15' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, margin: '0 auto' }} title={dept.name} />
                  </td>
                  {days.map(d => {
                    const dayShifts = deptShifts.filter(s => s.start_time.slice(0, 10) === format(d, 'yyyy-MM-dd'))
                    return (
                      <td key={d.toISOString()} style={{ padding: 4, border: '1px solid #E2E6EC', background: isToday(d) ? '#F0F7FF' : '#FFFFFF', verticalAlign: 'top', minHeight: 50 }}>
                        {dayShifts.map(s => {
                          const emp = employees.find(e => e.id === s.employee_id)
                          const isDraft = s.status === 'draft'
                          return (
                            <div key={s.id} style={{
                              padding: '4px 6px', borderRadius: 5, marginBottom: 3, fontSize: 11, fontWeight: 600,
                              background: isDraft ? 'transparent' : dept.color + '20',
                              color: dept.color,
                              border: isDraft ? `1.5px dashed ${dept.color}` : 'none',
                              opacity: isDraft ? 0.75 : 1,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 800 }}>{format(new Date(s.start_time), 'HH:mm')}-{format(new Date(s.end_time), 'HH:mm')}</div>
                              <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 400 }}>{emp ? emp.first_name + ' ' + (emp.last_name?.[0] || '') + '.' : '-'}</div>
                              {isDraft && <div style={{ fontSize: 9, opacity: 0.7 }}>DRAFT</div>}
                            </div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function renderMonthView() {
    const monthStart = startOfMonth(weekStart)
    const monthEnd = endOfMonth(weekStart)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const firstDow = monthStart.getDay()
    const padding = Array(firstDow === 0 ? 6 : firstDow - 1).fill(null)
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6B7280', padding: '6px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {padding.map((_, i) => <div key={'p' + i} />)}
          {days.map(day => {
            const dayShifts = shifts.filter(s => s.start_time.slice(0, 10) === format(day, 'yyyy-MM-dd'))
            const draftDay = dayShifts.filter(s => s.status === 'draft').length
            const pubDay = dayShifts.filter(s => s.status !== 'draft').length
            return (
              <div key={day.toISOString()} style={{
                minHeight: 64, border: '1px solid #E2E6EC', borderRadius: 6, padding: '5px 6px',
                background: isToday(day) ? '#EFF6FF' : '#FFFFFF',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday(day) ? '#2563EB' : '#374151', marginBottom: 4 }}>{format(day, 'd')}</div>
                {pubDay > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#059669', borderRadius: 3, padding: '1px 5px', marginBottom: 2 }}>{pubDay} published</div>}
                {draftDay > 0 && <div style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#D97706', borderRadius: 3, padding: '1px 5px', border: '1px dashed #FCD34D' }}>{draftDay} draft</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const twoWeekDays = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i))

  const pendingAll = [...pendingTimesheets.map(t => ({ type: 'timesheet' as const, data: t })), ...pendingTimeOffs.map(t => ({ type: 'timeoff' as const, data: t }))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── KPI ROW ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Clocked In Now"
          value={activeEntries.length}
          sub={`of ${totalActive} active`}
          color={activeEntries.length > 0 ? '#059669' : '#111827'}
          onClick={() => handleKpiClick('clocked')}
          alert={0}
        />
        <KpiCard
          label="Not Clocked In"
          value={totalActive - activeEntries.length}
          sub="active employees"
          color={totalActive - activeEntries.length > 0 ? '#D97706' : '#059669'}
          onClick={() => handleKpiClick('notclocked')}
        />
        <KpiCard label="Labor Cost Today" value={fmtMoney(laborCostToday)} sub="accrued today" />
        <KpiCard label="Labor Cost Week" value={fmtMoney(laborCostWeek)} sub="current week" />
        <KpiCard label="Open Shifts" value={shifts.filter(s => !s.employee_id).length} sub="need coverage" color="#D97706" />
        <KpiCard
          label="Pending Approvals"
          value={pendingAll.length}
          sub="timesheets + time off"
          color={pendingAll.length > 0 ? '#DC2626' : '#059669'}
          alert={pendingAll.length}
          onClick={() => handleKpiClick('approvals')}
        />
      </div>

      {/* ── KPI EXPANDED ────────────────────────────── */}
      {expandedKpi && expandedKpi !== 'approvals' && (
        <div style={{ background: '#fff', border: '1px solid #E2E6EC', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title={expandedKpi === 'clocked' ? 'Currently Clocked In' : 'Not Clocked In'}>
            <button onClick={() => setExpandedKpi(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12 }}>Close</button>
          </SectionHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {kpiEmployees.map(emp => {
              const entry = activeEntries.find(e => e.employee_id === emp.id)
              const dept = departments.find(d => d.id === emp.department_id)
              const mins = entry ? differenceInMinutes(now, new Date(entry.clock_in)) : 0
              const avatarUrl = (emp as any).avatar_url
              return (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8F9FB', borderRadius: 8, border: '1px solid #E2E6EC', minWidth: 200 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarUrl ? 'transparent' : (dept?.color || '#0A6EBD'), overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.first_name} {emp.last_name?.[0]}.</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{emp.position}</div>
                  </div>
                  {entry && <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#059669' }}>{Math.floor(mins / 60)}h {mins % 60}m</div>}
                </div>
              )
            })}
            {kpiEmployees.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF' }}>No employees in this state</div>}
          </div>
        </div>
      )}

      {/* ── SCHEDULE BLOCK ──────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E2E6EC', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Schedule Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SectionHeader title="Schedule" />
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1px solid #E2E6EC', borderRadius: 6, overflow: 'hidden', marginLeft: 8 }}>
              {([['week', 'Week'], ['twoweeks', '2 Weeks'], ['month', 'Month']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setScheduleView(v)} style={{
                  padding: '5px 14px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: scheduleView === v ? '#0A6EBD' : 'transparent',
                  color: scheduleView === v ? '#fff' : '#6B7280',
                }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Navigation */}
            <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} style={{ background: '#F3F4F6', border: '1px solid #E2E6EC', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
              <Icon name="chevronLeft" size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 160, textAlign: 'center' }}>
              {scheduleView === 'month'
                ? format(weekStart, 'MMMM yyyy')
                : `${format(weekStart, 'MMM d')} — ${format(scheduleView === 'twoweeks' ? addDays(weekStart, 13) : addDays(weekStart, 6), 'MMM d, yyyy')}`
              }
            </span>
            <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} style={{ background: '#F3F4F6', border: '1px solid #E2E6EC', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
              <Icon name="chevronRight" size={14} />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ background: '#F3F4F6', border: '1px solid #E2E6EC', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Today</button>

            {/* Draft / Publish status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px dashed #0A6EBD' }} />
                Draft ({draftCount})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#0A6EBD' }} />
                Published ({shifts.filter(s => s.status === 'scheduled').length})
              </div>
            </div>

            {/* Publish button */}
            {draftCount > 0 && (
              <button onClick={publishAllDrafts} disabled={publishing} style={{
                background: '#059669', color: '#fff', border: 'none', borderRadius: 6,
                padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {publishing ? 'Publishing...' : `Publish ${draftCount} Drafts`}
              </button>
            )}
          </div>
        </div>

        {/* Department legend */}
        {departments.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {departments.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        )}

        {/* Schedule grid */}
        {shifts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
            No shifts scheduled for this period. Go to Schedule to add shifts.
          </div>
        ) : (
          scheduleView === 'month' ? renderMonthView() :
            scheduleView === 'twoweeks' ? renderWeekGrid(twoWeekDays) :
              renderWeekGrid(weekDays)
        )}
      </div>

      {/* ── BOTTOM ROW ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ALERTS */}
        <div style={{ background: '#fff', border: '1px solid #E2E6EC', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title={`Active Alerts (${alerts.length})`} />
          {alerts.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 13 }}>No active alerts</div>
            : alerts.slice(0, 8).map((a, i) => <AlertItem key={i} {...a} />)
          }
        </div>

        {/* PENDING APPROVALS */}
        <div style={{ background: '#fff', border: '1px solid #E2E6EC', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title={`Pending Approvals (${pendingAll.length})`} />
          {pendingAll.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 13 }}>All caught up</div>
            : pendingAll.slice(0, 6).map((item, i) => {
              if (item.type === 'timesheet') {
                const e = item.data as TimeEntry
                const emp = employees.find(em => em.id === e.employee_id)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{empName(emp)}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Timesheet — {e.clock_in?.slice(0, 10)} · {entryHours(e).toFixed(1)}h</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveTimesheet(e.id)} disabled={approving === e.id} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {approving === e.id ? '...' : 'Approve'}
                      </button>
                      <button onClick={async () => { await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', e.id); loadAll() }} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  </div>
                )
              } else {
                const r = item.data as TimeOff
                const emp = employees.find(em => em.id === r.employee_id)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{empName(emp)}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Time Off ({r.type}) — {r.start_date} · {r.days}d</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveTimeOff(r.id, r.employee_id, r.days, r.type)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => rejectTimeOff(r.id, r.employee_id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Deny</button>
                    </div>
                  </div>
                )
              }
            })
          }
        </div>
      </div>
    </div>
  )
}
