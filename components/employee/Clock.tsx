import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import { format, differenceInMinutes } from 'date-fns'
import { haversineDistance, getCurrentPosition } from '../../lib/utils'
import { entryHours, fmtHours } from '../../lib/utils'
import { isWithinShift } from '../../lib/utils'
import type { Employee, Location, TimeEntry, Shift } from '../../types'

interface Props { user: Employee; lang: string; locations: Location[]; employees?: Employee[] }

export default function Clock({ user, lang, locations }: Props) {
  const [current, setCurrent] = useState<TimeEntry | null>(null)
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [todayShift, setTodayShift] = useState<Shift | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle'|'checking'|'ok'|'blocked'|'denied'>('idle')
  const [geoMsg, setGeoMsg] = useState('')
  const [onBreak, setOnBreak] = useState(false)
  const [breakStart, setBreakStart] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let mounted = true
    loadClock()
    const ch = supabase.channel('clock-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter: `employee_id=eq.${user.id}` }, () => { if (mounted) loadClock() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [])

  async function loadClock() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [entries, shifts] = await Promise.all([
      supabase.from('time_entries').select('*').eq('employee_id', user.id).gte('clock_in', today).order('clock_in', { ascending: false }),
      supabase.from('shifts').select('*').eq('employee_id', user.id).gte('start_time', today).lte('start_time', today + 'T23:59:59').order('start_time'),
    ])
    const list: TimeEntry[] = entries.data || []
    setTodayEntries(list)
    // Only one active at a time
    setCurrent(list.find(e => !e.clock_out) || null)
    // Find current or next shift
    const allShifts: Shift[] = shifts.data || []
    const active = allShifts.find(s => isWithinShift(new Date(), s))
    const next = allShifts.find(s => new Date(s.start_time) > new Date())
    setTodayShift(active || next || null)
  }

  async function handleClockIn() {
    setError('')
    // Validate: no active entry already
    if (current) { setError('You are already clocked in'); return }
    // Validate: max one open entry per employee
    const { data: open } = await supabase.from('time_entries').select('id').eq('employee_id', user.id).is('clock_out', null)
    if (open && open.length > 0) { setError('You already have an open time entry. Please clock out first.'); return }

    if (user.geo_exempt) { await doClockIn(null, null, true); return }
    const loc = locations.find(l => l.id === user.location_id)
    if (!loc || !loc.lat) { await doClockIn(null, null, true); return }

    setGeoStatus('checking')
    setGeoMsg(t(lang, 'checkingLocation'))
    setLoading(true)
    try {
      const pos = await getCurrentPosition()
      const lat = pos.coords.latitude; const lng = pos.coords.longitude
      const dist = haversineDistance(lat, lng, loc.lat, loc.lng)
      if (dist <= loc.radius_meters) {
        setGeoStatus('ok'); setGeoMsg('')
        await doClockIn(lat, lng, true)
      } else {
        setGeoStatus('blocked')
        setGeoMsg(`${t(lang, 'geofenceBlocked').replace('{dist}', String(Math.round(dist)))} (${Math.round(dist)}m away)`)
      }
    } catch (err: any) {
      setGeoStatus('denied')
      setGeoMsg(t(lang, 'locationDenied'))
    }
    setLoading(false)
  }

  async function doClockIn(lat: number | null, lng: number | null, within: boolean) {
    setLoading(true)
    const { data, error: err } = await supabase.from('time_entries').insert({
      employee_id: user.id,
      location_id: user.location_id || null,
      clock_in: new Date().toISOString(),
      clock_in_lat: lat,
      clock_in_lng: lng,
      within_geofence: within,
      status: 'pending',
      break_mins: 0,
    }).select('*')
    if (err) { setError('Failed to clock in: ' + err.message) }
    else if (data) { setCurrent(data[0]); loadClock() }
    setLoading(false)
  }

  async function handleClockOut() {
    if (!current) return
    setLoading(true)
    let lat = null; let lng = null
    try { const p = await getCurrentPosition(); lat = p.coords.latitude; lng = p.coords.longitude } catch { }

    const totalBreak = onBreak && breakStart
      ? (current.break_mins || 0) + differenceInMinutes(now, breakStart)
      : (current.break_mins || 0)

    const clockOut = new Date().toISOString()
    await supabase.from('time_entries').update({
      clock_out: clockOut,
      clock_out_lat: lat,
      clock_out_lng: lng,
      break_mins: totalBreak,
    }).eq('id', current.id)

    setCurrent(null); setOnBreak(false); setBreakStart(null)
    setGeoStatus('idle'); setGeoMsg(''); setLoading(false)
    loadClock()
  }

  function handleBreakStart() {
    if (!current) return
    setOnBreak(true); setBreakStart(now)
  }

  async function handleBreakEnd() {
    if (!current || !breakStart) return
    const add = differenceInMinutes(now, breakStart)
    const newBreak = (current.break_mins || 0) + add
    await supabase.from('time_entries').update({ break_mins: newBreak }).eq('id', current.id)
    setCurrent(prev => prev ? { ...prev, break_mins: newBreak } : prev)
    setOnBreak(false); setBreakStart(null)
  }

  const elapsed = current ? differenceInMinutes(now, new Date(current.clock_in)) : 0
  const netElapsed = Math.max(0, elapsed - (current?.break_mins || 0) - (onBreak && breakStart ? differenceInMinutes(now, breakStart) : 0))
  const hh = String(Math.floor(netElapsed / 60)).padStart(2, '0')
  const mm = String(netElapsed % 60).padStart(2, '0')
  const ss = String(Math.floor((now.getTime() / 1000) % 60)).padStart(2, '0')

  const totalMins = todayEntries
    .filter(e => e.clock_out)
    .reduce((s, e) => s + differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in)) - (e.break_mins || 0), 0)

  const isLate = todayShift && !current && new Date(todayShift.start_time) < now && differenceInMinutes(now, new Date(todayShift.start_time)) > 5

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* Shift context */}
      {todayShift && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: current ? '#F0FDF4' : isLate ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${current ? '#BBF7D0' : isLate ? '#FECACA' : '#BFDBFE'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: current ? '#059669' : isLate ? '#DC2626' : '#2563EB', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: current ? '#065F46' : isLate ? '#991B1B' : '#1D4ED8' }}>
                {current ? 'Currently on shift' : isLate ? 'Late — shift started' : 'Upcoming shift'}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {format(new Date(todayShift.start_time), 'HH:mm')} — {format(new Date(todayShift.end_time), 'HH:mm')}
                {todayShift.position && ` · ${todayShift.position}`}
              </div>
            </div>
            {isLate && (
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: 6 }}>
                {differenceInMinutes(now, new Date(todayShift.start_time))}m late
              </span>
            )}
          </div>
        </div>
      )}

      {/* Clock card */}
      <div className="card clock-status-card">
        <div className={`clock-status-badge ${current ? 'in' : 'out'}`}>
          {current ? t(lang, 'currentlyClocked') : t(lang, 'notClockedIn')}
        </div>

        <div className="clock-timer">{hh}:{mm}:{ss}</div>

        {onBreak && breakStart && (
          <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600, marginBottom: 8 }}>
            On break — {differenceInMinutes(now, breakStart)}m
          </div>
        )}

        {geoMsg && (
          <div className={`geo-info ${geoStatus === 'blocked' ? 'geo-blocked' : geoStatus === 'ok' ? 'geo-ok' : ''}`}>
            {geoMsg}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="clock-btn-wrap">
          {!current ? (
            <button className="clock-btn clock-btn-in" onClick={handleClockIn} disabled={loading}>
              {loading ? t(lang, 'loading') + '...' : t(lang, 'clockIn')}
            </button>
          ) : (
            <>
              {!onBreak ? (
                <button className="clock-btn clock-btn-break" onClick={handleBreakStart} disabled={loading}>
                  {t(lang, 'breakStart')}
                </button>
              ) : (
                <button className="clock-btn clock-btn-break" onClick={handleBreakEnd} disabled={loading}>
                  {t(lang, 'breakEnd')}
                </button>
              )}
              <button className="clock-btn clock-btn-out" onClick={handleClockOut} disabled={loading || onBreak}>
                {loading ? t(lang, 'loading') + '...' : t(lang, 'clockOut')}
              </button>
            </>
          )}
        </div>

        {onBreak && (
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>
            Clock out is disabled while on break
          </div>
        )}

        {geoStatus === 'checking' && (
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>{t(lang, 'checkingLocation')}</div>
        )}

        {/* Today's total */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 24, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Today Total</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>{fmtHours(totalMins)}</div>
          </div>
          {current && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Breaks</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>{current.break_mins || 0}m</div>
            </div>
          )}
        </div>
      </div>

      {/* Today's history */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">{t(lang, 'todayHistory')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>{fmtHours(totalMins)}</span>
        </div>
        {todayEntries.length === 0 ? (
          <div className="empty-state"><div className="empty-state-sub">No entries today</div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'clockInTime')}</th>
                <th>{t(lang, 'clockOutTime')}</th>
                <th>{t(lang, 'breakMins')}</th>
                <th>{t(lang, 'hoursWorked')}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayEntries.map(e => {
                const hrs = entryHours(e)
                const ot = hrs > 8
                return (
                  <tr key={e.id}>
                    <td className="mono">{format(new Date(e.clock_in), 'HH:mm')}</td>
                    <td className="mono">{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : <span style={{ color: '#059669', fontWeight: 700 }}>Active</span>}</td>
                    <td>{e.break_mins || 0}m</td>
                    <td className="mono" style={{ color: ot ? '#D97706' : undefined, fontWeight: ot ? 700 : undefined }}>
                      {hrs.toFixed(2)}{ot ? ' OT' : ''}
                    </td>
                    <td><span className={`badge ${e.status === 'approved' ? 'badge-success' : e.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{e.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
