import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minimize2, RefreshCw, X } from 'lucide-react'
import { RecentActivity } from './recent-activity'
import { ListSkeleton } from './skeletons'
import { cn } from '../../lib/utills'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchOverview, selectOverview } from '../../store/slices/analyticsSlice'

type ActivityFilter = 'all' | 'tasks' | 'sessions'

export function NotificationsPanel({ open, onClose, workspaces }: {
  open: boolean
  onClose: () => void
  workspaces: { id: string; name: string }[]
}) {
  const dispatch = useAppDispatch()
  const { data, status } = useAppSelector(selectOverview)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all')
  const [workspaceId, setWorkspaceId] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const workspace = workspaces.find(item => item.id === workspaceId)
  const items = useMemo(() => (data?.activity ?? []).filter(item => !workspace || item.meta === workspace.name), [data, workspace])
  const sessions = items.filter(item => item.kind === 'focus' || item.type?.startsWith('SESSION_'))
  const tasks = items.filter(item => !sessions.includes(item))
  const visibleItems = activeFilter === 'tasks' ? tasks : activeFilter === 'sessions' ? sessions : items
  const tabs = [
    { id: 'all' as const, name: 'All', count: items.length },
    { id: 'tasks' as const, name: 'Tasks', count: tasks.length },
    { id: 'sessions' as const, name: 'Sessions', count: sessions.length },
  ]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open) { dialog?.close(); return }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    dispatch(fetchOverview())
    return () => { dialog?.close(); previousFocus?.focus({ preventScroll: true }) }
  }, [open, dispatch])

  return <dialog
    ref={dialogRef}
    aria-labelledby="notifications-title"
    aria-describedby="notifications-description"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    } }}
    className={cn('notification-dialog', expanded && 'notification-dialog--expanded')}
  >
    <div className="flex max-h-[inherit] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 id="notifications-title" className="text-sm font-semibold text-primary">Notifications</h2>
          <p id="notifications-description" className="mt-1 text-xs text-steel">The latest across your workspace.</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Refresh notifications" disabled={status === 'loading'} onClick={() => dispatch(fetchOverview())} className="notification-control"><RefreshCw className={cn('size-4', status === 'loading' && 'animate-spin')} /></button>
          <button type="button" aria-label={expanded ? 'Collapse panel' : 'Expand panel'} onClick={() => setExpanded(value => !value)} className="notification-control hidden sm:grid">{expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
          <button type="button" aria-label="Close notifications" onClick={onClose} className="notification-control"><X className="size-4" /></button>
        </div>
      </header>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-soft px-4">
        <div role="group" aria-label="Filter notifications by activity" className="flex gap-4">
          {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={activeFilter === tab.id} onClick={() => setActiveFilter(tab.id)} className="notification-tab">
            {tab.name}<span className="notification-count">{tab.count}</span>
          </button>)}
        </div>
      </div>
      {workspaces.length > 0 && <label className="flex shrink-0 items-center justify-between gap-3 border-b border-soft px-5 py-2.5 text-xs text-steel">
        Workspace
        <select aria-label="Filter notifications by workspace" value={workspace?.id ?? 'all'} onChange={event => setWorkspaceId(event.target.value)} className="max-w-[65%] rounded border border-soft bg-background px-2 py-1 text-primary">
          <option value="all">All workspaces</option>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      <div aria-busy={status === 'loading'} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!data && status === 'loading' ? <div className="p-5"><ListSkeleton rows={4} /></div> : status === 'failed' ? <div role="alert" className="flex flex-col gap-3 p-5 text-sm text-steel">
          <p>Could not refresh activity. Please try again.</p>
          <button type="button" onClick={() => dispatch(fetchOverview())} className="work-button self-start">Try again</button>
          {data && <RecentActivity items={visibleItems} variant="panel" />}
        </div> : <RecentActivity items={visibleItems} variant="panel" />}
      </div>
      <footer className="flex shrink-0 items-center justify-between border-t border-soft px-5 py-3 text-[10px] text-steel"><span>Workspace activity</span><span>Esc to close</span></footer>
    </div>
  </dialog>
}
