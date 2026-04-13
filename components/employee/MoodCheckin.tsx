import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { empName } from '../../lib/utils'
import { Card, C, EmptyState, PageHeader, Badge } from '../ui'
import type { Employee, MoodCheckin as MoodType, Department } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[]; departments: Department[] }

const MOODS = [
  { score: 5, emoji: '😄', label: 'Great', color: '#059669' },
  { score: 4, emoji: '🙂', label: 'Good', color: '#65A30D' },
  { score: 3, emoji: '😐', label: 'Okay', color: '#D97706' },
  { score: 2, emoji: '😕', label: 'Not great', color: '#EA580C' },
  { score: 1, emoji: '😞', label: 'Rough day', color: '#DC2626' },
]

export default function MoodCheckin({ user, lang, employees, departments }: Props) {
  const [checkins, setCheckins] = useState<MoodType[]>([])
  const [todayMood, setTodayMood] = useState<MoodType | null>(null)
  const [selected, setSelected] = useState(0)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const canSeeTeam = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [todayData, allData] = await Promise.all([
      supabase.from('mood_checkins').select('*').eq('employee_id', user.id).gte('created_at', today).order('created_at', { ascending: false }).limit(1),
      supabase.from('mood_checkins').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setTodayMood(todayData.data?.[0] || null)
    setCheckins(allData.data || [])
  }

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    await supabase.from('mood_checkins').insert({ employee_id: user.id, score: selected, note: note.trim() || null })
    setSubmitting(false)
    setSubmitted(true)
    setNote('')
    load()
    setTimeout(() => setSubmitted(false), 3000)
  }

  const teamMoodToday = canSeeTeam ? (() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayCheckins = checkins.filter(c => c.created_at?.slice(0, 10) === today)
    if (!todayCheckins.length) return null
    return (todayCheckins.reduce((s, c) => s + c.score, 0) / todayCheckins.length).toFixed(1)
  })() : null

  return (
    <div>
      <PageHeader title="Mood Check-in" sub="How are you feeling today? Your responses help us support you better." />

      <div style={{ display: 'grid', gridTemplateColumns: canSeeTeam ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
        {/* My check-in */}
        <Card>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 16 }}>Today's Check-in</div>
          {todayMood ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>{MOODS.find(m => m.score === todayMood.score)?.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: MOODS.find(m => m.score === todayMood.score)?.color }}>
                {MOODS.find(m => m.score === todayMood.score)?.label}
              </div>
              {todayMood.note && <p style={{ fontSize: 13, color: C.textSub, marginTop: 8, fontStyle: 'italic' }}>"{todayMood.note}"</p>}
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>Checked in at {format(new Date(todayMood.created_at), 'HH:mm')}</div>
            </div>
          ) : submitted ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48 }}>✅</div>
              <div style={{ fontWeight: 700, color: C.success, marginTop: 8 }}>Check-in submitted!</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                {MOODS.map(m => (
                  <button
                    key={m.score}
                    onClick={() => setSelected(m.score)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 14px', borderRadius: 10, border: `2px solid ${selected === m.score ? m.color : C.border}`,
                      background: selected === m.score ? `${m.color}15` : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s', minWidth: 60,
                    }}
                  >
                    <span style={{ fontSize: 28 }}>{m.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: selected === m.score ? m.color : C.textMuted }}>{m.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional note about your day..."
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any, marginBottom: 12 }}
              />
              <button
                onClick={submit}
                disabled={!selected || submitting}
                style={{ width: '100%', padding: '11px', background: selected ? C.accent : '#E2E8F0', color: selected ? '#fff' : C.textMuted, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: selected ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}
              >
                {submitting ? 'Submitting...' : 'Submit Check-in'}
              </button>
            </div>
          )}
        </Card>

        {/* Team mood (admin/manager only) */}
        {canSeeTeam && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 16 }}>Team Mood Today</div>
            {teamMoodToday ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: C.accent, fontFamily: 'var(--font-mono)' }}>{teamMoodToday}<span style={{ fontSize: 18, color: C.textSub }}>/5</span></div>
                  <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>Average mood score</div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' as any }}>
                  {MOODS.map(m => {
                    const today = format(new Date(), 'yyyy-MM-dd')
                    const count = checkins.filter(c => c.score === m.score && c.created_at?.slice(0, 10) === today).length
                    return count > 0 ? (
                      <div key={m.score} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: `${m.color}15`, border: `1px solid ${m.color}40` }}>
                        <span style={{ fontSize: 16 }}>{m.emoji}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: m.color }}>{count}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </>
            ) : (
              <EmptyState title="No check-ins today" sub="Team mood data will appear when employees check in" />
            )}
          </Card>
        )}
      </div>

      {/* History */}
      <Card>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 14 }}>
          {canSeeTeam ? 'Recent Team Check-ins' : 'My History'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(canSeeTeam ? checkins : checkins.filter(c => c.employee_id === user.id)).slice(0, 20).map(c => {
            const mood = MOODS.find(m => m.score === c.score)
            const emp = employees.find(e => e.id === c.employee_id)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid #F8FAFC` }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{mood?.emoji}</span>
                <div style={{ flex: 1 }}>
                  {canSeeTeam && <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{empName(emp)}</div>}
                  {c.note && <div style={{ fontSize: 12, color: C.textSub, fontStyle: 'italic' }}>"{c.note}"</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <Badge color={c.score >= 4 ? 'green' : c.score === 3 ? 'yellow' : 'red'}>{mood?.label}</Badge>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{c.created_at ? format(new Date(c.created_at), 'MMM d, HH:mm') : ''}</div>
                </div>
              </div>
            )
          })}
          {checkins.length === 0 && <EmptyState title="No check-ins yet" />}
        </div>
      </Card>
    </div>
  )
}
