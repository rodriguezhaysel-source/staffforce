import React from 'react'
import { Icon } from './Icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: string
}

export function Modal({ open, onClose, title, children, size = '' }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
