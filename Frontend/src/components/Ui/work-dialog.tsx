import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function WorkDialog({ title, children, onClose, busy = false, footer, role = 'dialog' }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; footer?: ReactNode; role?: 'dialog' | 'alertdialog' }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return createPortal(<dialog ref={ref} role={role} aria-labelledby={titleId} aria-busy={busy} className="work-dialog kumo-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose() } }}>
    <header className="kumo-dialog-header">
      <h2 id={titleId} className="kumo-dialog-title">{title}</h2>
      <button type="button" className="kumo-dialog-close" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={16} /></button>
    </header>
    <div className="kumo-dialog-card">
      <div className="kumo-dialog-body">{children}</div>
      {footer && <footer className="kumo-dialog-footer">{footer}</footer>}
    </div>
  </dialog>, document.body)
}
