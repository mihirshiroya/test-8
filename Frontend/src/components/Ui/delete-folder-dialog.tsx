import { AppDialog, AppDialogButton } from './app-dialog'
import type { Folder } from './folder-data'

export function DeleteFolderDialog({
  open,
  folder,
  onClose,
  onConfirm,
}: {
  open: boolean
  folder?: Folder
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <AppDialog
      open={open && !!folder}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      title={<>Delete &quot;{folder?.title}&quot;?</>}
      description="This permanently removes the folder and all of its published notes. This can't be undone."
      footer={
        <>
          <AppDialogButton variant="secondary" onClick={onClose}>
            Cancel
          </AppDialogButton>
          <AppDialogButton variant="destructive" onClick={onConfirm}>
            Delete folder
          </AppDialogButton>
        </>
      }
    />
  )
}
