import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  FolderOpen,
  Grid2X2,
  Home,
  KanbanSquare,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  CalendarDays,
  Settings,
  Trash2,
  X,
  LogOut,
  Layers3,
} from 'lucide-react'
import { cn } from '../lib/utills'
import { IS_DESKTOP } from '../lib/api-origin'
import { WindowTrafficLights } from '../desktop/DesktopTitleBar'
import ThemeSwitcher from './ThemeSwitcher'
import noResultsRaw from '../assets/31-no-results.svg?raw'
import { ThemedSvg } from '../lib/svg-theme'
import {
  ProjectDialog,
  type ProjectDraft,
} from '../components/Ui/project-dialog'
import {
  AppDialog,
  AppDialogButton,
  AppDialogSection,
} from '../components/Ui/app-dialog'
import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  DEFAULT_TINT,
  normalizeTint,
  type TintKey,
  type IconKey,
} from '../components/Ui/project-data'
import { NotificationsPanel } from '../components/Ui/notificaion-panel.tsx'
import { useWorkspaceStore } from '../store/slices/taskSlice.tsx'
import { logoutUser } from '../store/slices/authSlice'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../store'
import { toast } from '../lib/toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/Ui/dropdown-menu'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ProjectItem = {
  id: string
  label: string
  path: string
  tint: TintKey
  icon: IconKey
}

/* -------------------------------------------------------------------------- */
/* Static navigation                                                          */
/* -------------------------------------------------------------------------- */

const folders = [
  { label: 'Product launch', count: 12, color: 'bg-sky-500' },
  { label: 'Research', count: 8, color: 'bg-violet-500' },
  { label: 'Personal', count: 4, color: 'bg-amber-500' },
]

const outletItems = [
  { label: 'Overview', path: '/overview', icon: Home },
  { label: 'Notes', path: '/Notes', icon: FolderOpen },
  { label: 'Calendar', path: '/Calender', icon: CalendarDays },
  { label: 'Session', path: '/session', icon: Grid2X2 },
  { label: 'Kanban', path: '/kanban', icon: KanbanSquare },
]

/**
 * Workspaces now come from the backend, so there are no built-in defaults.
 * Kept as an (empty) export so existing imports don't break.
 */
const defaultProjects: ProjectItem[] = []

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const SIDEBAR_COLLAPSED_KEY = 'consistent-sidebar-collapsed'

const DEFAULT_APPEARANCE = {
  tint: DEFAULT_TINT,
  icon: 'folder' as IconKey,
}

const getInitialCollapsed = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* App Sidebar                                                                */
/* -------------------------------------------------------------------------- */

