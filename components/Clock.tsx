import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { format, differenceInMinutes } from 'date-fns'
import { haversineDistance, getCurrentPosition } from '../lib/geo'
import { entryHours, fmtHours } from './shared/utils'
import type { Employee, Location, TimeEntry } from '../lib/store'

interface Props { user: Employee; lang: string; locations: Location[] }

export default function Clock({ user, lang, locations }: Props) {
  const [current, setCurrent] = useState<TimeEntry | null>(null)
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [geoStatus, setGeoStatus] = useState<'idle' | 'checking' | 'ok' | 'blocked' | 'denied'>('idle')
  const [geoMsg, setGeoMsg] = useState('')
  const [onBreak, setOnBreak] = useState(false)
  const [breakStart, setBreakStart] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { load() }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase.from('time_entries').select('*').eq('employee_id', user.id).gte('clock_in', today).order('clock_in', { ascending: false })
    const entries: TimeEntry[] = data || []
    setTodayEntries(entries)
    setCurrent(entries.find(e => !e.clock_out) || null)
  }

  async function handleClockIn() {
    if (user.geo_exempt) { await doClockIn(null, null, true); return }
    const loc = locations.find(l => l.id === user.location_id)
    if (!loc) { await doClockIn(null, null, true); return }
    setGeoStatus('checking')
    setGeoMsg(t(lang, 'checkingLocation'))
    try {
      const pos = await getCurrentPosition()
      const lat = pos.coords.latitude; const lng = pos.coords.longitude
      const dist = haversineDistance(lat, lng, loc.lat, loc.lng)
      if (dist <= loc.radius_meters) {
        setGeoStatus('ok'); setGeoMsg('')
        await doClockIn(lat, lng, true)
      } else {
        setGeoStatus('blocked')
        setGeoMsg(t(lang, 'geofenceBlocked').replace('{dist}', String(Math.round(dist))))
      }
    } catch {
      setGeoStatus('denied'); setGeoMsg(t(lang, 'locationDenied'))
    }
  }

  async function doClockIn(lat: number | null, lng: number | null, within: boolean) {
    const { data } = await supabase.from('time_entries').insert({
      employee_id: user.id, location_id: user.location_id || null,
      clock_in: new Date().toISOString(), clock_in_lat: lat, clock_in_lng: lng,
      within_geofence: within, status: 'pending', break_mins: 0,
    }).select('*')
    if (data) { setCurrent(data[0]); load() }
  }

  async function handleClockOut() {
    if (!current) return
    let lat = null; let lng = null
    try { const p = await getCurrentPosition(); lat = p.coords.latitude; lng = p.coords.longitude } catch { }
    const breakMins = onBreak && breakStart ? differenceInMinutes(now, breakStart) : (current.break_mins || 0)
    await supabase.from('time_entries').update({ clock_out: new Date().toISOString(), clock_out_lat: lat, clock_out_lng: lng, break_mins: breakMins }).eq('id', current.id)
    setCurrent(null); setOnBreak(false); setBreakStart(null); setGeoStatus('idle'); setGeoMsg(''); load()
  }

  function handleBreakStart() { setOnBreak(true); setBreakStart(now) }
  function handleBreakEnd() {
    if (!current || !breakStart) return
    const add = differenceInMinutes(now, breakStart)
    supabase.from('time_entries').update({ break_mins: (current.break_mins || 0) + add }).eq('id', current.id)
    setOnBreak(false); setBreakStart(null)
  }

  const elapsed = current ? differenceInMinutes(now, new Date(current.clock_in)) : 0
  const hh = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const mm = String(elapsed % 60).padStart(2, '0')
  const totalMins = todayEntries.filter(e => e.clock_out).reduce((s, e) => s + differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in)) - (e.break_mins || 0), 0)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="card clock-status-card">
        <div className={`clock-status-badge ${current ? 'in' : 'out'}`}>
          {current ? t(lang, 'currentlyClocked') : t(lang, 'notClockedIn')}
        </div>
        <div className="clock-timer">{hh}:{mm}:00</div>
        {geoMsg && <div className={`geo-info ${geoStatus === 'blocked' ? 'geo-blocked' : geoStatus === 'ok' ? 'geo-ok' : ''}`}>{geoMsg}</div>}
        {geoStatus === 'checking' && !geoMsg && <div className="geo-info">{t(lang, 'checkingLocation')}</div>}
        <div className="clock-btn-wrap">
          {!current
            ? <button className="clock-btn clock-btn-in" onClick={handleClockIn}>{t(lang, 'clockIn')}</button>
            : <>
              {!onBreak
                ? <button className="clock-btn clock-btn-break" onClick={handleBreakStart}>{t(lang, 'breakStart')}</button>
                : <button className="clock-btn clock-btn-break" onClick={handleBreakEnd}>{t(lang, 'breakEnd')}</button>
              }
              <button className="clock-btn clock-btn-out" onClick={handleClockOut}>{t(lang, 'clockOut')}</button>
            </>
          }
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">{t(lang, 'todayHistory')}</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtHours(totalMins)}</span>
        </div>
        {todayEntries.length === 0
          ? <div className="empty-state"><div className="empty-state-sub">No entries today</div></div>
          : <table>
            <thead><tr><th>{t(lang, 'clockInTime')}</th><th>{t(lang, 'clockOutTime')}</th><th>{t(lang, 'breakMins')}</th><th>{t(lang, 'hoursWorked')}</th></tr></thead>
            <tbody>
              {todayEntries.map(e => (
                <tr key={e.id}>
                  <td className="mono">{format(new Date(e.clock_in), 'HH:mm')}</td>
                  <td className="mono">{e.clock_out ? format(new Date(e.clock_out), 'HH:mm') : '-'}</td>
                  <td>{e.break_mins || 0}</td>
                  <td className="mono">{entryHours(e).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  )
}
