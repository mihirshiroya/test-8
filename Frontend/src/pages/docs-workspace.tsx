import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DocsCodeBlock, DocsMobileHeader, DocsSidebarFooter, DocsSidebarHeader } from '../components/Ui/docs-screen.tsx'
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
  Search,
  Trash2,
  X,
  Terminal,
  ArrowRight,
  ArrowLeft,
  AlignLeft,
  Home,
} from 'lucide-react'

import {
  fetchDoc,
  setDoc,
  addSubtopic,
  addContent,
  type NotesState,
  type StoredFolder,
} from '../store/slices/notesSlice.ts'

import type { Doc, Topic, Subtopic, Content } from '../lib/docs-data'

/* Shared Tailwind class strings. Colors come from the docs-* tokens in index.css,
 * which switch values under `.dark`, so no `dark:` variants are needed here. */

const LINE = 'border-docs-line'
const MUTED = 'text-docs-muted'
const INK = 'text-docs-ink'
const PAPER = 'bg-docs-paper'
const SOFT = 'bg-docs-soft'
const ACTIVE = 'bg-docs-active'
const ACCENT = 'text-docs-accent'
const HOVER_ACTIVE = 'hover:bg-docs-active'
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-docs-accent'
const DANGER = 'text-docs-danger'
const REVEAL = 'opacity-0 [@media(hover:none)]:opacity-100'
const PRIMARY_BTN =
  'bg-docs-primary text-white shadow-md shadow-docs-primary/20 transition-colors hover:bg-docs-primary-hover disabled:cursor-not-allowed disabled:opacity-50'
