import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, FileText, Hash, Search, X } from 'lucide-react'
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
  const results = useMemo(() => {
    const groups = new Map<string, SearchResult[]>()
    for (const result of searchDocs(index, deferredQuery)) {
      const group = groups.get(result.topic.id) ?? []
      group.push(result)
      groups.set(result.topic.id, group)
    }
    return [...groups.values()].flat()
  }, [index, deferredQuery])
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
    className="docs-search-dialog kumo-dialog fixed inset-x-0 bottom-auto top-[8dvh] m-0 mx-auto max-h-[84dvh] w-[calc(100%-2rem)] max-w-[720px] backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
  >
    <header className="kumo-dialog-header">
      <h2 id="docs-search-title" className="kumo-dialog-title">Search {name} documentation</h2>
      <button type="button" aria-label="Close search" onClick={onClose} className="kumo-dialog-close"><X className="size-4" /></button>
    </header>
    <div className="kumo-dialog-card">
    <div className="flex items-center gap-3 border-b border-docs-line px-5 py-4">
      <Search aria-hidden="true" className="size-5 shrink-0 text-docs-muted" />
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
        placeholder="Search documentation…"
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-docs-muted"
      />
    </div>
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-[11px] text-docs-muted">
      <span>All topics in {name} · headings, text &amp; code</span>
      <span role="status" aria-live="polite">{pending ? 'Searching…' : query.trim() ? `${results.length}${results.length === 40 ? '+' : ''} ${results.length === 1 ? 'result' : 'results'}` : ''}</span>
    </div>
    <div id="docs-search-results" aria-busy={pending} className="max-h-[min(58dvh,480px)] overflow-y-auto overscroll-contain px-3 pb-3">
      {results.length ? <ul id="docs-search-list" role="listbox" aria-label="Matching documentation sections" className="flex flex-col gap-1">
        {results.map((result, resultIndex) => <li key={result.id} role="none">
          {(resultIndex === 0 || results[resultIndex - 1].topic.id !== result.topic.id) && <div role="presentation" className="mb-1 mt-2 bg-docs-soft px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-docs-muted">{result.topic.title}</div>}
          <button
            id={`docs-result-${resultIndex}`}
            role="option"
            aria-selected={selectedIndex === resultIndex}
            type="button"
            disabled={pending}
            onClick={() => onNavigate(result)}
            onFocus={() => setSelectedIndex(resultIndex)}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors hover:bg-docs-soft focus-visible:outline-2 focus-visible:outline-docs-accent ${selectedIndex === resultIndex ? 'border-docs-accent bg-docs-active' : 'border-transparent'}`}
          >
            {result.anchorId ? <Hash aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-docs-accent" /> : <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-docs-muted" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold [overflow-wrap:anywhere]"><Highlight text={result.title} words={result.matchedWords} /></div>
              {result.snippet && <p className="mt-1 text-xs leading-relaxed text-docs-muted [overflow-wrap:anywhere]"><Highlight text={result.snippet} words={result.matchedWords} /></p>}
            </div>
            <CornerDownLeft aria-hidden="true" className={`mt-1 size-4 shrink-0 text-docs-muted ${selectedIndex === resultIndex ? '' : 'opacity-0'}`} />
          </button>
        </li>)}
      </ul> : <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium">{query.trim() ? `No matching sections for “${query}”` : 'Find the exact topic'}</p>
        <p className="mt-2 text-xs leading-relaxed text-docs-muted">{query.trim() ? 'Try a shorter phrase, a related concept, or a code identifier.' : 'Search headings, explanations, and code across this documentation. Related programming terms and small typos are supported.'}</p>
      </div>}
    </div>
    <footer id="docs-search-help" className="kumo-dialog-footer text-[11px] text-docs-muted"><p className="flex items-center gap-2"><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Select <kbd>Esc</kbd> Close</p><span>{name} docs</span></footer>
    </div>
  </dialog>
}
