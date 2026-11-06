import { createElement, useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, WrapText } from 'lucide-react'
import { noteLowlight } from '../../lib/note-highlighting'

type HighlightNode = { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: HighlightNode[] }
function renderHighlight(node: HighlightNode, key: number): ReactNode {
  if (node.type === 'text') return node.value
  return createElement('span', { key, className: node.properties?.className?.join(' ') }, node.children?.map(renderHighlight))
}

export function NoteCodePreview({ content, language = 'text', copied: externalCopied, onCopy }: { content: string; language?: string; copied?: boolean; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const lines = content.replace(/\n$/, '').split('\n')
  const collapsed = lines.length > 22 && !expanded
  const visible = collapsed ? lines.slice(0, 18).join('\n') : content.replace(/\n$/, '')
  const highlighted = useMemo(() => {
    try {
      if (visible.length > 100000 || !noteLowlight.registered(language)) return visible
      return noteLowlight.highlight(language, visible).children.map((node, index) => renderHighlight(node as HighlightNode, index))
    } catch { return visible }
  }, [visible, language])
  const copy = async () => {
    try {
      if (onCopy) onCopy()
      else await navigator.clipboard.writeText(content)
      setCopied(true)
      setCopyError(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { setCopyError(true) }
  }
  return <div className="note-code">
    <div className="note-code-header">
      <div className="flex min-w-0 items-center gap-3"><span className="note-code-mark" aria-hidden="true">{'</>'}</span><span className="truncate font-mono">{language || 'text'}</span><span className="note-code-count">{lines.length} lines</span></div>
      <div className="flex shrink-0 items-center gap-1"><button type="button" className="note-tool" title="Wrap code lines" aria-label="Wrap code lines" aria-pressed={wrap} onClick={() => setWrap(!wrap)}><WrapText size={14} /></button><button type="button" className="note-tool" onClick={() => void copy()} aria-label="Copy code">{copied || externalCopied ? <Check size={14} /> : <Copy size={14} />}<span>{copied || externalCopied ? 'Copied' : copyError ? 'Retry copy' : 'Copy'}</span></button></div>
    </div>
    <div className="note-code-scroll" tabIndex={0} role="region" aria-label={`${language} code`}>
      <div className="note-code-body"><pre className="note-line-numbers" aria-hidden="true">{Array.from({ length: collapsed ? 18 : lines.length }, (_, i) => i + 1).join('\n')}</pre><pre style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre', overflowWrap: wrap ? 'anywhere' : undefined }}><code>{highlighted}</code></pre></div>
    </div>
    {lines.length > 22 && <button type="button" className="note-code-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ChevronDown size={14} />{expanded ? 'Collapse code' : `Show all ${lines.length} lines`}</button>}
    {copyError && <span className="sr-only" role="status">Clipboard access was denied. Select and copy the code manually.</span>}
  </div>
}
