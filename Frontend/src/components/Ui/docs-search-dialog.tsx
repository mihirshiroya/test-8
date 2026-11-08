import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import type { Doc } from '../../lib/docs-data'
import { buildDocsSearchIndex, searchDocs, type SearchResult } from '../../lib/docs-search'

function Highlight({ text, words }: { text: string; words: string[] }) {
  const matches = new Set(words.map(word => word.toLowerCase()))
  return <>{text.split(/([\p{L}\p{N}_+#]+)/u).map((part, index) => matches.has(part.toLowerCase())
    ? <mark key={index} className="rounded-sm bg-docs-active px-0.5 text-docs-accent">{part}</mark>
    : part)}</>
}

export function DocsSearchDialog({ doc, name, onClose, onNavigate }: {
  doc: Doc
  name: string
  onClose: () => void
  onNavigate: (result: SearchResult) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const index = useMemo(() => buildDocsSearchIndex(doc), [doc])
  const results = useMemo(() => searchDocs(index, deferredQuery), [index, deferredQuery])
  const pending = query !== deferredQuery

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.showModal()
    inputRef.current?.focus()
    return () => previousFocus?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    dialogRef.current?.querySelector(`#docs-result-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, results])

  return <dialog
    ref={dialogRef}
    aria-labelledby="docs-search-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    className="fixed inset-x-0 bottom-auto top-12 m-0 mx-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden border border-docs-line bg-docs-paper p-0 text-docs-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm md:top-20"
  >
    <div className="flex items-center gap-3 border-b border-docs-line bg-docs-soft/60 px-4 py-3">
      <Search aria-hidden="true" className="size-5 shrink-0 text-docs-muted" />
      <h2 id="docs-search-title" className="sr-only">Search {name} documentation</h2>
      <input
        ref={inputRef}
        aria-label={`Search ${name} documentation`}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
        aria-controls={results.length ? 'docs-search-list' : undefined}
        aria-activedescendant={results[selectedIndex] ? `docs-result-${selectedIndex}` : undefined}
        aria-describedby="docs-search-help"
        value={query}
        maxLength={300}
        onChange={event => { setQuery(event.target.value); setSelectedIndex(0) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedIndex(current => results.length ? (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0)
          }
          if (event.key === 'Enter' && results[selectedIndex] && !pending) {
            event.preventDefault()
            onNavigate(results[selectedIndex])
          }
        }}
        placeholder="Search topics, code, or ask a question…"
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-docs-muted"
      />
      <button type="button" aria-label="Close search" onClick={onClose} className="rounded p-1 text-docs-muted hover:bg-docs-active focus-visible:outline-2 focus-visible:outline-docs-accent"><X className="size-4" /></button>
    </div>
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-[11px] text-docs-muted">
      <span>All topics in {name} · headings, text &amp; code</span>
      <span role="status" aria-live="polite">{pending ? 'Searching…' : query.trim() ? `${results.length}${results.length === 40 ? '+' : ''} ${results.length === 1 ? 'result' : 'results'}` : ''}</span>
    </div>
    <div id="docs-search-results" aria-busy={pending} className="no-scrollbar max-h-[min(60dvh,480px)] overflow-y-auto overscroll-contain px-2 pb-2">
      {results.length ? <ul id="docs-search-list" role="listbox" aria-label="Matching documentation sections" className="space-y-1">
        {results.map((result, resultIndex) => <li key={result.id} role="none">
          <button
            id={`docs-result-${resultIndex}`}
            role="option"
            aria-selected={selectedIndex === resultIndex}
            type="button"
            disabled={pending}
            onClick={() => onNavigate(result)}
            onFocus={() => setSelectedIndex(resultIndex)}
            className={`flex w-full items-start gap-3 rounded px-3 py-3 text-left transition-colors hover:bg-docs-active focus-visible:outline-2 focus-visible:outline-docs-accent ${selectedIndex === resultIndex ? 'bg-docs-active' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[11px] text-docs-muted [overflow-wrap:anywhere]">{result.path.join(' › ')}</div>
              <div className="text-sm font-semibold [overflow-wrap:anywhere]"><Highlight text={result.title} words={result.matchedWords} /></div>
              {result.snippet && <p className="mt-1 text-xs leading-relaxed text-docs-muted [overflow-wrap:anywhere]"><Highlight text={result.snippet} words={result.matchedWords} /></p>}
            </div>
            <ChevronRight aria-hidden="true" className="mt-4 size-4 shrink-0 text-docs-muted" />
          </button>
        </li>)}
      </ul> : <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium">{query.trim() ? `No matching sections for “${query}”` : 'Find the exact topic'}</p>
        <p className="mt-2 text-xs leading-relaxed text-docs-muted">{query.trim() ? 'Try a shorter phrase, a related concept, or a code identifier.' : 'Search headings, explanations, and code across this documentation. Related programming terms and small typos are supported.'}</p>
      </div>}
    </div>
    <p id="docs-search-help" className="border-t border-docs-line px-4 py-3 text-[11px] text-docs-muted">↑ ↓ to choose · Enter to open the exact section · Esc to close</p>
  </dialog>
}
