import { useEffect, useState, type FormEvent } from 'react'
import { Palette, Shapes, Type } from 'lucide-react'

import { cn } from '../../lib/utills'
import {
  AppDialog,
  AppDialogButton,
  AppDialogSection,
  appDialogInputClass,
} from './app-dialog'

import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  type Folder,
  type TintKey,
  type IconKey,
} from './folder-data'

export type FolderDraft = {
  title: string
  tint: TintKey
  icon: IconKey
}

type FolderDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial?: Folder
  onClose: () => void
  onSubmit?: (draft: FolderDraft) => void
}

export function FolderDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: FolderDialogProps) {
  const [title, setTitle] = useState('')
  const [tint, setTint] = useState<TintKey>('blue')
  const [icon, setIcon] = useState<IconKey>('folder')

  useEffect(() => {
    if (!open) return

    setTitle(initial?.title ?? '')
    setTint(initial?.tint ?? 'blue')
    setIcon(initial?.icon ?? 'folder')
  }, [open, initial])

  const canSubmit = title.trim().length > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || !onSubmit) return
    onSubmit({ title: title.trim(), tint, icon })
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={mode === 'create' ? 'New folder' : 'Rename folder'}

      footer={
        <>
          <AppDialogButton variant="secondary" onClick={onClose}>
            Cancel
          </AppDialogButton>
          <AppDialogButton type="submit" disabled={!canSubmit}>
            {mode === 'create' ? 'Create folder' : 'Save changes'}
          </AppDialogButton>
        </>
      }
    >
      <AppDialogSection
        icon={<Type />}
        title="Folder name"
        description="Helps you find these notes later."
        htmlFor="folder-title"
      >
        <input
          id="folder-title"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Product specs"
          className={appDialogInputClass}
        />
      </AppDialogSection>

      <AppDialogSection icon={<Palette />} title="Color" description="Pick an accent for this folder.">
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(FOLDER_TINTS) as TintKey[]).map((key) => {
            const color = FOLDER_TINTS[key]
            const selected = tint === key

            return (
              <button
                key={key}
                type="button"
                aria-label={`Color ${key}`}
                aria-pressed={selected}
                onClick={() => setTint(key)}
                className={cn(
                  'size-8 rounded-full border transition-transform hover:scale-110',
                  selected ? 'scale-105 ring-2 ring-primary ring-offset-2' : '',
                )}
                style={{
                  backgroundColor: color.bg,
                  borderColor: color.fg,
                  // @ts-expect-error CSS custom property
                  '--tw-ring-offset-color': 'var(--color-canvas)',
                }}
              />
            )
          })}
        </div>
      </AppDialogSection>

      <AppDialogSection icon={<Shapes />} title="Icon" description="Choose a symbol that fits.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOLDER_ICONS) as IconKey[]).map((key) => {
            const Icon = FOLDER_ICONS[key]
            const selected = icon === key

            return (
              <button
                key={key}
                type="button"
                aria-label={`Icon ${key}`}
                aria-pressed={selected}
                onClick={() => setIcon(key)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg border border-soft transition-colors',
                  selected ? 'text-primary' : 'text-steel hover:bg-gray-tint hover:text-ink',
                )}
                style={{
                  backgroundColor: selected ? FOLDER_TINTS[tint].bg : 'transparent',
                  borderColor: selected ? FOLDER_TINTS[tint].fg : '',
                }}
              >
                <Icon className="size-5" />
              </button>
            )
          })}
        </div>
      </AppDialogSection>
    </AppDialog>
  )
}
