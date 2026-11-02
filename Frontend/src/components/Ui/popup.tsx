import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { createPortal } from "react-dom"

interface AnchoredPopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  matchWidth?: boolean
  className?: string
  id?: string
}

type Position = { top: number; left: number; width: number; placement: "bottom" | "top" }

const GAP = 6
const VIEWPORT_PADDING = 8

// Rendered in a portal so it isn't clipped by the scrollable sidebar body.
export function AnchoredPopover({ open, anchorRef, onClose, children, matchWidth, className, id }: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }

    const update = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const panelHeight = panel?.offsetHeight ?? 0
      const panelWidth = matchWidth ? rect.width : (panel?.offsetWidth ?? rect.width)
      const spaceBelow = window.innerHeight - rect.bottom
      const placement = spaceBelow < panelHeight + GAP + VIEWPORT_PADDING && rect.top > spaceBelow ? "top" : "bottom"
      const top = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP - panelHeight
      const maxLeft = window.innerWidth - panelWidth - VIEWPORT_PADDING
      const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, maxLeft))
      setPos({ top: Math.max(VIEWPORT_PADDING, top), left, width: rect.width, placement })
    }

    update()
    const raf = requestAnimationFrame(update)
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, anchorRef, matchWidth])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    // Capture phase so Escape closes only the popover, not the surrounding task sidebar.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
      anchorRef.current?.focus()
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: matchWidth ? pos?.width : undefined,
        visibility: pos ? "visible" : "hidden",
      }}
      data-placement={pos?.placement}
      className={`z-[60] border border-soft bg-canvas text-foreground shadow-xl ${className ?? ""}`}
    >
      {children}
    </div>,
    document.body,
  )
}
