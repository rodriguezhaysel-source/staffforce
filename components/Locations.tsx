import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { Modal } from './shared/Modal'
import { Icon } from './shared/Icons'
import { getCurrentPosition } from '../lib/geo'
import type { Employee, Location } from '../lib/store'

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
    if (isEdit && editLoc.id) { await supabase.from('locations').update(editLoc).eq('id', editLoc.id) }
    else { await supabase.from('locations').insert(editLoc) }
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
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Icon name="plus" size={14} />{t(lang, 'addLocation')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {locations.map(l => (
          <div key={l.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{l.address}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(l)}><Icon name="edit" size={13} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Lat: </span><span className="mono">{l.lat?.toFixed(5)}</span></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Lng: </span><span className="mono">{l.lng?.toFixed(5)}</span></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Radius: </span><strong>{l.radius_meters}m</strong></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>TZ: </span>{l.timezone}</div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Currency: </span>{l.currency}</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" onClick={() => del(l.id)}><Icon name="trash" size={12} /></button>
            </div>
          </div>
        ))}
        {locations.length === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div><div className="empty-state-sub">Add your first location</div></div></div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? 'Edit Location' : t(lang, 'addLocation')}>
        <div className="modal-body">
          <div className="form-group"><label>Name</label><input value={editLoc.name || ''} onChange={e => setEditLoc(l => ({ ...l, name: e.target.value }))} /></div>
          <div className="form-group"><label>{t(lang, 'address')}</label><input value={editLoc.address || ''} onChange={e => setEditLoc(l => ({ ...l, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>Latitude</label><input type="number" step="any" value={editLoc.lat || ''} onChange={e => setEditLoc(l => ({ ...l, lat: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>Longitude</label><input type="number" step="any" value={editLoc.lng || ''} onChange={e => setEditLoc(l => ({ ...l, lng: Number(e.target.value) }))} /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <button className="btn btn-secondary btn-sm" onClick={detectLocation}><Icon name="pin" size={13} />{t(lang, 'detectLocation')}</button>
          </div>
          <div className="form-group"><label>{t(lang, 'radius')} (meters)</label><input type="number" value={editLoc.radius_meters || 100} onChange={e => setEditLoc(l => ({ ...l, radius_meters: Number(e.target.value) }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'timezone')}</label>
              <select value={editLoc.timezone || 'America/New_York'} onChange={e => setEditLoc(l => ({ ...l, timezone: e.target.value }))}>
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
              </select>
            </div>
            <div className="form-group"><label>{t(lang, 'currency')}</label>
              <select value={editLoc.currency || 'USD'} onChange={e => setEditLoc(l => ({ ...l, currency: e.target.value }))}>
                <option value="USD">USD</option><option value="EUR">EUR</option>
                <option value="MXN">MXN</option><option value="GBP">GBP</option>
                <option value="COP">COP</option><option value="CAD">CAD</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t(lang, 'save')}</button>
        </div>
      </Modal>
    </div>
  )
}
