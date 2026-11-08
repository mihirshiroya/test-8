import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utills'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const

type AppDialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof SIZES
  role?: 'dialog' | 'alertdialog'
  /** When false, Escape, backdrop clicks and the close button are disabled (e.g. while saving). */
  dismissible?: boolean
  /** Renders the panel as a <form> so footer submit buttons and Enter work natively. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  className?: string
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  dismissible = true,
  onSubmit,
  className,
}: AppDialogProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (!panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus()
    }

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  if (!open) return null

  const panelClass = cn(
    'kumo-dialog relative max-h-[calc(100dvh-2rem)] w-full outline-none',
    SIZES[size],
    className,
  )

  const content = (
    <>
      <header className="kumo-dialog-header">
        <h2 id={titleId} className="kumo-dialog-title">
          {title}
        </h2>

        <button
          type="button"
          onClick={onClose}
          disabled={!dismissible}
          aria-label="Close"
          className="kumo-dialog-close"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="kumo-dialog-card">
        <div className="kumo-dialog-body">
          {description && (
            <p id={descId} className="kumo-dialog-description">
              {description}
            </p>
          )}
          {children}
        </div>

        {footer && <footer className="kumo-dialog-footer">{footer}</footer>}
      </div>
    </>
  )

  const a11y = {
    role,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': description ? descId : undefined,
    tabIndex: -1,
    className: panelClass,
  } as const

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={() => dismissible && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {onSubmit ? (
        <form
          {...a11y}
          ref={(node) => {
            panelRef.current = node
          }}
          onSubmit={onSubmit}
          noValidate
        >
          {content}
        </form>
      ) : (
        <div
          {...a11y}
          ref={(node) => {
            panelRef.current = node
          }}
        >
          {content}
        </div>
      )}
    </div>,
    document.body,
  )
}

/** Bordered card used to group related controls inside an AppDialog body. */
export function AppDialogSection({
  icon,
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  /** Associates the section title with a form control as its <label>. */
  htmlFor?: string
  children?: ReactNode
  className?: string
}) {
  const TitleTag = htmlFor ? 'label' : 'p'

  return (
    <section className={cn('kumo-dialog-section', className)}>
      {(icon || title || description) && (
        <div className="flex items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="kumo-dialog-section-icon"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <TitleTag
                htmlFor={htmlFor}
                className="block text-[13px] font-medium text-ink"
              >
                {title}
              </TitleTag>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-steel">{description}</p>
            )}
          </div>
        </div>
      )}

      {children && (
        <div className={cn((icon || title || description) && 'mt-3')}>{children}</div>
      )}
    </section>
  )
}

const BUTTON_VARIANTS = {
  primary: 'kumo-button kumo-button--primary',
  secondary: 'kumo-button',
  destructive: 'kumo-button kumo-button--danger',
} as const

export function AppDialogButton({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS
}) {
  return (
    <button
      type={type}
      className={cn(
        'disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

export const appDialogInputClass = 'kumo-input w-full'
