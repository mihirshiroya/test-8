import {
  PanelLeftClose,
  PanelLeft,
  Search,
  Home,
  FolderClosed,
  Star,
  Clock,
  Share2,
  Trash2,
  Settings,
  Plus,
  ChevronsUpDown,
  X,
  LogOut 
} from 'lucide-react'
import { cn } from '../../lib/utills'
import logo from '../../assets/logo.png'
import ThemeSwitcher from '../../pages/ThemeSwitcher'

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const primaryNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'folders', label: 'Notes', icon: FolderClosed, badge: 6 },
  { id: 'session', label: 'Session', icon: Star },
  { id: 'kanban', label: 'Kanban', icon: Clock },
]

const secondaryNav: NavItem[] = [
  { id: 'trash', label: 'Profile', icon: Trash2 },
    { id: 'logout', label: 'Logout', icon: LogOut },
]

export function AppSidebar({
  collapsed,
  onToggle,
  active,
  onSelect,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  active: string
  onSelect: (id: string) => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : ''

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border border-[rgb(var(--color-border))] bg-surface',
        'transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static column, always visible, width animates on collapse
        'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:transition-[width]',
        collapsed ? 'lg:w-[68px]' : 'lg:w-64',
      )}
    >
      {/* Profile header */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className={cn(
            'group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-gray-tint',
            collapsed && 'lg:justify-center',
          )}
        >
            <img src={logo} alt="DocxHub" className="size-8 shrink-0" />
          <span
            className={cn('flex min-w-0 flex-1 flex-col', hideWhenCollapsed)}
          >
            <span className="truncate text-sm font-semibold text-ink">
              DocxHub
            </span>
            <span className="truncate text-xs text-steel">Pro workspace</span>
          </span>
          <ChevronsUpDown
            className={cn('size-4 shrink-0 text-stone', hideWhenCollapsed)}
          />
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          className={cn(
            'hidden size-8 shrink-0 items-center justify-center rounded-lg text-steel transition-colors hover:bg-gray-tint hover:text-ink lg:flex',
            collapsed && 'lg:hidden',
          )}
        >
          <PanelLeftClose className="size-[18px]" />
        </button>

        {/* Mobile close */}
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-steel transition-colors hover:bg-gray-tint hover:text-ink lg:hidden"
        >
          <X className="size-[18px]" />
        </button>
      </div>

      {/* Desktop expand toggle (only on collapsed rail) */}
      {collapsed && (
        <div className="hidden justify-center px-3 pb-1 lg:flex">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-steel transition-colors hover:bg-gray-tint hover:text-ink"
          >
            <PanelLeft className="size-[18px]" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] bg-canvas px-2.5 text-sm text-stone transition-colors hover:border-strong',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className={cn('flex-1 text-left', hideWhenCollapsed)}>
            Search…
          </span>
          <kbd
            className={cn(
              'rounded border border-[rgb(var(--color-border))] bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel',
              hideWhenCollapsed,
            )}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.id}>
              <SidebarLink
                item={item}
                collapsed={collapsed}
                active={active === item.id}
                onClick={() => onSelect(item.id)}
              />
            </li>
          ))}
        </ul>

        <div
          className={cn(
            'mt-6 mb-2 flex items-center justify-between px-2',
            hideWhenCollapsed,
          )}
        >
          <span className="text-[11px] font-semibold tracking-wide text-stone uppercase">
            Projects
          </span>
          <button
            type="button"
            aria-label="Add workspace"
            className="flex size-5 items-center justify-center rounded text-stone transition-colors hover:bg-gray-tint hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <ul className={cn('flex flex-col gap-0.5', hideWhenCollapsed)}>
          {[
            { id: 'ws-design', label: 'Productivity', color: 'var(--brand-pink)' },
            { id: 'ws-eng', label: 'Multi tenant', color: 'var(--brand-teal)' },
            { id: 'ws-ops', label: 'Operations', color: 'var(--brand-orange)' },
          ].map((ws) => (
            <li key={ws.id}>
              <button
                type="button"
                onClick={() => onSelect(ws.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-gray-tint',
                  active === ws.id ? 'font-medium text-ink' : 'text-secondary',
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ws.color }}
                />
                <span className="truncate">{ws.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Secondary nav */}
      <div className="border-t border border-[rgb(var(--color-border))] px-3 py-2" >
        <ul className="flex flex-col gap-0.5">
          {secondaryNav.map((item) => (
            <li key={item.id}>
              <SidebarLink
                item={item}
                collapsed={collapsed}
                active={active === item.id}
                onClick={() => onSelect(item.id)}
              />
            </li>
          ))}
        </ul>
      </div>
     
    </aside>
  )
}

function SidebarLink({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors',
        collapsed && 'lg:justify-center lg:px-0',
        active
          ? 'bg-lavender font-medium text-primary'
          : 'text-secondary hover:bg-gray-tint hover:text-ink',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className={cn('flex-1 truncate text-left', hideWhenCollapsed)}>
        {item.label}
      </span>
      {item.badge != null && (
        <span
          className={cn(
            'rounded-full bg-canvas px-1.5 text-xs font-medium text-steel',
            hideWhenCollapsed,
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  )
}
