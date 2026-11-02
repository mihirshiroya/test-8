'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Search } from 'lucide-react'
import { ThemedSvg } from '../lib/svg-theme'
import journalRaw from '../assets/10-journal.svg?raw'
import noResultsRaw from '../assets/31-no-results.svg?raw'

import {
  addFolder,
  updateFolder,
  deleteFolder,
  selectFolders,
  fetchFolders,
  type StoredFolder,
} from '../store/slices/notesSlice.ts'

import { FolderCard } from '../components/Ui/folder-card'

import {
  FolderDialog,
  type FolderDraft,
} from '../components/Ui/folder-dialog'

import { DeleteFolderDialog } from '../components/Ui/delete-folder-dialog'

export function Notes() {
  const dispatch = useDispatch()

  const folders = useSelector(selectFolders) as StoredFolder[]

  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)

  // ---------------------------------------------------------------------------
  // Folder dialog
  // create = create form
  // edit   = rename form
  // ---------------------------------------------------------------------------

  const [dialogMode, setDialogMode] = useState<
    'create' | 'edit' | null
  >(null)

  const [editingFolder, setEditingFolder] = useState<
    StoredFolder | undefined
  >(undefined)

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------

  const [deletingFolder, setDeletingFolder] = useState<
    StoredFolder | undefined
  >(undefined)

  useEffect(() => {
  setMounted(true)

  dispatch(fetchFolders())
}, [dispatch])

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return folders
    }

    return folders.filter((folder) =>
      (folder.title ?? '').toLowerCase().includes(normalizedQuery),
    )
  }, [folders, query])

  const isSearching = query.trim().length > 0

  // ---------------------------------------------------------------------------
  // Open create dialog
  // ---------------------------------------------------------------------------

  function openCreateDialog() {
    setEditingFolder(undefined)
    setDialogMode('create')
  }

  // ---------------------------------------------------------------------------
  // Open rename dialog (directly, no actions popup)
  // ---------------------------------------------------------------------------

  function openRenameDialog(folder: StoredFolder) {
    setEditingFolder(folder)
    setDialogMode('edit')
  }

  // ---------------------------------------------------------------------------
  // Create folder
  // ---------------------------------------------------------------------------

  function handleCreateSubmit(draft: FolderDraft) {
    dispatch(
      addFolder({
        title: draft.title,
        tint: draft.tint,
        icon: draft.icon,
      }),
    )

    closeFolderDialog()
  }

  // ---------------------------------------------------------------------------
  // Rename folder
  // ---------------------------------------------------------------------------

  function handleEditSubmit(draft: FolderDraft) {
    if (!editingFolder) {
      return
    }

    dispatch(
      updateFolder({
        id: editingFolder.id,
        title: draft.title,
        tint: draft.tint,
        icon: draft.icon,
      }),
    )

    closeFolderDialog()
  }

  // ---------------------------------------------------------------------------
  // Close create/edit dialog
  // ---------------------------------------------------------------------------

  function closeFolderDialog() {
    setDialogMode(null)
    setEditingFolder(undefined)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function handleDeleteConfirm() {
    if (!deletingFolder) {
      return
    }

    dispatch(deleteFolder(deletingFolder.id))

    setDeletingFolder(undefined)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}

        <header className="flex items-center gap-3 pb-4">
          <h1 className="shrink-0 text-heading-3 text-primary text-balance !font-inter">
            All Notes
          </h1>

          <div className="ml-auto flex h-10 min-w-0 flex-1 items-center gap-2 border border-soft px-3 sm:max-w-xs !font-inter">
            <Search className="size-4 shrink-0 text-stone" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders…"
              aria-label="Search folders"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone"
            />
          </div>

          {/* CREATE */}
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex h-10 shrink-0 items-center gap-2 bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-pressed"
          >
            <Plus className="size-4" />

          </button>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Folder list                                                       */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex-1 overflow-y-auto pb-8 mt-4">
          {!mounted ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[124px] animate-pulse border border-soft bg-gray-tint/50"
                />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onEdit={() => openRenameDialog(folder)}
                  onDelete={() => setDeletingFolder(folder)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center border border-dashed border-soft px-6 py-10 text-center">
              <ThemedSvg
                raw={isSearching ? noResultsRaw : journalRaw}
                className="mb-4 h-32 w-32 [&>svg]:h-full [&>svg]:w-full"
              />
              <h2 className="text-base font-medium text-ink">
                {isSearching ? 'No matching notes' : 'No notes found'}
              </h2>
              <p className="mt-1 max-w-xs text-sm text-steel">
                {isSearching
                  ? `Nothing matches "${query.trim()}". Try a different search.`
                  : 'Start a note to capture your thoughts and keep them organized.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* CREATE / RENAME DIALOG                                              */}
      {/* =================================================================== */}

      <FolderDialog
        open={dialogMode !== null}
        mode={dialogMode === 'edit' ? 'edit' : 'create'}
        initial={editingFolder}
        onClose={closeFolderDialog}
        onSubmit={
          dialogMode === 'edit'
            ? handleEditSubmit
            : handleCreateSubmit
        }
      />

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION                                                 */}
      {/* =================================================================== */}

      <DeleteFolderDialog
        open={deletingFolder !== undefined}
        folder={deletingFolder}
        onClose={() => setDeletingFolder(undefined)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
