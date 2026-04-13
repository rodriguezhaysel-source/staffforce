import React from 'react'

// ─── Design tokens ─────────────────────────────────────────
export const C = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  sidebar: '#0F1A2E',
  accent: '#0A6EBD',
  accentHover: '#095AA3',
  accentLight: '#EFF6FF',
  accentBorder: '#BFDBFE',
  success: '#059669',
  successBg: '#D1FAE5',
  successBorder: '#A7F3D0',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
}

// ─── Avatar ────────────────────────────────────────────────
export function Avatar({ emp, size = 32, color }: { emp?: any; size?: number; color?: string }) {
  const avUrl = emp?.avatar_url
  const bg = avUrl ? 'transparent' : (color || C.accent)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${C.border}` }}>
      {avUrl
        ? <img src={avUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontSize: size * 0.35, fontWeight: 700 }}>
            {(emp?.first_name?.[0] || '') + (emp?.last_name?.[0] || '')}
          </span>}
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────
export function Card({ children, style = {}, pad = 20 }: { children: React.ReactNode; style?: React.CSSProperties; pad?: number }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: pad, ...style }}>
      {children}
    </div>
  )
}

// ─── Button ────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost'
type BtnSize = 'sm' | 'md' | 'lg'
interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: BtnSize
  disabled?: boolean
  full?: boolean
  style?: React.CSSProperties
  type?: 'button' | 'submit' | 'reset'
}
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled = false, full = false, style = {}, type = 'button' }: BtnProps) {
  const vs: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: C.accent, color: '#fff', border: 'none' },
    secondary: { background: '#F8FAFC', color: C.text, border: `1px solid ${C.border}` },
    success: { background: C.success, color: '#fff', border: 'none' },
    danger: { background: C.danger, color: '#fff', border: 'none' },
    warning: { background: C.warning, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: C.accent, border: `1px solid ${C.accentBorder}` },
  }
  const ss: Record<BtnSize, React.CSSProperties> = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 18px', fontSize: 13 },
    lg: { padding: '12px 28px', fontSize: 15 },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...ss[size], ...vs[variant], borderRadius: 8, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' as any,
        width: full ? '100%' : undefined, justifyContent: full ? 'center' : undefined, ...style
      }}
    >
      {children}
    </button>
  )
}

// ─── Badge ─────────────────────────────────────────────────
type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'
export function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: BadgeColor }) {
  const cs: Record<BadgeColor, [string, string]> = {
    blue: [C.accentLight, C.accent],
    green: [C.successBg, C.success],
    red: [C.dangerBg, C.danger],
    yellow: [C.warningBg, C.warning],
    gray: ['#F1F5F9', C.textSub],
    purple: ['#F5F3FF', '#7C3AED'],
  }
  const [bg, text] = cs[color] || cs.blue
  return (
    <span style={{ background: bg, color: text, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' as any }}>
      {children}
    </span>
  )
}

// ─── Input ─────────────────────────────────────────────────
interface InpProps {
  label?: string
  type?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  style?: React.CSSProperties
  rows?: number
  disabled?: boolean
  required?: boolean
}
export function Inp({ label, type = 'text', value, onChange, placeholder = '', style = {}, rows = 0, disabled = false, required = false }: InpProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    color: C.text, background: disabled ? '#F8FAFC' : '#fff', ...style
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>{label}{required && <span style={{ color: C.danger }}> *</span>}</label>}
      {rows > 0
        ? <textarea rows={rows} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} style={{ ...inputStyle, resize: 'vertical' as any }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} style={inputStyle} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />}
    </div>
  )
}

// ─── Select ────────────────────────────────────────────────
interface SelProps {
  label?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  style?: React.CSSProperties
  disabled?: boolean
}
export function Sel({ label, value, onChange, children, style = {}, disabled = false }: SelProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>{label}</label>}
      <select value={value} onChange={onChange} disabled={disabled} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as any, color: C.text, background: '#fff', ...style }}>
        {children}
      </select>
    </div>
  )
}

// ─── Table helpers ─────────────────────────────────────────
export function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as any }}>{children}</th>
}
export function Td({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '11px 16px', fontSize: 13, color: C.text, borderBottom: `1px solid #F8FAFC`, verticalAlign: 'middle', ...style }}>{children}</td>
}

// ─── Modal / Popup ─────────────────────────────────────────
interface PopupProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}
export function Popup({ open, onClose, title, children, wide = false }: PopupProps) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: wide ? 860 : 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────
export function Kpi({ label, value, sub, color, icon }: { label: string; value: React.ReactNode; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 140, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color || C.text, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── Page header ───────────────────────────────────────────
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as any, gap: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.5px' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as any }}>{children}</div>}
    </div>
  )
}

// ─── Status badge helper ────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeColor> = {
    active: 'green', approved: 'green', paid: 'green', valid: 'green', hired: 'green', open: 'blue',
    pending: 'yellow', draft: 'gray', scheduled: 'blue', processing: 'yellow', processed: 'blue',
    inactive: 'gray', rejected: 'red', expired: 'red', cancelled: 'red', closed: 'gray',
    suspended: 'red', 'pending_activation': 'yellow',
  }
  return <Badge color={map[status] || 'gray'}>{status}</Badge>
}

// ─── Stars rating ──────────────────────────────────────────
export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={() => onChange?.(i)}
          style={{ fontSize: size, cursor: onChange ? 'pointer' : 'default', color: i <= value ? '#F59E0B' : '#E2E8F0' }}
        >★</span>
      ))}
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────
export function EmptyState({ title = 'No data found', sub }: { title?: string; sub?: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' as any }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textSub, marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted }}>{sub}</div>}
    </div>
  )
}

// ─── Toggle switch ─────────────────────────────────────────
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, background: value ? C.accent : '#E2E8F0', position: 'relative', transition: 'all 0.2s', cursor: 'pointer', flexShrink: 0 }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      {label && <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}</span>}
    </label>
  )
}

// ─── Section divider ───────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '1px', padding: '10px 0 4px' }}>{children}</div>
}

// ─── Alert box ─────────────────────────────────────────────
export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const map = {
    info: [C.accentLight, C.accentBorder, C.accent],
    success: [C.successBg, C.successBorder, C.success],
    warning: [C.warningBg, C.warningBorder, C.warning],
    error: [C.dangerBg, C.dangerBorder, C.danger],
  }
  const [bg, border, color] = map[type]
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 13, color, fontWeight: 500 }}>{children}</span>
    </div>
  )
}