const FIELD =
  'border bg-docs-soft/60 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-docs-muted focus:border-docs-accent focus:ring-2 focus:ring-docs-accent/20'

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
  const dispatch = useDispatch()

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
  const [modal, setModal] = useState<'topic' | 'subtopic' | 'content' | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<'text' | 'code'>('text')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTocId, setActiveTocId] = useState<string | null>(null)

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
  const toc = subtopic?.content ?? []

  // ---------------------------------------------------------------------------
  // Reset active TOC + scroll when subtopic changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null)
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // Scroll-based active TOC tracking
  // ---------------------------------------------------------------------------

  const handleMainScroll = () => {
    const container = mainScrollRef.current
    if (!container || !toc.length) return

    const containerRect = container.getBoundingClientRect()
    const activationOffset = 100
    let currentId = toc[0]?.id ?? null

    for (const item of toc) {
      const element = document.getElementById(`content-${item.id}`)
      if (!element) continue

      const relativeTop = element.getBoundingClientRect().top - containerRect.top
      if (relativeTop <= activationOffset) {
        currentId = item.id
      }
    }

    setActiveTocId((previous) => (previous === currentId ? previous : currentId))
  }

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

  const select = (nextTopic: Topic, nextSubtopic?: Subtopic) => {
    const targetSubtopic = nextSubtopic ?? nextTopic.subtopics[0]

    setTopicId(nextTopic.id)
    setSubtopicId(targetSubtopic?.id ?? '')
    setExpanded((previous) => ({ ...previous, [nextTopic.id]: true }))
    setMobileOpen(false)
    setActiveTocId(targetSubtopic?.content?.[0]?.id ?? null)

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${targetSubtopic?.id ?? nextTopic.id}`)
    }

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  // ---------------------------------------------------------------------------
  // Scroll to content section
  // ---------------------------------------------------------------------------

  const scrollTo = (id: string) => {
    const container = mainScrollRef.current
    const element = document.getElementById(`content-${id}`)
    if (!container || !element) return

    setActiveTocId(id)

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const headerOffset = 24
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - headerOffset

    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    window.history.replaceState(null, '', `#content-${id}`)
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
    setContent('')
    setContentType('text')
  }

  // ---------------------------------------------------------------------------
  // Add topic / subtopic / content
  // ---------------------------------------------------------------------------

  const add = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!modal || !cleanTitle || (modal === 'content' && !cleanContent)) return

    if (modal === 'topic') {
      const newTopic: Topic = { id: createId(), title: cleanTitle, subtopics: [] }
      const nextDoc: Doc = { ...doc, topics: [...doc.topics, newTopic] }

      dispatch(setDoc({ folderId, doc: nextDoc }))

      setTopicId(newTopic.id)
      setSubtopicId('')
      setExpanded((previous) => ({ ...previous, [newTopic.id]: true }))

      resetModal()
      return
    }

    if (modal === 'subtopic' && topic) {
      dispatch(
        addSubtopic({
          folderId,
          topicId: topic.id,
          title: cleanTitle,
          description: 'Recently added section. Click Add Content to populate.',
        }),
      )

      setExpanded((previous) => ({ ...previous, [topic.id]: true }))

      resetModal()
      return
    }

    if (modal === 'content' && topic && subtopic) {
      const newContent: Omit<Content, 'id'> = {
        title: cleanTitle,
        type: contentType,
        content: cleanContent,
        ...(contentType === 'code' ? { language: languageKey } : {}),
      }

      dispatch(
        addContent({
          folderId,
          topicId: topic.id,
          subtopicId: subtopic.id,
          content: newContent,
        }),
      )

      resetModal()
    }
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

  const confirmDelete = () => {
    if (!deleteModal) return

    if (deleteModal.type === 'topic') {
      const remainingTopics = doc.topics.filter((item) => item.id !== deleteModal.id)
      const nextDoc: Doc = { ...doc, topics: remainingTopics }

      dispatch(setDoc({ folderId, doc: nextDoc }))

      if (deleteModal.id === topicId) {
        const nextTopic = remainingTopics[0]

        if (nextTopic) {
          setTopicId(nextTopic.id)
          setSubtopicId(nextTopic.subtopics[0]?.id ?? '')
          setExpanded((previous) => ({ ...previous, [nextTopic.id]: true }))
          setActiveTocId(nextTopic.subtopics[0]?.content?.[0]?.id ?? null)

          requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
          })
        } else {
          setTopicId('')
          setSubtopicId('')
          setActiveTocId(null)
        }
      }
    }

    if (deleteModal.type === 'subtopic') {
      const parentTopic = doc.topics.find((item) => item.id === deleteModal.parentTopicId)

      if (parentTopic) {
        const remainingSubtopics = parentTopic.subtopics.filter(
          (item) => item.id !== deleteModal.id,
        )

        const nextDoc: Doc = {
          ...doc,
          topics: doc.topics.map((item) =>
            item.id === parentTopic.id ? { ...item, subtopics: remainingSubtopics } : item,
          ),
        }

        dispatch(setDoc({ folderId, doc: nextDoc }))

        if (deleteModal.id === subtopicId) {
          const nextSubtopic = remainingSubtopics[0]

          setTopicId(parentTopic.id)
          setSubtopicId(nextSubtopic?.id ?? '')
          setActiveTocId(nextSubtopic?.content?.[0]?.id ?? null)

          requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
          })
        }
      }
    }

    if (deleteModal.type === 'content') {
      if (topic && subtopic) {
        const nextDoc: Doc = {
          ...doc,
          topics: doc.topics.map((currentTopic) =>
            currentTopic.id !== topic.id
              ? currentTopic
              : {
                  ...currentTopic,
                  subtopics: currentTopic.subtopics.map((currentSubtopic) =>
                    currentSubtopic.id !== subtopic.id
                      ? currentSubtopic
                      : {
                          ...currentSubtopic,
                          content: currentSubtopic.content.filter(
                            (item) => item.id !== deleteModal.id,
                          ),
                        },
                  ),
                },
          ),
        }

        dispatch(setDoc({ folderId, doc: nextDoc }))

        if (activeTocId === deleteModal.id) {
          setActiveTocId(
            subtopic.content.find((item) => item.id !== deleteModal.id)?.id ?? null,
          )
        }
      }
    }

    setDeleteModal(null)
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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    const results: { topic: Topic; subtopic: Subtopic; contentItem?: Content }[] = []

    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        if (
          currentSubtopic.title.toLowerCase().includes(query) ||
          currentSubtopic.description?.toLowerCase().includes(query)
        ) {
          results.push({ topic: currentTopic, subtopic: currentSubtopic })
        }

        currentSubtopic.content.forEach((contentItem) => {
          if (
            contentItem.title.toLowerCase().includes(query) ||
            contentItem.content.toLowerCase().includes(query)
          ) {
            results.push({ topic: currentTopic, subtopic: currentSubtopic, contentItem })
          }
        })
      })
    })

    return results
  }, [searchQuery, doc])

  // ---------------------------------------------------------------------------
  // Code placeholder (based on the folder NAME)
  // ---------------------------------------------------------------------------

  const codePlaceholder =
    languageKey === 'python'
      ? `def my_function():\n    print("Hello from Python!")`
      : languageKey === 'javascript' || languageKey === 'typescript'
        ? `function myFunction() {\n  console.log("Hello!");\n}`
        : languageKey === 'tsx'
          ? `function MyComponent() {\n  return <div>Hello!</div>;\n}`
          : `public void myMethod() {\n    System.out.println("Hello!");\n}`

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  const sidebar = (
    <aside
      id="handbook-navigation"
      aria-label="Documentation navigation"
      className={`min-h-0 shrink-0 flex-col border-r border-soft bg-canvas ${
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
      className={`mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col overflow-hidden shadow-[0_16px_60px_-24px_rgba(73,55,117,0.33),0_2px_8px_rgba(73,55,117,0.04)] selection:bg-docs-active`}
    >
      <DocsMobileHeader
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
          onScroll={handleMainScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar bg-background"
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
                    onClick={() => setModal('content')}
                    disabled={!subtopic}
                    title="Add content"
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
                      <h2
                        className={`text-[18px] font-bold leading-normal capitalize [overflow-wrap:anywhere] ${INK}`}
                      >
                        {item.title}
                      </h2>

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
                      <div className={`text-[14px] leading-[1.9] [overflow-wrap:anywhere] ${MUTED}`}>
                        <p className="whitespace-pre-wrap font-semibold text-steel font-inter! text-pretty">{item.content}</p>
                      </div>
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
          className="hidden w-[200px] shrink-0 overflow-y-auto py-9 pl-0 pr-6 min-[1100px]:block"
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
                description="Add a content block to build this outline."
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
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl overflow-hidden border shadow-2xl animate-in zoom-in-95 duration-150 ${PAPER} ${LINE}`}
          >
            <div className={`flex items-center border-b px-4 py-3 ${SOFT} ${LINE}`}>
              <Search className={`mr-3 size-5 ${MUTED}`} />

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search ${meta.label} docs...`}
                className={`flex-1 bg-transparent text-sm outline-none placeholder:text-docs-muted ${INK}`}
              />

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className={`rounded-md p-1 transition-colors hover:text-docs-ink ${MUTED} ${HOVER_ACTIVE} ${FOCUS}`}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.topic.id}-${result.subtopic.id}-${result.contentItem?.id ?? index}`}
                      type="button"
                      onClick={() => {
                        select(result.topic, result.subtopic)

                        if (result.contentItem) {
                          window.setTimeout(() => scrollTo(result.contentItem!.id), 150)
                        }

                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                      className={`group flex w-full items-center justify-between p-3 text-left transition-colors ${HOVER_ACTIVE} ${FOCUS}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${ACCENT}`}>
                            {result.topic.title}
                          </span>
                          <span className={MUTED}>/</span>
                          <span className={`text-xs font-medium ${INK}`}>
                            {result.subtopic.title}
                          </span>
                        </div>

                        {result.contentItem && (
                          <div className={`mt-1 truncate text-xs ${MUTED}`}>
                            <span className={`font-semibold ${INK} opacity-80`}>
                              {result.contentItem.title}:
                            </span>{' '}
                            {result.contentItem.content.slice(0, 80)}
                            ...
                          </div>
                        )}
                      </div>

                      <ChevronRight
                        className={`ml-2 size-4 shrink-0 transition-colors group-hover:text-docs-accent ${MUTED}`}
                      />
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <DocsEmptyState
                  variant="noResults"
                  size="sm"
                  title={<>No results for &ldquo;{searchQuery}&rdquo;</>}
                  description={`Nothing matched in ${meta.label} docs. Try a different keyword.`}
                />
              ) : (
                <DocsEmptyState
                  variant="search"
                  size="sm"
                  title="Search the docs"
                  description={`Type to search through ${meta.label} documentation.`}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
            <AppDialogButton variant="destructive" onClick={confirmDelete} className="capitalize">
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
              disabled={!title.trim() || (modal === 'content' && !content.trim())}
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

        {modal === 'content' && (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-semibold text-ink font-inter!">Block type</legend>
              {(
                [
                  {
                    value: 'text',
                    label: 'Text / Paragraph',
                    hint: 'Plain explanation or documentation prose.',
                    Icon: AlignLeft,
                  },
                  {
                    value: 'code',
                    label: 'Code Snippet',
                    hint: `A ${meta.label} code example with syntax highlighting.`,
                    Icon: Terminal,
                  },
                ] as const
              ).map(({ value, label: optionLabel, hint, Icon }) => {
                const selected = contentType === value
                return (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-canvas p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                      selected ? 'border-primary' : 'border-soft hover:bg-gray-tint'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-soft bg-surface text-charcoal"
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink font-inter!">
                        {optionLabel}
                      </span>
                      <span className="mt-0.5 block text-sm text-steel">{hint}</span>
                    </span>
                    <input
                      type="radio"
                      name="docs-block-type"
                      value={value}
                      checked={selected}
                      onChange={() => setContentType(value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-primary' : 'border-soft bg-gray-tint'
                      }`}
                    >
                      {selected && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                  </label>
                )
              })}
            </fieldset>

            <AppDialogSection
              icon={contentType === 'code' ? <Terminal /> : <AlignLeft />}
              title={contentType === 'code' ? `Code body (${meta.label})` : 'Content paragraph'}
              htmlFor="docs-create-content"
            >
              <textarea
                id="docs-create-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                className={`${appDialogInputClass} h-auto resize-none py-3 font-mono`}
                placeholder={
                  contentType === 'code'
                    ? codePlaceholder
                    : 'Write your documentation explanation here...'
                }
              />
            </AppDialogSection>
          </>
        )}
      </AppDialog>
    </div>
  )
}