function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  /* ------------------------------------------------------------------------ */
  /* Backend data                                                             */
  /* ------------------------------------------------------------------------ */

  const {
    workspaces,
    error,
    clearError,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore()

  /* ------------------------------------------------------------------------ */
  /* UI state                                                                 */
  /* ------------------------------------------------------------------------ */

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [query] = useState('')
  const [notifications, setNotifications] = useState(3)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projectDialog, setProjectDialog] = useState<{
    mode: 'create' | 'edit'
    project?: ProjectItem
  } | null>(null)

  const [deleteProject, setDeleteProject] = useState<ProjectItem | null>(null)

  /* ------------------------------------------------------------------------ */
  /* Error toast (workspace errors → Sonner)                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!error) return
    toast.apiError(error, 'Workspace action failed')
    clearError()
  }, [error, clearError])

  /* ------------------------------------------------------------------------ */
  /* Projects = backend workspaces                                            */
  /* ------------------------------------------------------------------------ */

  const projects = useMemo<ProjectItem[]>(
    () =>
      (workspaces ?? []).map((workspace) => ({
        id: workspace.id,
        label: workspace.name,
        path: `/projects/${workspace.id}`,
        tint: workspace.tint ?? DEFAULT_APPEARANCE.tint,
        icon: workspace.icon ?? DEFAULT_APPEARANCE.icon,
      })),
    [workspaces],
  )

  const notificationWorkspaces = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.label })),
    [projects],
  )

  /* ------------------------------------------------------------------------ */
  /* Toggle collapse                                                          */
  /* ------------------------------------------------------------------------ */

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous

      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Ignore localStorage errors.
      }

      return next
    })
  }

  /* ------------------------------------------------------------------------ */
  /* Navigation                                                               */
  /* ------------------------------------------------------------------------ */

  const go = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  /* ------------------------------------------------------------------------ */
  /* Current breadcrumb                                                       */
  /* ------------------------------------------------------------------------ */

  const current = useMemo(() => {
    const allItems = [
      ...outletItems,
      ...projects.map((project) => ({
        label: project.label,
        path: project.path,
      })),
      { label: 'Profile', path: '/profile' },
    ]

    const exactMatch = allItems.find(
      (item) => location.pathname === item.path,
    )

    if (exactMatch) return exactMatch

    const projectMatch = projects.find((project) =>
      location.pathname.startsWith(`${project.path}/`),
    )

    if (projectMatch) {
      return { label: projectMatch.label, path: projectMatch.path }
    }

    return { label: 'Overview', path: '/overview' }
  }, [location.pathname, projects])

  /* ------------------------------------------------------------------------ */
  /* Filter projects                                                          */
  /* ------------------------------------------------------------------------ */

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return projects
    return projects.filter((project) =>
      project.label.toLowerCase().includes(search),
    )
  }, [projects, query])

  /* ------------------------------------------------------------------------ */
  /* Navigation classes                                                       */
  /* ------------------------------------------------------------------------ */

  const hideWhenCollapsed = collapsed ? 'md:hidden' : ''

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium my-1 transition-colors',
      collapsed && 'md:justify-center md:px-0',
      isActive
        ? 'bg-[var(--color-nav-active-bg)] font-semibold text-[var(--color-nav-active-text)]'
        : 'hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-nav-hover-text)] text-secondary',
    )

  const iconClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'size-[18px] shrink-0 transition-colors',
      isActive
        ? 'stroke-2 stroke-[var(--color-nav-active-text)]'
        : 'stroke-1 stroke-[var(--color-nav-hover-text)]',
    )

  const titleClass = cn('min-w-0 flex-1 truncate text-left !font-inter', hideWhenCollapsed)

  const workspaceIconClass = cn('grid size-6 shrink-0 place-items-center rounded-md')

  const workspaceTitleClass = cn(
    'min-w-0 flex-1 truncate text-left !font-inter',
    collapsed && 'md:hidden',
  )

  /* ------------------------------------------------------------------------ */
  /* Create / edit workspace (backend)                                        */
  /* ------------------------------------------------------------------------ */

  const handleProjectDialogSubmit = async (draft: ProjectDraft) => {
    if (saving) return

    const name = draft.name.trim()
    if (!name) return

    const editingProject = projectDialog?.project

    const duplicateName = projects.some(
      (project) =>
        project.id !== editingProject?.id &&
        project.label.trim().toLowerCase() === name.toLowerCase(),
    )
    if (duplicateName) return

    setSaving(true)
    try {
      if (projectDialog?.mode === 'edit' && editingProject) {
        // FIX: removed the early `return` that escaped the try block and
        // therefore never reached the `finally` clause — saving stayed true
        // and the dialog button remained permanently disabled after a
        // successful edit.
        const ok = await updateWorkspace(editingProject.id, {
          name,
          tint: draft.tint,
          icon: draft.icon,
        })
        if (ok) setProjectDialog(null)
        return   // still return early — but saving is reset in finally below
      }

      const created = await addWorkspace({
        name,
        tint: draft.tint,
        icon: draft.icon,
      })

      if (created) {
        setProjectDialog(null)
        go(`/projects/${created.id}`)
      }
    } finally {
      // This always runs whether we returned early (edit path) or fell through
      // (create path), so the button is never left stuck in a disabled state.
      setSaving(false)
    }
  }

  const handleEditClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    project: ProjectItem,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setProjectDialog({ mode: 'edit', project })
  }

  const handleDeleteClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    project: ProjectItem,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteProject(project)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteProject || saving) return

    const project = deleteProject
    setSaving(true)

    try {
      const ok = await deleteWorkspace(project.id)

      if (!ok) return

      setDeleteProject(null)

      if (
        location.pathname === project.path ||
        location.pathname.startsWith(`${project.path}/`)
      ) {
        go('/overview')
      }
    } finally {
      setSaving(false)
    }
  }
  const profileMenuItemClass =
    'cursor-pointer gap-2.5 px-2.5 py-2 text-sm transition-colors focus:bg-muted data-[variant=destructive]:focus:bg-muted'

  const dispatch = useDispatch<AppDispatch>()
  const handleLogout = async () => {
  try {
    await dispatch(logoutUser(false)).unwrap()

    setMobileOpen(false)
    navigate('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="workspace-shell min-h-screen bg-sidebar text-foreground">

      <div
        className={cn(
          'grid h-screen overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out',
          collapsed
            ? 'md:grid-cols-[68px_minmax(0,1fr)]'
            : 'md:grid-cols-[240px_minmax(0,1fr)]',
        )}
      >
        {/* ================================================================== */}
        {/* Sidebar                                                            */}
        {/* ================================================================== */}

        <aside
          className={cn(
            'workspace-sidebar group/sidebar fixed inset-y-0 left-0 z-30 flex h-screen w-[248px] max-w-[85vw] flex-col border-r border-soft bg-[var(--sidebar-bg)]',
            'transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            'md:relative md:inset-auto md:z-auto md:h-full md:min-h-0 md:w-full md:max-w-none md:translate-x-0',
          )}
        >
          {/* Logo header — same height as the content header; on hover the logo swaps for the window controls */}
          <div
            data-tauri-drag-region
            className={cn(
              'flex h-16 shrink-0 items-center gap-2 border-b border-soft px-3',
              collapsed && 'md:px-1',
            )}
          >
            <div
              data-tauri-drag-region
              className={cn('flex h-8 min-w-0 flex-1 items-center', collapsed && 'md:justify-center')}
            >
              <button
                type="button"
                onClick={() => go('/')}
                className={cn(
                  'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-accent',
                  collapsed && 'md:flex-none md:justify-center md:px-0',
                  IS_DESKTOP && 'group-hover/sidebar:hidden',
                )}
                aria-label="Consistent home"
              >
                <span className="workspace-brand-mark" aria-hidden="true">
                  <Layers3 className="size-[19px]" strokeWidth={1.8} />
                </span>
                <h3
                  className={cn(
                    'workspace-brand truncate',
                    collapsed && 'md:hidden',
                  )}
                >
                  Consistent
                </h3>
              </button>

              {IS_DESKTOP && (
                <div
                  className={cn(
                    'hidden h-full items-center px-1.5 group-hover/sidebar:flex',
                    collapsed && 'md:px-0',
                  )}
                >
                  <WindowTrafficLights />
                </div>
              )}
            </div>

            {/* Desktop collapse */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className={cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex',
                collapsed && 'md:hidden',
              )}
            >
              <PanelLeftClose className="size-[18px] text-secondary" />
            </button>

            {/* Mobile close */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
              <X className="size-[18px]" />
            </button>
          </div>


          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar"
            aria-label="Main navigation"
          >
            <p className={cn('workspace-nav-label', collapsed && 'md:hidden')}>Workspace</p>
            {/* Main navigation */}
            <ul className="mb-4 flex flex-col gap-0.5">
              {collapsed && (
                <li className="hidden md:block">
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label="Expand sidebar"
                    title="Expand sidebar"
                    className={cn(linkClass({ isActive: false }), 'w-full')}
                  >
                    <PanelLeft className={iconClass({ isActive: false })} />
                  </button>
                </li>
              )}
              {outletItems.map(({ label, path, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? label : undefined}
                    className={linkClass}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={iconClass({ isActive })} />
                        <span className={titleClass}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mx-2 border-t border-soft" />

            {/* Workspaces header */}
            <div
              className={cn(
                'mt-4 mb-2 flex items-center justify-between px-2',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              <span
                className={cn('text-[10px] font-semibold uppercase tracking-[.09em] text-steel', collapsed && 'md:hidden')}
              >
                Workspaces
              </span>

              <button
                type="button"
                aria-label="Create project"
                title="Create project"
                onClick={() => setProjectDialog({ mode: 'create' })}
                className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5 stroke-2" />
              </button>
            </div>

            {/* Workspace list */}
            {filteredProjects.length === 0 ? (
              !collapsed && (
                <div className="flex flex-col items-center gap-2 rounded-xl px-3 py-5 text-center">
                  <ThemedSvg
                    raw={noResultsRaw}
                    ariaLabel="No workspaces found"
                    className="h-20 w-20"
                  />
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-foreground">No workspaces yet</p>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      Create one to start organizing your work.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredProjects.map((project) => {
                const ProjectIcon =
                  FOLDER_ICONS[project.icon] ??
                  FOLDER_ICONS[DEFAULT_APPEARANCE.icon]
                const tint = FOLDER_TINTS[normalizeTint(project.tint)]

                return (
                  <li key={project.id}>
                    <NavLink
                      to={project.path}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? project.label : undefined}
                      className={linkClass}
                      style={({ isActive }) => ({
                        color: isActive ? tint.fg : undefined,
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={workspaceIconClass}>
                            <ProjectIcon className={iconClass({ isActive })} />
                          </span>

                          <span
                            className={cn(
                              workspaceTitleClass,
                              isActive ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {project.label}
                          </span>

                          {/* Edit / Delete */}
                          <span
                            className={cn(
                              'hidden shrink-0 items-center gap-0.5 group-hover:flex',
                              collapsed && '!hidden',
                            )}
                          >
                            <button
                              type="button"
                              aria-label={`Edit ${project.label}`}
                              onClick={(event) => handleEditClick(event, project)}
                              className="grid size-6 place-items-center rounded-md text-primary transition-colors hover:bg-accent hover:!text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              aria-label={`Delete ${project.label}`}
                              onClick={(event) => handleDeleteClick(event, project)}
                              className="grid size-6 place-items-center rounded-md text-red-500 transition-colors hover:bg-destructive/10 hover:!text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                )
                })}
              </ul>
            )}
          </nav>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-20 bg-background/70 md:hidden"
          />
        )}

        {/* ================================================================== */}
        {/* Main content                                                       */}
        {/* ================================================================== */}

        <div className="min-h-0 min-w-0 flex flex-col overflow-hidden">
          <header data-tauri-drag-region className="workspace-header flex h-16 shrink-0 items-center justify-between gap-3 border-b border-soft px-4 sm:px-7">
            {/* Left */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Open sidebar"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent md:hidden"
              >
                <Menu className="size-5" />
              </button>

              <div className="flex items-center gap-2 text-sm font-medium text-secondary !font-inter">
                <span className="hidden sm:inline">Workspace</span>
                <ChevronRight className="hidden size-4 sm:inline" />
                <span className="text-primary">{current.label}</span>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <ThemeSwitcher />

              <button
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotifications(0)
                  setNotificationsOpen(true)
                }}
                className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="size-[18px]" />

                {notifications > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Open profile menu"
                  className="ml-2 grid size-8 place-items-center rounded-full bg-background-inverse text-xs font-semibold text-inverse outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  AM
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="flex w-48 flex-col gap-0.5 p-1 shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => go('/profile')}
                    className={profileMenuItemClass}
                  >
                    <Settings className="size-4 text-muted-foreground" />
                    Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                    className={profileMenuItemClass}
                  >
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main id="workspace-content" className="workspace-content min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            <Outlet />
          </main>
        </div>

        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          workspaces={notificationWorkspaces}
        />

        {/* Create / Edit workspace dialog */}
        <ProjectDialog
          open={projectDialog !== null}
          mode={projectDialog?.mode ?? 'create'}
          initial={projectDialog?.project}
          onClose={() => setProjectDialog(null)}
          onSubmit={handleProjectDialogSubmit}
        />

        {/* Delete workspace modal */}
        <AppDialog
          open={deleteProject !== null}
          onClose={() => setDeleteProject(null)}
          dismissible={!saving}
          role="alertdialog"
          size="sm"
          title="Delete workspace"
          description={
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-ink">&ldquo;{deleteProject?.label}&rdquo;</span>?
            </>
          }
          footer={
            <>
              <AppDialogButton
                variant="secondary"
                onClick={() => setDeleteProject(null)}
                disabled={saving}
              >
                Cancel
              </AppDialogButton>
              <AppDialogButton
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={saving}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {saving ? 'Deleting…' : 'Delete workspace'}
              </AppDialogButton>
            </>
          }
        >
          <AppDialogSection
            icon={<Trash2 />}
            title="This can't be undone"
            description="All tasks in this workspace will be permanently deleted too."
          />
        </AppDialog>
      </div>
    </div>
  )
}

export {
  AppSidebar,
  outletItems,
  folders,
  defaultProjects,
}
