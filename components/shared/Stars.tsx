import React from 'react'
import { Icon } from './Icons'

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} onClick={() => onChange && onChange(i)} style={{ cursor: onChange ? 'pointer' : 'default' }}>
          {i <= value
            ? <Icon name="starFilled" size={14} color="var(--warning)" />
            : <Icon name="star" size={14} color="var(--border)" />}
        </span>
      ))}
    </div>
  )
}
