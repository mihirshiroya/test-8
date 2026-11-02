import { useEffect, useMemo, useState } from "react"
import { Maximize2, Minimize2, RefreshCw, X } from "lucide-react"

import { RecentActivity } from "./recent-activity"
import { ListSkeleton } from "./skeletons"
import { cn } from "../../lib/utills"
import { useAppDispatch, useAppSelector } from "../../store"
import { fetchOverview, selectOverview } from "../../store/slices/analyticsSlice"

const ALL_TAB = "__all__"

export function NotificationsPanel({
  open,
  onClose,
  workspaces,
}: {
  open: boolean
  onClose: () => void
  workspaces: { id: string; name: string }[]
}) {
  const dispatch = useAppDispatch()
  const { data, status } = useAppSelector(selectOverview)
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [expanded, setExpanded] = useState(false)

  const items = useMemo(() => data?.activity ?? [], [data])

  useEffect(() => {
    if (open) dispatch(fetchOverview())
  }, [open, dispatch])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  const tabs = useMemo(
    () => [{ id: ALL_TAB, name: "All" }, ...workspaces],
    [workspaces],
  )

  const resolvedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : ALL_TAB

  // Activity items only carry the workspace name (in `meta`), so tabs match on name.
  const itemsByTab = useMemo(() => {
    const map = new Map([[ALL_TAB, items]])
    for (const workspace of workspaces) {
      map.set(
        workspace.id,
        items.filter((item) => item.meta === workspace.name),
      )
    }
    return map
  }, [items, workspaces])

  const visibleItems = itemsByTab.get(resolvedTab) ?? items

  const loading = !data
  const refreshing = status === "loading" && !!data

  return (
    <div
      className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close notifications"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-title"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-soft bg-surface shadow-xl transition-all duration-300 ease-out",
          expanded ? "sm:w-[640px]" : "sm:w-[420px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-soft px-5">
          <h2 id="notifications-title" className="text-heading-5 text-primary">
            Notifications
          </h2>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Refresh notifications"
              tabIndex={open ? 0 : -1}
              onClick={() => dispatch(fetchOverview())}
              className="grid size-8 place-items-center rounded-lg text-steel hover:bg-accent hover:text-primary"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </button>
            <button
              type="button"
              aria-label={expanded ? "Collapse panel" : "Expand panel"}
              tabIndex={open ? 0 : -1}
              onClick={() => setExpanded((v) => !v)}
              className="hidden size-8 place-items-center rounded-lg text-steel hover:bg-accent hover:text-primary sm:grid"
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              type="button"
              aria-label="Close notifications"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-steel hover:bg-accent hover:text-primary"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b border-soft px-5 py-3">
          <div
            role="tablist"
            aria-label="Filter notifications by workspace"
            className="flex max-w-full gap-0.5 overflow-x-auto border border-soft p-0.5 no-scrollbar"
          >
            {tabs.map((tab) => {
              const active = resolvedTab === tab.id
              const count = itemsByTab.get(tab.id)?.length ?? 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm transition-colors",
                    active ? "bg-lavender text-primary" : "text-steel hover:text-primary",
                  )}
                >
                  <span className="max-w-32 truncate">{tab.name}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "min-w-5 px-1 text-center text-xs tabular-nums",
                        active ? "bg-primary text-inverse" : "bg-accent text-steel",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <RecentActivity key={resolvedTab} items={visibleItems} variant="panel" />
          )}
        </div>
      </aside>
    </div>
  )
}
