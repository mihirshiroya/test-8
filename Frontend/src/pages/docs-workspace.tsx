import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DocsSearchDialog } from '../components/Ui/docs-search-dialog'
import { useDocsToc } from '../hooks/use-docs-toc'
import type { SearchResult } from '../lib/docs-search'
import { useSelector } from 'react-redux'
import { useAppDispatch } from '../store'
import { DocsCodeBlock, DocsWorkspaceHeader, DocsSidebarFooter, DocsSidebarHeader } from '../components/Ui/docs-screen.tsx'
import { Link, Navigate, useParams } from 'react-router-dom'
import { DocsNavTree } from '../components/Ui/docs-nav-tree'
import { DocsEmptyState } from '../components/Ui/docs-empty-set.tsx'
import {
  AppDialog,
  AppDialogButton,
  AppDialogSection,
  appDialogInputClass,
} from '../components/Ui/app-dialog'
import {
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Pencil,
  ArrowRight,
  ArrowLeft,
  Home,
} from 'lucide-react'

import {
  fetchDoc,
  setDoc,
  addTopic,
  addSubtopic,
  deleteTopic as deleteTopicAction,
  deleteSubtopic as deleteSubtopicAction,
  deleteContent as deleteContentAction,
  type NotesState,
  type StoredFolder,
} from '../store/slices/notesSlice.ts'

import type { Doc, Topic, Subtopic, Content } from '../lib/docs-data'
import { NoteContentComposer } from '../components/Ui/note-content-composer'
import { NoteMarkdownPreview } from '../components/Ui/note-markdown-preview'
import { isMarkdownContent } from '../lib/note-markdown'
import { toast } from '../lib/toast'

/* Shared Tailwind class strings. Colors come from the docs-* tokens in index.css,
 * which switch values under `.dark`, so no `dark:` variants are needed here. */

const LINE = 'border-docs-line'
const MUTED = 'text-docs-muted'
const INK = 'text-docs-ink'
const ACTIVE = 'bg-docs-active'
const ACCENT = 'text-docs-accent'
const HOVER_ACTIVE = 'hover:bg-docs-active'
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-docs-accent'
const DANGER = 'text-docs-danger'
const REVEAL = 'opacity-0 [@media(hover:none)]:opacity-100'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RootState = {
  notes: NotesState
}

