import { useCallback, useEffect, useRef, useState } from 'react'
import { AppDialogButton } from './app-dialog'
import { WorkDialog } from './work-dialog'

type ConfirmOptions = { title?: string; confirmLabel?: string; destructive?: boolean }
type ConfirmRequest = ConfirmOptions & { message: string }

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  useEffect(() => () => {
    resolveRef.current?.(false)
    resolveRef.current = null
  }, [])

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => new Promise<boolean>(resolve => {
    resolveRef.current?.(false)
    resolveRef.current = resolve
    setRequest({ message, ...options })
  }), [])

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setRequest(null)
    resolve?.(confirmed)
  }, [])

  const dialog = request && <WorkDialog
    title={request.title ?? 'Discard unsaved changes?'}
    role="alertdialog"
    onClose={() => settle(false)}
    footer={<>
      <AppDialogButton autoFocus variant="secondary" onClick={() => settle(false)}>Cancel</AppDialogButton>
      <AppDialogButton variant={request.destructive === false ? 'primary' : 'destructive'} onClick={() => settle(true)}>
        {request.confirmLabel ?? 'Discard changes'}
      </AppDialogButton>
    </>}
  >
    <p className="kumo-dialog-description">{request.message}</p>
  </WorkDialog>

  return { confirm, dialog }
}
