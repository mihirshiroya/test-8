import type { ReactNode } from 'react'
import { AppDialog } from './app-dialog'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return <AppDialog open={isOpen} onClose={onClose} title={title ?? 'Dialog'}>{children}</AppDialog>
}
