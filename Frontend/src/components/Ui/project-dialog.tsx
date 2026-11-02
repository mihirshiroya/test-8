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
  DEFAULT_TINT,
  normalizeTint,
  type TintKey,
  type IconKey,
} from './project-data'
import type { ProjectItem } from '../../pages/AppSidebar'

export type ProjectDraft = {
  name: string
  tint: TintKey
  icon: IconKey
}

export function ProjectDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ProjectItem
  onClose: () => void
  onSubmit: (draft: ProjectDraft) => void
}) {
  const [name, setName] = useState('')
  const [tint, setTint] = useState<TintKey>(DEFAULT_TINT)
  const [icon, setIcon] = useState<IconKey>('folder')

  useEffect(() => {
    if (open) {
      setName(initial?.label ?? '')
      setTint(normalizeTint(initial?.tint))
      setIcon(initial?.icon ?? 'folder')
    }
  }, [open, initial])

  const canSubmit = name.trim().length > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ name: name.trim(), tint, icon })
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={mode === 'create' ? 'New workspace' : 'Edit workspace'}
 
      footer={
        <>
          <AppDialogButton variant="secondary" onClick={onClose}>
            Cancel
          </AppDialogButton>
          <AppDialogButton type="submit" disabled={!canSubmit}>
            {mode === 'create' ? 'Create workspace' : 'Save changes'}
          </AppDialogButton>
        </>
      }
    >
      <AppDialogSection
        icon={<Type />}
        title="Workspace name"
        description="Shown in the sidebar and page headers."
        htmlFor="project-name"
      >
        <input
          id="project-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Website redesign"
          className={appDialogInputClass}
        />
      </AppDialogSection>

      <AppDialogSection icon={<Palette />} title="Color" description="Pick an accent for this workspace.">
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(FOLDER_TINTS) as TintKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Color ${key}`}
              aria-pressed={tint === key}
              onClick={() => setTint(key)}
              className={cn(
                'size-8 rounded-full border transition-transform hover:scale-110',
                tint === key ? 'scale-105 ring-2 ring-primary ring-offset-2' : '',
              )}
              style={{
                backgroundColor: FOLDER_TINTS[key].bg,
                borderColor: FOLDER_TINTS[key].fg,
                // @ts-expect-error css var for ring offset
                '--tw-ring-offset-color': 'var(--color-canvas)',
              }}
            />
          ))}
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
                  'flex size-[38px] items-center justify-center rounded-lg border border-soft transition-colors',
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
