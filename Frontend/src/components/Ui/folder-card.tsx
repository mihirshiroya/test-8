'use client'

import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2, FileText, Edit3, ArrowUpRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  relativeTime,
  type Folder,
} from './folder-data'

export function FolderCard({
  folder,
  onEdit,
  onDelete,
}: {
  folder: Folder
  onEdit?: () => void
  onDelete?: () => void
}) {
  const navigate = useNavigate()

  const Icon = FOLDER_ICONS[folder.icon]
  const tint = FOLDER_TINTS[folder.tint]

  const goToNotes = () => {
    navigate(`/notes/${folder.id}`)
  }

  const goToEditNotes = () => {
    navigate(`/notes/${folder.id}/edit`)
  }

  return (
    <article className="group relative gap-y-5 flex flex-col border border-soft p-4 transition-all hover:shadow-[0_8px_24px_-8px_rgba(15,15,15,0.16)]">
      <div className="flex items-start justify-between">
        <span
          className="flex size-10 items-center justify-center"
          style={{ backgroundColor: tint.bg }}
        >
          <Icon className="size-5" />
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Go to notes"
            onClick={goToNotes}
            className="flex size-8 items-center justify-center text-steel hover:bg-gray-tint hover:text-ink"
          >
            <ArrowUpRight className="size-[18px]" />
          </button>

          {onEdit && onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Folder actions"
                className="flex size-8 items-center justify-center text-steel hover:bg-gray-tint data-popup-open:bg-gray-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal className="size-[18px] rotate-90" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                <DropdownMenuItem
                  onClick={goToEditNotes}
                  className="gap-2 !text-inter rounded-none px-2.5 py-2 text-steel data-highlighted:bg-gray-tint data-highlighted:text-ink"
                >
                  <Edit3 className="size-4" />
                  Edit notes
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onEdit}
                  className="gap-2 !text-inter rounded-none px-2.5 py-2 text-steel data-highlighted:bg-gray-tint data-highlighted:text-ink"
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>

        

                <DropdownMenuItem
                  variant="destructive"
                  onClick={onDelete}
                  className="gap-2 text-inter! rounded-none px-2.5 py-2 text-error data-highlighted:bg-rose data-highlighted:text-error"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
          <div className="flex flex-col gap-2">
            <button
        type="button"
        onClick={goToNotes}
        className="mt-4 text-left"
      >
        <h3 className="truncate text-heading-5 font-semibold capitalize text-ink">
          {folder.title}
        </h3>
      </button>

      <div className="mt-1 flex items-center gap-1.5 text-sm leading-none text-steel">
  <FileText className="size-3.5 shrink-0" />

  <span className="leading-none">
    {folder.items} {folder.items === 1 ? "section" : "sections"}
  </span>

  <span className="text-stone leading-none">·</span>

  <span className="text-[12px] leading-none">
    {relativeTime(folder.updatedAt)}
  </span>
</div>
          </div>
      

    </article>
  )
}
