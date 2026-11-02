import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DocsCodeBlock, DocsMobileHeader, DocsSidebarFooter, DocsSidebarHeader } from '../components/Ui/docs-screen'
import { DocsNavTree } from '../components/Ui/docs-nav-tree'
import { DocsEmptyState } from '../components/Ui/docs-empty-set'
import { INITIAL_DOCS, type Doc, type Topic, type Subtopic } from '../lib/docs-data'
import { fetchDoc, selectDoc, selectDocStatus, selectFolders } from '../store/slices/notesSlice'
import {
  ChevronRight,
  FileText,
  Search,
  X,
  ArrowRight,
  ArrowLeft,
  Home,
  Pencil,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

/* Shared Tailwind class strings. Colors come from the docs-* tokens in index.css,
 * which switch values under `.dark`, so no `dark:` variants are needed here. */

const LINE = 'border-docs-line'
const MUTED = 'text-docs-muted'
const INK = 'text-docs-ink'
const HOVER_SOFT = 'hover:bg-docs-soft'
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-docs-accent'

export default function DocsViewer() {
  const { folderId } = useParams<{ folderId: string }>()

  if (!folderId) {
    return <Navigate to="/notes" replace />
  }

  return <DocsViewerContent folderId={folderId} />
}

function DocsViewerContent({ folderId }: { folderId: string }) {
  const dispatch = useDispatch()

  const reduxDoc = useSelector(selectDoc(folderId))
  const docStatus = useSelector(selectDocStatus(folderId))
  const folders = useSelector(selectFolders)

  const folder = useMemo(
    () => folders.find((item) => item.id === folderId),
    [folders, folderId],
  )

  const folderName = folder?.title ?? 'Documentation'

  useEffect(() => {
    if (docStatus === 'idle') {
      dispatch(fetchDoc(folderId))
    }
  }, [dispatch, folderId, docStatus])

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------

  const mainScrollRef = useRef<HTMLElement | null>(null)

  // ---------------------------------------------------------------------------
  // DOCUMENT
  // ---------------------------------------------------------------------------

  const initialDoc = useMemo<Doc>(() => {
    return (
      INITIAL_DOCS[folderId] ?? {
        id: folderId,
        title: `${folderId.charAt(0).toUpperCase()}${folderId.slice(1)} Documentation`,
        description: 'This documentation has not been published yet.',
        topics: [],
      }
    )
  }, [folderId])

  const doc = useMemo<Doc>(() => reduxDoc ?? initialDoc, [reduxDoc, initialDoc])

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [topicId, setTopicId] = useState(doc.topics[0]?.id ?? '')
  const [subtopicId, setSubtopicId] = useState(doc.topics[0]?.subtopics[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(doc.topics.map((topic) => [topic.id, true])),
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)

  // ---------------------------------------------------------------------------
  // KEEP SELECTION IN SYNC WITH DOCUMENT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const firstTopic = doc.topics[0]
    const firstSubtopic = firstTopic?.subtopics[0]
    const currentTopic = doc.topics.find((topic) => topic.id === topicId)
    const topicExists = Boolean(currentTopic)
    const subtopicExists = Boolean(
      currentTopic?.subtopics.some((subtopic) => subtopic.id === subtopicId),
    )

    if (!topicExists) {
      const nextTopicId = firstTopic?.id ?? ''
      const nextSubtopicId = firstSubtopic?.id ?? ''
      setTopicId((previous) => (previous === nextTopicId ? previous : nextTopicId))
      setSubtopicId((previous) => (previous === nextSubtopicId ? previous : nextSubtopicId))
    } else if (!subtopicExists) {
      const nextSubtopicId = currentTopic?.subtopics[0]?.id ?? ''
      setSubtopicId((previous) => (previous === nextSubtopicId ? previous : nextSubtopicId))
    }

    setExpanded((previous) => {
      let changed = false
      const next = { ...previous }
      for (const topic of doc.topics) {
        if (next[topic.id] === undefined) {
          next[topic.id] = true
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [doc])

  // ---------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((previous) => !previous)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ---------------------------------------------------------------------------
  // CURRENT TOPIC / SUBTOPIC
  // ---------------------------------------------------------------------------

  const topic = doc.topics.find((item) => item.id === topicId) ?? doc.topics[0]
  const subtopic = topic?.subtopics.find((item) => item.id === subtopicId) ?? topic?.subtopics[0]
  const toc = subtopic?.content ?? []

  // ---------------------------------------------------------------------------
  // ACTIVE TOC
  // ---------------------------------------------------------------------------

  const [activeTocId, setActiveTocId] = useState<string | null>(toc[0]?.id ?? null)

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null)
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // INTERSECTION OBSERVER
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const scrollContainer = mainScrollRef.current
    if (!scrollContainer || !toc.length) return

    const sections = toc
      .map((item) => document.getElementById(`content-${item.id}`))
      .filter((element): element is HTMLElement => Boolean(element))

    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visibleEntries.length > 0) {
          const activeId = visibleEntries[0].target.id.replace('content-', '')
          setActiveTocId((previous) => (previous === activeId ? previous : activeId))
        }
      },
      { root: scrollContainer, rootMargin: '-40px 0px -60% 0px', threshold: 0 },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // ALL SUBTOPICS + PREVIOUS / NEXT
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
  // SELECT
  // ---------------------------------------------------------------------------

  const select = (nextTopic: Topic, nextSubtopicArg?: Subtopic) => {
    const targetSubtopic = nextSubtopicArg ?? nextTopic.subtopics[0]

    setTopicId(nextTopic.id)
    setSubtopicId(targetSubtopic?.id ?? '')
    setExpanded((old) => ({ ...old, [nextTopic.id]: true }))
    setMobileOpen(false)
    setActiveTocId(targetSubtopic?.content?.[0]?.id ?? null)

    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

    window.history.replaceState(null, '', `#${targetSubtopic?.id ?? nextTopic.id}`)
  }

  // ---------------------------------------------------------------------------
  // SCROLL TO TOC SECTION
  // ---------------------------------------------------------------------------

  const scrollTo = (id: string) => {
    const container = mainScrollRef.current
    const element = document.getElementById(`content-${id}`)
    if (!container || !element) return

    setActiveTocId(id)

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - 24

    container.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' })
    window.history.replaceState(null, '', `#content-${id}`)
  }

  // ---------------------------------------------------------------------------
  // COPY / SHARE
  // ---------------------------------------------------------------------------

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedUrl(true)
    window.setTimeout(() => setCopiedUrl(false), 2000)
  }
  void handleShare
  void copiedUrl

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const q = searchQuery.toLowerCase()
    const results: {
      topic: Topic
      subtopic: Subtopic
      contentItem?: (typeof toc)[number]
    }[] = []

    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        const matchesSubtopic =
          currentSubtopic.title.toLowerCase().includes(q) ||
          currentSubtopic.description?.toLowerCase().includes(q)

        if (matchesSubtopic) {
          results.push({ topic: currentTopic, subtopic: currentSubtopic })
        }

        currentSubtopic.content.forEach((contentItem) => {
          const matchesContent =
            contentItem.title.toLowerCase().includes(q) ||
            contentItem.content.toLowerCase().includes(q)

          if (matchesContent) {
            results.push({ topic: currentTopic, subtopic: currentSubtopic, contentItem })
          }
        })
      })
    })

    return results
  }, [searchQuery, doc])

  // ---------------------------------------------------------------------------
  // SIDEBAR
  // ---------------------------------------------------------------------------

  const sidebar = (
    <aside
      id="handbook-navigation"
      aria-label="Documentation navigation"
      className={`min-h-0 shrink-0 flex-col border-r bg-canvas ${LINE} ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-40 flex w-[min(300px,85vw)] shadow-[12px_0_40px_rgba(0,0,0,0.15)] md:static md:z-auto md:w-56 md:shadow-none min-[1100px]:w-[232px]'
          : 'hidden md:flex md:w-56 min-[1100px]:w-[232px]'
      }`}
    >
      <DocsSidebarHeader
        title={folderName}
        onSearch={() => setSearchOpen(true)}
        onClose={() => setMobileOpen(false)}
      />

      <div className={`shrink-0 px-[22px] font-inter! pb-2.5 text-[13px] font-medium ${MUTED}`}>
        Documentation
      </div>

      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2">
        <DocsNavTree
          topics={doc.topics}
          activeSubtopicId={subtopic?.id}
          expanded={expanded}
          onTopicClick={(item) =>
            setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
          }
          onSubtopicClick={select}
          emptyMessage={`No topics have been published for ${folderName} yet.`}
        />
      </nav>

      <DocsSidebarFooter folderId={folderId} />
    </aside>
  )

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col overflow-hidden font-sans max-md:border-0 shadow-[0_16px_60px_-24px_rgba(73,55,117,0.33),0_2px_8px_rgba(73,55,117,0.04)] selection:bg-docs-active`}
    >
      {/* MOBILE HEADER (visible only below md inside the component) */}
      <DocsMobileHeader
        title={folderName}
        open={mobileOpen}
        onOpen={() => setMobileOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />

      {/* BODY */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebar}

        {/* DOCUMENT SCROLL CONTAINER */}
        <main
          ref={mainScrollRef}
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar bg-background"
        >
          <div className="mx-auto w-full max-w-[900px] px-6 pb-12 pt-6 md:px-12 md:pb-16 md:pt-8 min-[1100px]:px-16 min-[1100px]:pt-9">
            {/* BREADCRUMB */}
            <div className={`mb-6 flex flex-wrap items-center gap-2 text-[11px] font-medium md:mb-7 font-inter! ${MUTED}`}>
              <Link to="/notes" className={`transition-colors hover:text-docs-ink ${FOCUS}`}>
                <Home className="size-3.5" />
              </Link>
              <ChevronRight className="size-3.5" />
              <span>{folderName}</span>
              <ChevronRight className="size-3.5" />
              <span>{topic?.title ?? 'General'}</span>
              <ChevronRight className="size-3.5" />
              <span className={`font-semibold ${INK}`}>{subtopic?.title ?? 'Overview'}</span>
            </div>

            {/* PAGE HEADER */}
            <div className="mb-8">
              <h1 className={`text-[clamp(26px,2.5vw,34px)] font-semibold leading-tight font-inter! capitalize [overflow-wrap:anywhere] ${INK}`}>
                {subtopic?.title ?? 'Select a subtopic'}
              </h1>

           
            </div>

            {/* CONTENT */}
            {subtopic?.content && subtopic.content.length > 0 ? (
              <div className="flex flex-col gap-8">
                {subtopic.content.map((item) => (
                  <section id={`content-${item.id}`} key={item.id} className="scroll-mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className={`text-[18px] font-bold leading-normal capitalize [overflow-wrap:anywhere] ${INK}`}>
                        {item.title}
                      </h2>
                    </div>

                    {item.type === 'code' ? (
                      <DocsCodeBlock
                        label={item.language || 'text'}
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
                title="No content in this section"
                description="This section is empty."
           
              />
            )}

            {/* PREVIOUS / NEXT */}
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
                description="Sections will appear here once content is added."
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
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SEARCH */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 backdrop-blur-xs">
          <div
            className={`w-full max-w-xl overflow-hidden border bg-docs-paper shadow-2xl ${LINE}`}
          >
            <div className={`flex items-center border-b bg-docs-soft/60 px-4 py-3 ${LINE}`}>
              <Search className={`mr-3 size-5 ${MUTED}`} />

              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${folderName} docs...`}
                className={`flex-1 bg-transparent text-sm outline-none placeholder:text-docs-muted ${INK}`}
              />

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className={`rounded p-1 transition-colors hover:bg-docs-active ${MUTED} ${FOCUS}`}
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
                      className={`flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-docs-active ${FOCUS}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-docs-accent">
                            {result.topic.title}
                          </span>
                          <span className={MUTED}>/</span>
                          <span className={`text-xs font-medium ${INK}`}>
                            {result.subtopic.title}
                          </span>
                        </div>

                        {result.contentItem && (
                          <div className={`mt-1 truncate text-xs ${MUTED}`}>
                            {result.contentItem.title}
                          </div>
                        )}
                      </div>

                      <ChevronRight className={`size-4 shrink-0 ${MUTED}`} />
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <DocsEmptyState
                  variant="noResults"
                  size="sm"
                  title={<>No results for &ldquo;{searchQuery}&rdquo;</>}
                  description="Try a different keyword or check the spelling."
                />
              ) : (
                <DocsEmptyState
                  variant="search"
                  size="sm"
                  title="Search the docs"
                  description={`Type to search through ${folderName} documentation.`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
