import { useEffect, useId, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { videoSource } from '../../lib/note-markdown'
import { NoteCodePreview } from './note-code-preview'

export function MermaidPreview({ source }: { source: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setError('')
    if (ref.current) ref.current.textContent = ''
    const render = async () => {
      try {
        if (source.length > 30000) throw new Error('Diagram is too large (maximum 30,000 characters).')
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default', maxTextSize: 30000, suppressErrorRendering: true, flowchart: { htmlLabels: false } })
        const result = await mermaid.render(`diagram-${id}`, source)
        if (!cancelled && ref.current) ref.current.innerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message.split('\n').slice(0, 3).join('\n') : 'Unable to render diagram.')
      }
    }
    void render()
    return () => { cancelled = true }
  }, [source, id])
  return <figure className="note-diagram"><figcaption>MERMAID DIAGRAM</figcaption><div ref={ref} role="img" aria-label={`Mermaid diagram: ${source.slice(0, 160)}`} />{error && <><p className="note-block-error" role="status">{error}</p><NoteCodePreview content={source} language="mermaid" /></>}<details><summary>Diagram source</summary><NoteCodePreview content={source} language="mermaid" /></details></figure>
}

export function VideoPreview({ source }: { source: string }) {
  const video = videoSource(source.trim())
  if (!video) return <p className="note-block-error">Use an HTTPS YouTube, Vimeo, MP4, WebM, or OGG URL.</p>
  return <figure className="note-video">{video.kind === 'embed' ? <iframe src={video.url} title="Embedded note video" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <video src={video.url} controls preload="none"><track kind="captions" />Your browser does not support video.</video>}<figcaption><a href={source.trim()} target="_blank" rel="noopener noreferrer">Open original video</a></figcaption></figure>
}
