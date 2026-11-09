import { ArrowLeft, BookOpen, FileText, Menu, Pencil, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NoteCodePreview } from './note-code-preview'

const LINE = 'border-docs-line'
const MUTED = 'text-docs-muted'
const INK = 'text-docs-ink'
const HOVER_SOFT = 'hover:bg-docs-soft'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-docs-accent'
const ICON_BUTTON = `inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${MUTED} ${HOVER_SOFT} hover:text-docs-ink ${FOCUS}`

interface DocsChromeProps {
  title: string
  folderId: string
  editable?: boolean
  onSearch: () => void
}

function DocsIdentity({ title, editable, hideMarkOnMobile = false }: Pick<DocsChromeProps, 'title' | 'editable'> & { hideMarkOnMobile?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2.5 text-[13px] tracking-[-0.02em] ${INK} ${hideMarkOnMobile ? 'flex-1' : ''}`}>
    <span
      aria-hidden="true"
      className={`size-[33px] shrink-0 items-center justify-center rounded-xs border border-soft  ${hideMarkOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      <BookOpen size={19} strokeWidth={1.7} className="text-secondary" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-docs-ink" title={title}>{title}</p>
      <p className={`mt-0.5 text-[10px] font-normal tracking-[0.01em] ${MUTED}`}>{editable ? 'Docs workspace' : 'Handbook'}</p>
    </div>
  </div>
}

export function DocsSidebarHeader({ title, onSearch, onClose }: Omit<DocsChromeProps, 'folderId'> & { onClose: () => void }) {
  return <div className="flex shrink-0 flex-col gap-3 p-4">
    <div className="flex items-center justify-between gap-2 md:hidden">
      <span className={`truncate text-xs font-medium ${INK}`}>{title}</span>
      <button type="button" className={ICON_BUTTON} onClick={onClose} aria-label="Close navigation"><X size={16} /></button>
    </div>
    <button
      type="button"
      className={`docs-sidebar-search flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-docs-line-strong bg-docs-soft px-3 py-2 text-left text-xs transition-colors ${MUTED} ${FOCUS}`}
      onClick={onSearch}
      aria-label="Search documentation"
    >
      <Search size={14} className="shrink-0" />
      <span className="text-steel">Search the docs</span>
      <kbd className="ml-auto whitespace-nowrap font-[inherit] text-[10px] opacity-75">⌘ K</kbd>
    </button>
  </div>
}

export function DocsSidebarFooter({ folderId, editable }: Pick<DocsChromeProps, 'folderId' | 'editable'>) {
  return <footer className={`mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-soft px-[18px] py-[17px] text-[11px]`}>
    <Link to="/notes" className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-colors text-steel`}>
      <ArrowLeft size={13} /> All notes
    </Link>
    <Link
      to={`/notes/${folderId}${editable ? '' : '/edit'}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-docs-line-strong bg-docs-soft text-docs-ink px-[9px] py-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors `}
    >
      {editable ? <FileText size={13} /> : <Pencil size={13} />}{editable ? 'View docs' : 'Edit docs'}
    </Link>
  </footer>
}

export function DocsWorkspaceHeader({ title, folderId, editable, onSearch, onOpen, open }: DocsChromeProps & { onOpen: () => void; open: boolean }) {
  return <header className={`docs-workbench-header flex min-h-16 shrink-0 items-center justify-between gap-3 border-b px-4 ${LINE}`}>
    <div className="flex min-w-0 items-center gap-3">
      <Link to="/notes" aria-label="Back to all notes" className={ICON_BUTTON}><ArrowLeft size={17} /></Link>
      <span aria-hidden="true" className="h-6 border-l border-docs-line" />
      <button type="button" className={`${ICON_BUTTON} md:hidden`} onClick={onOpen} aria-label="Open navigation" aria-expanded={open} aria-controls="handbook-navigation"><Menu size={18} /></button>
      <DocsIdentity title={title} editable={editable} hideMarkOnMobile />
    </div>
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      <nav aria-label="Documentation mode" className="docs-mode-switch">
        <Link to={`/notes/${folderId}`} aria-label="Read documentation" aria-current={!editable ? 'page' : undefined}><FileText size={13} /><span>Read</span></Link>
        <Link to={`/notes/${folderId}/edit`} aria-label="Edit documentation" aria-current={editable ? 'page' : undefined}><Pencil size={13} /><span>Edit</span></Link>
      </nav>
      <button type="button" className={ICON_BUTTON} onClick={onSearch} aria-label="Search documentation"><Search size={17} /></button>
    </div>
  </header>
}

export function DocsCodeBlock({
  label,
  content,
  copied,
  onCopy,
}: {
  label: string
  content: string
  copied: boolean
  onCopy: () => void
}) {
  return <NoteCodePreview content={content} language={label} copied={copied} onCopy={onCopy} />
}
