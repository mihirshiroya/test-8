import { useEffect, useState, type RefObject } from 'react'
import type { Content } from '../lib/docs-data'
import { isMarkdownContent } from '../lib/note-markdown'
import { docsHeadingAnchors } from '../lib/docs-heading'

type TocEntry = { id: string; title: string }

export function useDocsToc(scrollRef: RefObject<HTMLElement | null>, content: Content[] | undefined) {
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeTocId, setActiveTocId] = useState<string | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const targets: HTMLElement[] = []
    const entries: TocEntry[] = []
    for (const item of content ?? []) {
      const section = document.getElementById(`content-${item.id}`)
      if (!section || !container.contains(section)) continue

      const allHeadings = Array.from(section.querySelectorAll<HTMLElement>('.note-preview :is(h1, h2, h3, h4, h5, h6)'))
      const anchors = docsHeadingAnchors(item.id, allHeadings.map(heading => Number(heading.tagName.slice(1))))
      allHeadings.forEach((heading, index) => {
        heading.id = anchors[index].id
        heading.style.scrollMarginTop = '24px'
      })
      const headings = isMarkdownContent(item) ? allHeadings.filter((_, index) => anchors[index].main) : []

      if (headings.length) {
        headings.forEach(heading => {
          targets.push(heading)
          entries.push({ id: heading.id, title: heading.textContent?.trim() || item.title })
        })
      } else {
        targets.push(section)
        entries.push({ id: section.id, title: item.title })
      }
    }

    setToc(entries)
    let offsets: number[] = []
    let viewportHeight = 0
    let contentHeight = 0
    let positionsDirty = true
    let frame: number | null = null
    let previousActiveId: string | null | undefined

    const updateActive = () => {
      frame = null
      const scrollTop = container.scrollTop
      if (positionsDirty) {
        const containerTop = container.getBoundingClientRect().top
        offsets = targets.map(target => target.getBoundingClientRect().top - containerTop + scrollTop)
        viewportHeight = container.clientHeight
        contentHeight = container.scrollHeight
        positionsDirty = false
      }

      let index = 0
      if (scrollTop > 0) {
        let low = 0
        let high = offsets.length - 1
        while (low <= high) {
          const middle = (low + high) >>> 1
          if (offsets[middle] <= scrollTop + 40) {
            index = middle
            low = middle + 1
          } else high = middle - 1
        }
        if (scrollTop + viewportHeight >= contentHeight - 2) index = targets.length - 1
      }
      const nextId = targets[index]?.id ?? null
      if (nextId !== previousActiveId) {
        previousActiveId = nextId
        setActiveTocId(nextId)
      }
    }

    const scheduleUpdate = () => {
      if (frame === null) frame = requestAnimationFrame(updateActive)
    }
    const invalidatePositions = () => {
      positionsDirty = true
      scheduleUpdate()
    }
    updateActive()
    container.addEventListener('scroll', scheduleUpdate, { passive: true })
    container.addEventListener('load', invalidatePositions, true)
    window.addEventListener('resize', invalidatePositions)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidatePositions)
    if (container.firstElementChild) resizeObserver?.observe(container.firstElementChild)
    resizeObserver?.observe(container)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      container.removeEventListener('scroll', scheduleUpdate)
      container.removeEventListener('load', invalidatePositions, true)
      window.removeEventListener('resize', invalidatePositions)
      resizeObserver?.disconnect()
    }
  }, [content, scrollRef])

  return { toc, activeTocId, setActiveTocId }
}
