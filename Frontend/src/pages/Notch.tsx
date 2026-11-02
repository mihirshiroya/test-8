"use client"

import React, { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

import {
  useActiveTask,
  useTaskStore,
  formatClock,
} from "../store/slices/taskSlice"

import { TimerPanel } from "../components/Ui/timer-panel"
import { RobotHead, useRobotPresence } from "../components/Ui/robot-head"
import { ROBOT_COLOR, getTimerRobotState } from "../components/Ui/timer-robot"
import { useAuth } from "../hooks/useAuth"

interface NotchNavbarProps {
  brand?: string
  ctaLabel?: string
  ctaHref?: string
  barBg?: string
  pageBg?: string
  ctaBg?: string
  /** bottom corner radius (px) of the notch body */
  radius?: number
  /** horizontal length (px) of the top flares on each side */
  flare?: number
  /** vertical drop (px) of the top flares */
  flareHeight?: number
  /** 0–100: how solid the notch tint is (lower = more see-through glass) */
  glassOpacity?: number
  /** blur strength in px for content behind the notch */
  blur?: number
}

/**
 * Builds the notch outline for a body of size (w x h) with long flares
 * of horizontal length `fw` and vertical drop `fh` on both sides.
 * Total shape width = w + 2*fw.
 *
 *  ────────────────────────────────  (flush with top of screen)
 *    ╲___                    ___╱    (long, smooth flares)
 *        │                  │
 *         ╲________________╱         (rounded bottom corners)
 */
function buildNotchPath(
  w: number,
  h: number,
  fw: number,
  fh: number,
  r: number
) {
  const W = w + 2 * fw

  // keep geometry valid for small heights
  const drop = Math.max(0, Math.min(fh, h - 4))
  const rad = Math.min(r, Math.max(0, h - drop), w / 2)

  return [
    `M 0 0`,
    `H ${W}`,
    // right flare (long concave S-curve)
    `C ${W - fw * 0.6} 0 ${W - fw} ${drop * 0.4} ${W - fw} ${drop}`,
    `V ${h - rad}`,
    // bottom-right corner (convex)
    `Q ${W - fw} ${h} ${W - fw - rad} ${h}`,
    `H ${fw + rad}`,
    // bottom-left corner (convex)
    `Q ${fw} ${h} ${fw} ${h - rad}`,
    `V ${drop}`,
    // left flare (long concave S-curve)
    `C ${fw} ${drop * 0.4} ${fw * 0.6} 0 0 0`,
    `Z`,
  ].join(" ")
}

export default function NotchNavbar({
  brand = "Notch Buddy",
  ctaLabel = "Buy lifetime license",
  ctaHref = "#",
  barBg = "#17110F",
  pageBg = "#F5E8DF",
  ctaBg = "#FA6F45",
  radius = 18,
  flare = 40,
  flareHeight = 22,
  glassOpacity = 55,
  blur = 16,
}: NotchNavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const navRef = useRef<HTMLElement | null>(null)

  // --------------------------------------------------
  // IMPORTANT:
  // ALL HOOKS MUST RUN BEFORE ANY CONDITIONAL RETURN
  // --------------------------------------------------

  const { isAuthenticated } = useAuth()

  const { hasActiveTask } = useTaskStore()

  const { activeTask, timer, remainingSeconds: remaining } = useActiveTask()

  const robotState = useRobotPresence(
    getTimerRobotState({
      hasTask: hasActiveTask && Boolean(activeTask),
      phase: timer.phase,
      isStale: timer.isStale,
      remaining,
      planned: activeTask?.plannedDurationSeconds ?? 0,
    }),
    !hasActiveTask || timer.phase === "stopped",
    20000
  )

  // Measure the nav so the SVG outline matches it exactly
  useEffect(() => {
    const el = navRef.current
    if (!el) return

    const update = () =>
      setSize({ w: el.offsetWidth, h: el.offsetHeight })

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isAuthenticated])

  // --------------------------------------------------
  // Authentication guard
  // --------------------------------------------------

  if (!isAuthenticated) {
    return null
  }

  // --------------------------------------------------
  // Timer
  // --------------------------------------------------

  const timerText = hasActiveTask
    ? formatClock(Math.max(0, Math.floor(remaining)))
    : "00:00"

  // --------------------------------------------------
  // Single glass layer, clipped to the notch outline.
  // One backdrop-filter + one clip-path = no seams.
  // --------------------------------------------------

  const ready = size.w > 0 && size.h > 0
  const notchPath = ready
    ? buildNotchPath(size.w, size.h, flare, flareHeight, radius)
    : undefined

  const glassLayerStyle: React.CSSProperties = {
    left: -flare,
    right: -flare,
    backgroundColor: `color-mix(in srgb, ${barBg} ${glassOpacity}%, transparent)`,
    backdropFilter: `blur(${blur}px) saturate(160%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
    clipPath: notchPath ? `path('${notchPath}')` : undefined,
    WebkitClipPath: notchPath ? `path('${notchPath}')` : undefined,
    opacity: ready ? 1 : 0,
  }

  return (
    <>
      {/* =========================
          NOTCH
      ========================== */}
      <header className="pointer-events-none fixed left-1/2 top-0 z-[9999] -translate-x-1/2">
        <nav
          ref={navRef}
          className="
            pointer-events-auto
            relative
            flex
            w-fit
            max-w-[95vw]
            items-center
            gap-5
            px-4
            pb-1.5
            pt-1
            shadow-none
            outline-none
          "
        >
          {/* =========================
              GLASS LAYER (SVG-path clipped)
          ========================== */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0"
            style={glassLayerStyle}
          />

          {/* =========================
              TIMER NOTCH BUTTON
          ========================== */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open focus timer"
            className="
              group
              relative
              flex
              h-9
              items-center
              justify-center
              gap-2
            "
          >
            <RobotHead
              state={robotState}
              size={30}
              color={ROBOT_COLOR[robotState]}
              className="-my-1"
            />

            {/* Timer */}
            <span
              className="
                font-mono
                text-[13px]
                font-medium
                tabular-nums
                tracking-tight
                text-white
              "
            >
              {timerText}
            </span>
          </button>
        </nav>
      </header>

      {/* =========================
          SIDEBAR OVERLAY (blurs the page behind the sidebar)
      ========================== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[105] bg-black/20 backdrop-blur-md"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =========================
          TIMER SIDEBAR
      ========================== */}
      <aside
        aria-label="Focus timer"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`
          fixed
          right-0
          top-0
          z-[110]
          flex
          h-dvh
          w-[360px]
          max-w-[92vw]
          flex-col
          border-l
          border-soft
          bg-canvas
          shadow-2xl
          transition-transform
          duration-300
          ease-out
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* =========================
            SIDEBAR HEADER
        ========================== */}
        <div
          className="
            flex
            h-14
            shrink-0
            items-center
            justify-between
            border-b
            border-soft
            px-4
          "
        >
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                hasActiveTask
                  ? "animate-pulse bg-green-500"
                  : "bg-muted-foreground/40"
              }`}
            />

            <span className="text-md font-semibold text-foreground">
              Focus Timer
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close timer"
            className="
              flex
              size-8
              items-center
              justify-center
              rounded-lg
              text-muted-foreground
              transition-colors
              hover:bg-muted
              hover:text-foreground
            "
          >
            <X size={17} />
          </button>
        </div>

        {/* =========================
            TIMER PANEL
        ========================== */}
        <div className="min-h-0 flex-1">
          <TimerPanel />
        </div>
      </aside>
    </>
  )
}