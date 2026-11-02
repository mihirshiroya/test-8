import { ArrowLeft, BookOpen, Check, Copy, FileText, Menu, Pencil, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const LINE = 'border-[#eeecf2] dark:border-[#302c38]'
const MUTED = 'text-[#716d79] dark:text-[#aaa4b5]'
const INK = 'text-[#28262e] dark:text-[#eeeaf4]'
const SOFT_BG = 'bg-[#f7f6f9] dark:bg-[#24212b]'
const HOVER_SOFT = 'hover:bg-[#f7f6f9] dark:hover:bg-[#24212b]'
const ACCENT_BORDER_HOVER = 'hover:border-[#6950a8] dark:hover:border-[#c1a5ef]'
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#6950a8] dark:focus-visible:outline-[#c1a5ef]'
const ICON_BUTTON = `inline-flex min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${MUTED} ${HOVER_SOFT} hover:text-[#28262e] dark:hover:text-[#eeeaf4] ${FOCUS}`

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
      <p className="truncate font-semibold text-xl text-primary" title={title}>{title}</p>
      <p className={`mt-0.5 text-[10px] font-normal tracking-[0.01em] ${MUTED}`}>{editable ? 'Docs workspace' : 'Handbook'}</p>
    </div>
  </div>
}

export function DocsSidebarHeader({ title, editable, onSearch, onClose }: Omit<DocsChromeProps, 'folderId'> & { onClose: () => void }) {
  return <div className="flex shrink-0 flex-col gap-6 px-[18px] pb-6 pt-[26px]">
    <div className="flex min-w-0 items-center justify-between gap-2">
      <DocsIdentity title={title} editable={editable} />
      <button type="button" className={`${ICON_BUTTON} md:hidden`} onClick={onClose} aria-label="Close navigation"><X size={16} /></button>
    </div>
    <button
      type="button"
      className={`flex min-h-[34px] w-full cursor-pointer items-center gap-2 rounded-xs border border-soft px-2.5 py-2 text-left text-[11px] transition-colors`}
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border border-soft bg-primary text-white px-[9px] py-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors `}
    >
      {editable ? <FileText size={13} /> : <Pencil size={13} />}{editable ? 'View docs' : 'Edit docs'}
    </Link>
  </footer>
}

export function DocsMobileHeader({ title, editable, onSearch, onOpen, open }: Omit<DocsChromeProps, 'folderId'> & { onOpen: () => void; open: boolean }) {
  return <header className={`flex min-h-16 shrink-0 items-center gap-3 border-b px-4 py-2.5 md:hidden ${LINE}`}>
    <button type="button" className={ICON_BUTTON} onClick={onOpen} aria-label="Open navigation" aria-expanded={open} aria-controls="handbook-navigation"><Menu size={19} /></button>
    <DocsIdentity title={title} editable={editable} hideMarkOnMobile />
    <button type="button" className={ICON_BUTTON} onClick={onSearch} aria-label="Search documentation"><Search size={18} /></button>
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
  return (
    <div className="overflow-hidden border border-soft">
      {/* Header */}
      <div className="flex min-h-10 items-center justify-between gap-4 border-b border-soft bg-canvas px-4 py-[7px] text-[10px] text-[#a0a7b5]">
        <span className="truncate font-mono" title={label}>
          {label}
        </span>

        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-[7px] rounded px-[5px] py-1 text-[10px] transition-colors hover:bg-[#252a34] hover:text-[#e1e5ed] ${FOCUS}`}
        >
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {/* Code content */}
      <div className="bg-background text-slate-500">
        <pre
          tabIndex={0}
          aria-label={`${label} code`}
          className={`m-0 overflow-x-auto p-[22px] text-xs leading-[1.85] [scrollbar-color:#353b47_transparent] [scrollbar-width:thin] [tab-size:2] selection:bg-[#46365f] selection:text-white ${FOCUS}`}
        >
          <code>{content}</code>
        </pre>
      </div>
    </div>
  )
}
