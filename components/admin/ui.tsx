import React from 'react'

// ─── Colors ────────────────────────────────────────────────
export const AC = {
  bg: '#E8EAED',
  card: '#FFFFFF',
  sidebar: '#0D1117',
  accent: '#2563EB',
  accent2: '#1D4ED8',
  success: '#059669',
  danger: '#DC2626',
  warning: '#D97706',
  purple: '#7C3AED',
  teal: '#0891B2',
  border: '#D1D5DB',
  text: '#111827',
  sub: '#6B7280',
  muted: '#9CA3AF',
}

// Position color palette — 12 distinct colors for position types
export const POSITION_COLORS: Record<string, string> = {
  'Manager':        '#2563EB',
  'Supervisor':     '#7C3AED',
  'Server':         '#059669',
  'Cashier':        '#0891B2',
  'Cook':           '#EA580C',
  'Chef':           '#DC2626',
  'Bartender':      '#DB2777',
  'Host':           '#65A30D',
  'Security':       '#374151',
  'Cleaner':        '#78716C',
  'Driver':         '#CA8A04',
  'Associate':      '#0E7490',
  'default':        '#6B7280',
}

export function getPositionColor(position: string): string {
  if (!position) return POSITION_COLORS.default
  const key = Object.keys(POSITION_COLORS).find(k =>
    position.toLowerCase().includes(k.toLowerCase())
  )
  return key ? POSITION_COLORS[key] : POSITION_COLORS.default
}

// ─── Card ──────────────────────────────────────────────────
export function ACard({ children, style = {}, pad = 20 }: { children: React.ReactNode; style?: React.CSSProperties; pad?: number }) {
  return (
    <div className="adm-card" style={{ padding: pad, ...style }}>
      {children}
    </div>
  )
}

// ─── KPI ───────────────────────────────────────────────────
export function AKpi({ label, value, sub, color, accent }: { label: string; value: React.ReactNode; sub?: string; color?: string; accent?: string }) {
  return (
    <div className="adm-kpi">
      {accent && <div className="adm-kpi-accent" style={{ background: accent }} />}
      <div className="adm-kpi-label">{label}</div>
      <div className="adm-kpi-value" style={{ color: color || AC.text }}>{value}</div>
      {sub && <div className="adm-kpi-sub">{sub}</div>}
    </div>
  )
}

// ─── Button ────────────────────────────────────────────────
type ABtnVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
interface ABtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: ABtnVariant
  size?: 'sm' | 'md'
  disabled?: boolean
  full?: boolean
  style?: React.CSSProperties
  type?: 'button' | 'submit'
}
export function ABtn({ children, onClick, variant = 'primary', size = 'md', disabled = false, full = false, style = {}, type = 'button' }: ABtnProps) {
  const cls = `adm-btn adm-btn-${variant}${size === 'sm' ? ' adm-btn-sm' : ''}`
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={{ width: full ? '100%' : undefined, justifyContent: full ? 'center' : undefined, ...style }}>
      {children}
    </button>
  )
}

// ─── Badge ─────────────────────────────────────────────────
type ABadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'
export function ABadge({ children, color = 'blue' }: { children: React.ReactNode; color?: ABadgeColor }) {
  return <span className={`adm-badge adm-badge-${color}`}>{children}</span>
}

export function AStatusBadge({ status }: { status: string }) {
  const map: Record<string, ABadgeColor> = {
    active: 'green', approved: 'green', paid: 'green', valid: 'green', open: 'blue', hired: 'green',
    pending: 'yellow', draft: 'gray', scheduled: 'blue', processed: 'blue', processing: 'yellow',
    inactive: 'gray', rejected: 'red', expired: 'red', cancelled: 'red', closed: 'gray',
  }
  return <ABadge color={map[status] || 'gray'}>{status}</ABadge>
}

// ─── Input ─────────────────────────────────────────────────
interface AInpProps {
  label?: string
  type?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  required?: boolean
  style?: React.CSSProperties
}
export function AInp({ label, type = 'text', value, onChange, placeholder = '', rows = 0, disabled = false, required = false, style = {} }: AInpProps) {
  return (
    <div className="adm-form-group">
      {label && <label className="adm-label">{label}{required && <span style={{ color: AC.danger }}> *</span>}</label>}
      {rows > 0
        ? <textarea className="adm-textarea" rows={rows} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} style={style} />
        : <input className="adm-input" type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} style={style} />}
    </div>
  )
}

// ─── Select ────────────────────────────────────────────────
interface ASelProps {
  label?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  disabled?: boolean
}
export function ASel({ label, value, onChange, children, disabled = false }: ASelProps) {
  return (
    <div className="adm-form-group">
      {label && <label className="adm-label">{label}</label>}
      <select className="adm-select" value={value} onChange={onChange} disabled={disabled}>{children}</select>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────
interface AModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}
export function AModal({ open, onClose, title, children, wide = false }: AModalProps) {
  if (!open) return null
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className={`adm-modal${wide ? ' adm-modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <span className="adm-modal-title">{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: AC.sub, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────
export function APageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="adm-section-header">
      <div>
        <div className="adm-section-title">{title}</div>
        {sub && <div className="adm-section-sub">{sub}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as any }}>{children}</div>}
    </div>
  )
}

// ─── Toggle ────────────────────────────────────────────────
export function AToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        className="adm-toggle-track"
        onClick={() => onChange(!value)}
        style={{ background: value ? AC.accent : '#D1D5DB' }}
      >
        <div className="adm-toggle-thumb" style={{ left: value ? 22 : 2 }} />
      </div>
      {label && <span style={{ fontSize: 13, fontWeight: 500, color: AC.text }}>{label}</span>}
    </label>
  )
}

// ─── Empty state ───────────────────────────────────────────
export function AEmpty({ title = 'No data', sub }: { title?: string; sub?: string }) {
  return (
    <div className="adm-empty">
      <div style={{ fontSize: 32, opacity: 0.3 }}>○</div>
      <div className="adm-empty-title">{title}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Alert ─────────────────────────────────────────────────
export function AAlert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const cls = { info: 'adm-alert-info', success: 'adm-alert-success', warning: 'adm-alert-warning', error: 'adm-alert-error' }
  return <div className={`adm-alert ${cls[type]}`}>{children}</div>
}

// ─── Avatar ────────────────────────────────────────────────
export function AAvatar({ emp, size = 32 }: { emp?: any; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: emp?.avatar_url ? 'transparent' : AC.accent, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size * 0.34, fontWeight: 700, color: '#fff' }}>
      {emp?.avatar_url
        ? <img src={emp.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (emp?.first_name?.[0] || '') + (emp?.last_name?.[0] || '')}
    </div>
  )
}