type DeleteModalState = {
  type: 'topic' | 'subtopic' | 'content'
  id: string
  title: string
  parentTopicId?: string
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

/** Turns "my-react_notes" into "My React Notes". */
const humanize = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()

/** Detects database-style ids so they are never shown as a folder name. */
const looksLikeGeneratedId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
  /^c[a-z0-9]{20,}$/i.test(value) ||
  /^[0-9a-f]{20,}$/i.test(value) ||
  /^\d+$/.test(value)

/** Reads the display name from a folder (`name`, `title` or `label`). */
const getFolderName = (folder?: StoredFolder | null): string => {
  if (!folder) return ''

  const source = folder as StoredFolder & {
    name?: string
    title?: string
    label?: string
  }

  return String(source.name ?? source.title ?? source.label ?? '').trim()
}

/** Language key used for code blocks, derived from the folder NAME. */
const getLanguageKey = (label: string) => {
  const key = label.toLowerCase().replace(/[^a-z0-9+#]/g, '')
  if (key === 'react' || key === 'reactjs') return 'tsx'
  return key || 'text'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function DocsWorkspace() {
  const { folderId } = useParams<{ folderId: string }>()

  if (!folderId) {
    return <Navigate to="/notes" replace />
  }

  return <DocsWorkspaceContent folderId={folderId} />
}

// -----------------------------------------------------------------------------
// Workspace content
// -----------------------------------------------------------------------------

function DocsWorkspaceContent({ folderId }: { folderId: string }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(fetchDoc(folderId))
  }, [dispatch, folderId])

  const mainScrollRef = useRef<HTMLElement | null>(null)

  // ---------------------------------------------------------------------------
  // Redux
  // ---------------------------------------------------------------------------

  const folders = useSelector((state: RootState) => state.notes.folders)
  const reduxDoc = useSelector((state: RootState) => state.notes.docs[folderId])

  const folder = folders.find((item) => String(item.id) === folderId)

  // ---------------------------------------------------------------------------
  // Folder label
  // ---------------------------------------------------------------------------

  const folderName = getFolderName(folder)

  const label = useMemo(() => {
    if (folderName) return folderName
    return looksLikeGeneratedId(folderId) ? 'Documentation' : humanize(folderId)
  }, [folderName, folderId])

  const languageKey = getLanguageKey(label)

  // ---------------------------------------------------------------------------
  // Fallback document
  // ---------------------------------------------------------------------------

  const fallbackDoc = useMemo<Doc>(
    () => ({
      id: folderId,
      title: `${label} Documentation`,
      description:
        'Your documentation workspace is ready. Add topics and content to get started.',
      topics: [],
    }),
    [folderId, label],
  )

  const doc = reduxDoc ?? fallbackDoc

  const meta = useMemo(
    () => ({ label, color: folder?.tint ?? 'indigo', emoji: '·' }),
    [label, folder?.tint],
  )

  // ---------------------------------------------------------------------------
  // Local UI state
  // ---------------------------------------------------------------------------

  const [topicId, setTopicId] = useState(doc.topics[0]?.id ?? '')
  const [subtopicId, setSubtopicId] = useState(doc.topics[0]?.subtopics[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(doc.topics.map((topic) => [topic.id, true])),
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [modal, setModal] = useState<'topic' | 'subtopic' | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null)
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState<{ initial?: Content; key: string } | null>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [structureBusy, setStructureBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingSearch, setPendingSearch] = useState<SearchResult | null>(null)

  // ---------------------------------------------------------------------------
  // Keep selection valid when Redux document changes
  // (depends only on `doc` on purpose, to avoid repeated updates)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const firstTopic = doc.topics[0]
    const selectedTopic = doc.topics.find((topic) => topic.id === topicId) ?? firstTopic
    const selectedSubtopic =
      selectedTopic?.subtopics.find((subtopic) => subtopic.id === subtopicId) ??
      selectedTopic?.subtopics[0]

    const nextTopicId = selectedTopic?.id ?? ''
    const nextSubtopicId = selectedSubtopic?.id ?? ''

    if (topicId !== nextTopicId) setTopicId(nextTopicId)
    if (subtopicId !== nextSubtopicId) setSubtopicId(nextSubtopicId)

    setExpanded((previous) => {
      let changed = false
      const next = { ...previous }
      doc.topics.forEach((topic) => {
        if (typeof next[topic.id] === 'undefined') {
          next[topic.id] = true
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [doc])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((previous) => !previous)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setModal(null)
        setDeleteModal(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ---------------------------------------------------------------------------
  // Current topic / subtopic
  // ---------------------------------------------------------------------------

  const topic = doc.topics.find((item) => item.id === topicId) ?? doc.topics[0]
  const subtopic =
    topic?.subtopics.find((item) => item.id === subtopicId) ?? topic?.subtopics[0]
  const { toc, activeTocId, setActiveTocId } = useDocsToc(mainScrollRef, subtopic?.content)

  // ---------------------------------------------------------------------------
  // Reset active TOC + scroll when subtopic changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // Scroll-based active TOC tracking
  // ---------------------------------------------------------------------------



  // ---------------------------------------------------------------------------
  // Previous / next
  // ---------------------------------------------------------------------------

  const allSubtopics = useMemo(() => {
    const list: { topic: Topic; subtopic: Subtopic }[] = []
    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        list.push({ topic: currentTopic, subtopic: currentSubtopic })
      })
    })
    return list
  }, [doc])

  const currentIndex = allSubtopics.findIndex(
    (item) => item.topic.id === topic?.id && item.subtopic.id === subtopic?.id,
  )

  const prevSubtopic = currentIndex > 0 ? allSubtopics[currentIndex - 1] : null
  const nextSubtopic =
    currentIndex >= 0 && currentIndex < allSubtopics.length - 1
      ? allSubtopics[currentIndex + 1]
      : null

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const closeComposer = () => { setComposer(null); setDraftDirty(false); setDraftBusy(false) }
  const openComposer = (initial?: Content) => {
    if (draftBusy || (draftDirty && !window.confirm('Discard your unsaved draft?'))) return
    setComposer({ initial: initial ?? subtopic?.content.find(isMarkdownContent), key: createId() })
    setDraftDirty(false)
  }
  const select = (nextTopic: Topic, nextSubtopic?: Subtopic) => {
    if (draftBusy || (draftDirty && !window.confirm('Discard your unsaved draft before switching sections?'))) return false
    closeComposer()
    const targetSubtopic = nextSubtopic ?? nextTopic.subtopics[0]

    setTopicId(nextTopic.id)
    setSubtopicId(targetSubtopic?.id ?? '')
    setExpanded((previous) => ({ ...previous, [nextTopic.id]: true }))
    setMobileOpen(false)
    setActiveTocId(null)
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${targetSubtopic?.id ?? nextTopic.id}`)
    }

    return true
  }

  // ---------------------------------------------------------------------------
  // Scroll to content section
  // ---------------------------------------------------------------------------

  const scrollTo = useCallback((id: string) => {
    const container = mainScrollRef.current
    const element = document.getElementById(id)
    if (!container || !element || !container.contains(element)) return

    setActiveTocId(id)

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const headerOffset = 24
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - headerOffset

    container.scrollTo({ top: Math.max(0, targetTop), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    window.history.replaceState(null, '', `#${id}`)
    element.setAttribute('tabindex', '-1')
    element.focus({ preventScroll: true })
  }, [setActiveTocId])

  useEffect(() => {
    if (!pendingSearch || subtopic?.id !== pendingSearch.subtopic.id || topic?.id !== pendingSearch.topic.id) return
    if (pendingSearch.anchorId) scrollTo(pendingSearch.anchorId)
    else {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
      const heading = mainScrollRef.current?.querySelector('h1')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    }
    setPendingSearch(null)
  }, [pendingSearch, subtopic?.id, topic?.id, scrollTo])

  const openSearchResult = (result: SearchResult) => {
    if (!select(result.topic, result.subtopic)) return
    setSearchOpen(false)
    setPendingSearch(result)
  }

  // ---------------------------------------------------------------------------
  // Copy
  // ---------------------------------------------------------------------------

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Clipboard unavailable.
    }
  }

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------

  const resetModal = () => {
    setModal(null)
    setTitle('')
  }

  // ---------------------------------------------------------------------------
  // Add topic / subtopic / content
  // ---------------------------------------------------------------------------

  const add = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const cleanTitle = title.trim()
    if (!modal || !cleanTitle || structureBusy || draftBusy) return
    if (draftDirty && !window.confirm('Discard your unsaved draft before creating a new section?')) return
    closeComposer()
    setStructureBusy(true)
    try {
      if (modal === 'topic') {
        const result = await dispatch(addTopic({ folderId, title: cleanTitle })).unwrap()
        setTopicId(result.topic.id)
        setSubtopicId('')
        setExpanded(previous => ({ ...previous, [result.topic.id]: true }))
      } else if (topic) {
        const result = await dispatch(addSubtopic({ folderId, topicId: topic.id, title: cleanTitle })).unwrap()
        setSubtopicId(result.subtopic.id)
        setExpanded(previous => ({ ...previous, [topic.id]: true }))
      }
      resetModal()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Unable to create section.')
    } finally { setStructureBusy(false) }
  }

  // ---------------------------------------------------------------------------
  // Delete requests
  // ---------------------------------------------------------------------------

  const deleteTopic = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const target = doc.topics.find((item) => item.id === id)
    if (!target) return
    setDeleteModal({ type: 'topic', id, title: target.title })
  }

  const deleteSubtopic = (parentTopic: Topic, id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const target = parentTopic.subtopics.find((item) => item.id === id)
    if (!target) return
    setDeleteModal({
      type: 'subtopic',
      id,
      title: target.title,
      parentTopicId: parentTopic.id,
    })
  }

  const deleteContent = (contentId: string) => {
    if (!topic || !subtopic) return
    const target = subtopic.content.find((item) => item.id === contentId)
    if (!target) return
    setDeleteModal({
      type: 'content',
      id: contentId,
      title: target.title,
      parentTopicId: topic.id,
    })
  }

  // ---------------------------------------------------------------------------
  // Confirm deletion
  // ---------------------------------------------------------------------------

  const confirmDelete = async () => {
    if (!deleteModal || structureBusy || draftBusy) return
    const affectsDraft = composer && (
      (deleteModal.type === 'topic' && deleteModal.id === topicId) ||
      (deleteModal.type === 'subtopic' && deleteModal.id === subtopicId) ||
      (deleteModal.type === 'content' && deleteModal.id === composer.initial?.id)
    )
    if (affectsDraft && draftDirty && !window.confirm('Discard your unsaved draft and delete this content?')) return
    if (affectsDraft) closeComposer()
    setStructureBusy(true)
    try {
      if (deleteModal.type === 'topic') await dispatch(deleteTopicAction({ folderId, topicId: deleteModal.id })).unwrap()
      else if (deleteModal.type === 'subtopic' && deleteModal.parentTopicId) await dispatch(deleteSubtopicAction({ folderId, topicId: deleteModal.parentTopicId, subtopicId: deleteModal.id })).unwrap()
      else if (topic && subtopic) await dispatch(deleteContentAction({ folderId, topicId: topic.id, subtopicId: subtopic.id, contentId: deleteModal.id })).unwrap()
      setDeleteModal(null)
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Unable to delete content.')
    } finally { setStructureBusy(false) }
  }

  // ---------------------------------------------------------------------------
  // Reset document
  // ---------------------------------------------------------------------------

  const resetToDefault = () => {
    const confirmed = window.confirm(
      `Reset ${meta.label} documentation to default content? This cannot be undone.`,
    )
    if (!confirmed) return

    dispatch(setDoc({ folderId, doc: fallbackDoc }))

    setTopicId(fallbackDoc.topics[0]?.id ?? '')
    setSubtopicId(fallbackDoc.topics[0]?.subtopics[0]?.id ?? '')
    setExpanded(Object.fromEntries(fallbackDoc.topics.map((item) => [item.id, true])))
    setActiveTocId(fallbackDoc.topics[0]?.subtopics[0]?.content?.[0]?.id ?? null)

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
  }
  void resetToDefault

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------



  // ---------------------------------------------------------------------------
  // Code placeholder (based on the folder NAME)
  // ---------------------------------------------------------------------------



  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  const sidebar = (
    <aside
      id="handbook-navigation"
      aria-label="Documentation navigation"
      className={`docs-workbench-sidebar min-h-0 shrink-0 flex-col border-r border-docs-line bg-docs-paper ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-40 flex w-[min(300px,85vw)] shadow-[12px_0_40px_rgba(0,0,0,0.15)] md:static md:z-auto md:w-56 md:shadow-none min-[1100px]:w-[260px]'
          : 'hidden md:flex md:w-56 min-[1100px]:w-[260px]'
      }`}
    >
      <DocsSidebarHeader
        title={meta.label}
        editable
        onSearch={() => setSearchOpen(true)}
        onClose={() => setMobileOpen(false)}
      />

      {/* Topics header */}
      <div className={`flex shrink-0 items-center justify-between gap-2 px-4.5 pb-2.5 text-[11px] font-medium ${MUTED}`}>
        <span>Topics & Sections</span>

        <button
          type="button"
          onClick={() => setModal('topic')}
          className={`inline-flex items-center gap-1 rounded-md py-1 text-xs font-medium transition-colors ${ACCENT} ${HOVER_ACTIVE} ${FOCUS}`}
          aria-label="Add topic"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-2">
        <DocsNavTree
          topics={doc.topics}
          activeSubtopicId={subtopic?.id}
          expanded={expanded}
          onTopicClick={(item) => {
            setExpanded((previous) => ({ ...previous, [item.id]: !previous[item.id] }))
            if (!item.subtopics[0]) {
              setTopicId(item.id)
              setSubtopicId('')
            }
          }}
          onSubtopicClick={select}
          renderTopicActions={(item) => (
            <div
              className={`flex items-center gap-0.5 transition-opacity duration-150 group-hover/topic:opacity-100 group-focus-within/topic:opacity-100 ${REVEAL}`}
            >
              <button
                type="button"
                onClick={() => {
                  setModal('subtopic')
                  setTopicId(item.id)
                  setSubtopicId(item.subtopics[0]?.id ?? '')
                }}
                className={`flex size-6 items-center justify-center rounded transition-colors hover:text-docs-accent ${MUTED} ${HOVER_ACTIVE} ${FOCUS}`}
                title="Add subtopic"
                aria-label={`Add subtopic to ${item.title}`}
              >
                <Plus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={(event) => deleteTopic(item.id, event)}
                className={`flex size-6 items-center justify-center rounded transition-colors hover:bg-red-500/10 ${FOCUS}`}
                title={`Delete topic ${item.title}`}
                aria-label={`Delete topic ${item.title}`}
              >
                <Trash2 className={`size-3.5 ${DANGER}`} />
              </button>
            </div>
          )}
          renderSubtopicActions={(item, child) => (
            <button
              type="button"
              onClick={(event) => deleteSubtopic(item, child.id, event)}
              className={`mr-1 flex size-6 shrink-0 items-center justify-center rounded transition-opacity hover:bg-red-500/10 focus-visible:opacity-100 group-hover/item:opacity-100 ${REVEAL} ${FOCUS}`}
              title={`Delete subtopic ${child.title}`}
              aria-label={`Delete subtopic ${child.title}`}
            >
              <Trash2 className={`size-3 ${DANGER}`} />
            </button>
          )}
          emptyMessage={`No topics have been created for ${meta.label} yet.`}
        />
      </nav>

      <DocsSidebarFooter folderId={folderId} editable />
    </aside>
  )

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="docs-workbench flex h-full min-h-0 w-full flex-col overflow-hidden bg-docs-paper font-inter text-docs-ink selection:bg-docs-active"
      onClickCapture={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
        if (!anchor || anchor.getAttribute('target') === '_blank') return
        if (draftBusy || (draftDirty && !window.confirm('Leave this page and discard your unsaved draft?'))) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <DocsWorkspaceHeader
        folderId={folderId}
        title={meta.label}
        editable
        open={mobileOpen}
        onOpen={() => setMobileOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebar}

        {/* MAIN DOCUMENT SCROLL CONTAINER */}
        <main
          ref={mainScrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-docs-paper"
        >
          <div className="mx-auto w-full max-w-[900px] px-6 pb-12 pt-6 md:px-12 md:pb-16 md:pt-8 min-[1100px]:px-16 min-[1100px]:pt-9">
            {/* Breadcrumbs */}
            <div className={`mb-6 flex flex-wrap items-center gap-2 text-[11px] font-medium md:mb-7 font-inter! ${MUTED}`}>
              <Link
                to="/notes"
                className={`transition-colors hover:text-docs-ink ${FOCUS}`}
              >
                <Home className="size-3.5" />
              </Link>

              <ChevronRight className="size-3.5" />

              <span>{meta.label}</span>

              <ChevronRight className="size-3.5" />

              <button
                type="button"
                className={`transition-colors hover:text-docs-ink ${FOCUS}`}
                onClick={() => {
                  if (topic) select(topic, topic.subtopics[0])
                }}
              >
                {topic?.title ?? 'General'}
              </button>

              <ChevronRight className="size-3.5" />

              <span className={`font-semibold ${INK}`}>
                {subtopic?.title ?? 'Overview'}
              </span>
            </div>

            {/* Page header */}
            <div className="mb-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1
                  className={`text-[clamp(26px,2.5vw,34px)] font-semibold leading-tight font-inter! capitalize [overflow-wrap:anywhere] ${INK}`}
                >
                  {subtopic?.title ?? 'Select a subtopic'}
                </h1>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openComposer()}
                    disabled={!subtopic || draftBusy}
                    title={subtopic?.content.some(isMarkdownContent) ? 'Continue editing the existing Markdown document' : 'Create the Markdown document for this section'}
                    className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border px-2.5 py-2 text-[11px] font-medium transition-colors hover:border-docs-accent disabled:cursor-not-allowed disabled:opacity-45 ${ACTIVE} ${ACCENT} ${LINE} ${FOCUS}`}
                  >
                    <Plus className="size-3.5" /> Add content
                  </button>
                </div>
              </div>

              {subtopic?.description && (
                <div className={`mt-3 text-[13px] leading-[1.8] ${MUTED}`}>
                  {subtopic.description}
                </div>
              )}
            </div>

            {composer && topic && subtopic && <NoteContentComposer key={composer.key} folderId={folderId} topicId={topic.id} subtopicId={subtopic.id} initial={composer.initial} onClose={closeComposer} onDirtyChange={setDraftDirty} onBusyChange={setDraftBusy} />}

            {/* Content */}
            {subtopic?.content && subtopic.content.length > 0 ? (
              <div className="flex flex-col gap-8">
                {subtopic.content.map((item) => (
                  <section
                    id={`content-${item.id}`}
                    key={item.id}
                    className="group relative scroll-mt-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      {!isMarkdownContent(item) && <h2
                        className={`text-[18px] font-bold leading-normal [overflow-wrap:anywhere] ${INK}`}
                      >
                        {item.title}
                      </h2>}
                      <button type="button" className="note-tool ml-auto" onClick={() => openComposer(item)} disabled={draftBusy} aria-label={`Edit ${item.title || 'content'}`}><Pencil size={14} />Edit</button>

                      <button
                        type="button"
                        onClick={() => deleteContent(item.id)}
                        className={`rounded-lg p-1.5 transition-all hover:bg-red-500/10 focus-visible:opacity-100 group-hover:opacity-100 ${REVEAL} ${FOCUS}`}
                        title="Delete this block"
                        aria-label={`Delete content block ${item.title}`}
                      >
                        <Trash2 className={`size-4 ${DANGER}`} />
                      </button>
                    </div>

                    {item.type === 'code' ? (
                      <DocsCodeBlock
                        label={item.language && !looksLikeGeneratedId(item.language) ? item.language : languageKey}
                        content={item.content}
                        copied={copiedId === item.id}
                        onCopy={() => void handleCopy(item.content, item.id)}
                      />
                    ) : (
                      <NoteMarkdownPreview markdown={item.content} />
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <DocsEmptyState
                variant="content"
                title="No content in this section yet"
                description="Start documenting by adding a text explanation or code snippet block."
              />
            )}

            {/* Prev / Next */}
            {allSubtopics.length > 0 && (
              <div className={`mt-10 grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-2 ${LINE}`}>
                {prevSubtopic ? (
                  <button
                    type="button"
                    onClick={() => select(prevSubtopic.topic, prevSubtopic.subtopic)}
                    className={`flex min-w-0 flex-col items-start border bg-docs-paper p-4 text-left transition-colors hover:border-docs-accent hover:bg-docs-soft ${LINE} ${FOCUS}`}
                  >
                    <div className={`flex items-center gap-1.5 text-[10px] font-medium tracking-wide ${MUTED}`}>
                      <ArrowLeft className="size-3.5" />
                      Previous
                    </div>

                    <div className={`mt-1 max-w-full truncate text-md ${MUTED}`}>
                      {prevSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextSubtopic ? (
                  <button
                    type="button"
                    onClick={() => select(nextSubtopic.topic, nextSubtopic.subtopic)}
                    className={`flex min-w-0 flex-col items-end border bg-docs-paper p-4 text-right transition-colors hover:border-docs-accent hover:bg-docs-soft ${LINE} ${FOCUS}`}
                  >
                    <div className={`flex items-center gap-1.5 text-[10px] font-medium tracking-wide ${MUTED}`}>
                      Next
                      <ArrowRight className="size-3.5" />
                    </div>

                    <div className={`mt-1 max-w-full truncate text-md ${MUTED}`}>
                      {nextSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT TOC */}
        <aside
          aria-label="On this page"
          className="hidden w-[180px] shrink-0 overflow-y-auto py-9 pl-0 pr-4 min-[960px]:block min-[1100px]:w-[200px] min-[1100px]:pr-6"
        >
          <div>
            <h2 className={`mb-[18px] flex items-center gap-[7px] text-[13px] font-semibold ${MUTED}`}>
              <FileText size={13} /> On this page
            </h2>

            {toc.length > 0 ? (
              <nav className={`border-l ${LINE} ml-1`}>
                {toc.map((item) => {
                  const isActive = activeTocId === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      aria-current={isActive ? 'location' : undefined}
                      className={`relative flex w-full items-center bg-transparent px-3 py-2 text-left text-[11px] leading-relaxed transition-colors hover:text-docs-ink ${FOCUS} ${
                        isActive ? `font-bold ${INK}` : MUTED
                      }`}
                    >
                      {isActive && (
                        <span className="absolute -left-[2px] top-0 h-full w-[2px] bg-docs-accent rounded-2xl" />
                      )}
                      <span className="[overflow-wrap:anywhere] font-inter! capitalize">{item.title}</span>
                    </button>
                  )
                })}
              </nav>
            ) : (
              <DocsEmptyState
                variant="sections"
                size="sm"
                title="No sections yet"
                description="Add headings to your Markdown document to build this outline."
              />
            )}
          </div>
        </aside>
      </div>

      {/* MOBILE BACKDROP */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-docs-backdrop/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* SEARCH MODAL */}
      {searchOpen && <DocsSearchDialog doc={doc} name={meta.label} onClose={() => setSearchOpen(false)} onNavigate={openSearchResult} />}

      {/* DELETE MODAL */}
      <AppDialog
        open={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        role="alertdialog"
        size="sm"
        title={<span className="capitalize">Delete {deleteModal?.type}</span>}
        description={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-ink">&ldquo;{deleteModal?.title}&rdquo;</span>?
          </>
        }
        footer={
          <>
            <AppDialogButton variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancel
            </AppDialogButton>
            <AppDialogButton variant="destructive" onClick={() => void confirmDelete()} disabled={structureBusy || draftBusy} className="capitalize">
              <Trash2 className="size-4" />
              Delete {deleteModal?.type}
            </AppDialogButton>
          </>
        }
      >
        {deleteModal && deleteModal.type !== 'content' && (
          <AppDialogSection
            icon={<Trash2 />}
            title="This can't be undone"
            description={
              deleteModal.type === 'topic'
                ? 'All subtopics and content inside this topic will also be deleted.'
                : 'All content blocks inside this subtopic will also be deleted.'
            }
          />
        )}
      </AppDialog>

      {/* CREATE MODAL */}
      <AppDialog
        open={modal !== null}
        onClose={resetModal}
        onSubmit={add}
        size="lg"
        title={<span className="capitalize">Create new {modal}</span>}
        description={
          modal === 'topic'
            ? `Add a new topic to your ${meta.label} docs.`
            : modal === 'subtopic'
              ? 'Add a new subtopic inside the selected topic.'
              : 'Add a text or code block to the selected subtopic.'
        }
        footer={
          <>
            <AppDialogButton variant="secondary" onClick={resetModal}>
              Cancel
            </AppDialogButton>
            <AppDialogButton
              type="submit"
              disabled={!title.trim() || structureBusy || draftBusy}
              className="capitalize"
            >
              Create {modal}
            </AppDialogButton>
          </>
        }
      >
        <AppDialogSection
          icon={<FileText />}
          title="Title"
          description="A short, descriptive name."
          htmlFor="docs-create-title"
        >
          <input
            id="docs-create-title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={appDialogInputClass}
            placeholder={
              modal === 'topic'
                ? `e.g., ${meta.label} Advanced Concepts`
                : modal === 'subtopic'
                  ? 'e.g., Error Handling'
                  : 'e.g., Example Code'
            }
          />
        </AppDialogSection>


      </AppDialog>
    </div>
  )
}
