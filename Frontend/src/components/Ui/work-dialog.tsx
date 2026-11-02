import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function WorkDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
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
  return createPortal(<dialog ref={ref} aria-labelledby={titleId} aria-busy={busy} className="work-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose() } }}>
    <header className="flex items-center justify-between gap-4 border-b border-soft p-5"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" className="work-icon" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <div className="p-5">{children}</div>
  </dialog>, document.body)
}
