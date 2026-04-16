import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import { getCurrentPosition } from '../../lib/utils'
import { Card, Btn, Popup, Inp, Sel, C, EmptyState } from '../ui'
import type { Employee, Location } from '../../types'

interface Props { user: Employee; lang: string; locations: Location[]; setLocations: (l: Location[]) => void }

export default function Locations({ user, lang, locations, setLocations }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editLoc, setEditLoc] = useState<Partial<Location>>({})
  const [isEdit, setIsEdit] = useState(false)

  async function reload() {
    const { data } = await supabase.from('locations').select('*')
    setLocations(data || [])
  }

  function openAdd() {
    setEditLoc({ radius_meters: 100, currency: 'USD', timezone: 'America/New_York' })
    setIsEdit(false); setModalOpen(true)
  }

  function openEdit(l: Location) {
    setEditLoc({ ...l }); setIsEdit(true); setModalOpen(true)
  }

  async function save() {
    if (isEdit && editLoc.id) await supabase.from('locations').update(editLoc).eq('id', editLoc.id)
    else await supabase.from('locations').insert(editLoc)
    setModalOpen(false); reload()
  }

  async function del(id: string) {
    if (!confirm('Delete this location?')) return
    await supabase.from('locations').delete().eq('id', id); reload()
  }

  async function detectLocation() {
    try {
      const pos = await getCurrentPosition()
      setEditLoc(l => ({ ...l, lat: pos.coords.latitude, lng: pos.coords.longitude }))
    } catch { alert('Could not get location') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn variant="primary" size="sm" onClick={openAdd}>+ {t(lang, 'addLocation')}</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {locations.map(l => (
          <Card key={l.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{l.address}</div>
              </div>
              <Btn variant="secondary" size="sm" onClick={() => openEdit(l)}>Edit</Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: C.textSub }}>Lat: </span><span style={{ fontFamily: 'var(--font-mono)' }}>{l.lat?.toFixed(5)}</span></div>
              <div><span style={{ color: C.textSub }}>Lng: </span><span style={{ fontFamily: 'var(--font-mono)' }}>{l.lng?.toFixed(5)}</span></div>
              <div><span style={{ color: C.textSub }}>Radius: </span><strong>{l.radius_meters}m</strong></div>
              <div><span style={{ color: C.textSub }}>TZ: </span>{l.timezone}</div>
              <div><span style={{ color: C.textSub }}>Currency: </span>{l.currency}</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="danger" size="sm" onClick={() => del(l.id)}>Delete</Btn>
            </div>
          </Card>
        ))}
        {locations.length === 0 && <Card><EmptyState title={t(lang, 'noData')} sub="Add your first location" /></Card>}
      </div>

      <Popup open={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? 'Edit Location' : t(lang, 'addLocation')}>
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Name" value={editLoc.name || ''} onChange={e => setEditLoc(l => ({ ...l, name: e.target.value }))} />
          <Inp label={t(lang, 'address')} value={editLoc.address || ''} onChange={e => setEditLoc(l => ({ ...l, address: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude" type="number" value={editLoc.lat || ''} onChange={e => setEditLoc(l => ({ ...l, lat: Number(e.target.value) }))} />
            <Inp label="Longitude" type="number" value={editLoc.lng || ''} onChange={e => setEditLoc(l => ({ ...l, lng: Number(e.target.value) }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Btn variant="secondary" size="sm" onClick={detectLocation}>📍 {t(lang, 'detectLocation')}</Btn>
          </div>
          <Inp label={`${t(lang, 'radius')} (meters)`} type="number" value={editLoc.radius_meters || 100} onChange={e => setEditLoc(l => ({ ...l, radius_meters: Number(e.target.value) }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label={t(lang, 'timezone')} value={editLoc.timezone || 'America/New_York'} onChange={e => setEditLoc(l => ({ ...l, timezone: e.target.value }))}>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Anchorage">Alaska</option>
              <option value="Pacific/Honolulu">Hawaii</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Madrid">Madrid (CET)</option>
              <option value="America/Mexico_City">Mexico City</option>
              <option value="America/Bogota">Bogota</option>
            </Sel>
            <Sel label={t(lang, 'currency')} value={editLoc.currency || 'USD'} onChange={e => setEditLoc(l => ({ ...l, currency: e.target.value }))}>
              <option value="USD">USD</option><option value="EUR">EUR</option>
              <option value="MXN">MXN</option><option value="GBP">GBP</option>
              <option value="COP">COP</option><option value="CAD">CAD</option>
            </Sel>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t(lang, 'save')}</Btn>
        </div>
      </Popup>
    </div>
  )
}
