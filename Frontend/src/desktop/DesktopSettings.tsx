import { useEffect, useId, useState, type ReactNode } from "react"
import { useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  Database,
  Download,
  Keyboard,
  Loader2,
  LogOut,
  MonitorCog,
  Moon,
  Palette,
  Power,
  RefreshCw,
  Rocket,
  Sun,
  Timer,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "../context/ThemeContext"
import { toast } from "../lib/toast"
import type { AppDispatch } from "../store"
import { logoutUser } from "../store/slices/authSlice"
import { DatabaseSetup } from "./DatabaseSetup"
import {
  DESKTOP_EVENTS,
  checkForUpdate,
  exportPreferences,
  fetchDatabaseHealth,
  forgetDatabaseUrl,
  getAppInfo,
  getAutostart,
  getShortcutIssues,
  importPreferences,
  installUpdate,
  isFloatingVisible,
  notify,
  preferencesKey,
  quitApp,
  restartBackend,
  setAutostart,
  toggleFloating,
  useDesktopStatus,
  usePreferences,
  useSavePreferences,
} from "./desktop-api"
import { ShortcutInput } from "./ShortcutInput"
import { errorMessage, listen } from "./tauri"
import type { DesktopPreferences, ShortcutAction, ShortcutIssue, UpdateInfo } from "./types"

const SHORTCUTS: { action: ShortcutAction; label: string; description: string }[] = [
  { action: "toggleTimer", label: "Start / pause timer", description: "Resumes the last task or pauses the running one." },
  { action: "resetTimer", label: "Reset session", description: "Discards the running session's time and pauses the task." },
  { action: "toggleFloating", label: "Show / hide floating timer", description: "Toggles the always-on-top timer window." },
  { action: "showDashboard", label: "Open dashboard", description: "Brings the main window to the front." },
]

export default function DesktopSettings() {
  const preferences = usePreferences()
  const save = useSavePreferences()
  const [issues, setIssues] = useState<ShortcutIssue[]>([])

  useEffect(() => {
    getShortcutIssues().then(setIssues).catch(() => {})
  }, [])

  const update = async (patch: Partial<DesktopPreferences>) => {
    if (!preferences.data) return
    try {
      const result = await save.mutateAsync({ ...preferences.data, ...patch })
      setIssues(result.shortcutIssues)
      return result
    } catch (error) {
      toast.error(errorMessage(error, "Could not save settings."))
    }
  }

  if (preferences.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading desktop settings
      </div>
    )
  }
  if (preferences.isError || !preferences.data) {
    return <p className="text-sm text-destructive">Desktop settings are only available in the desktop app.</p>
  }

  const prefs = preferences.data

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-semibold text-foreground">Desktop settings</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Database connection, timer window, tray, shortcuts and startup behavior for this computer.
        </p>
      </header>

      <DatabaseSection />

      <Section icon={Timer} title="Floating timer" description="An always-on-top timer that stays visible over other apps.">
        <FloatingVisibilityRow />
        <ToggleRow
          label="Show when the app starts"
          checked={prefs.showFloatingOnStartup}
          onChange={(v) => void update({ showFloatingOnStartup: v })}
        />
        <ToggleRow
          label="Compact display"
          description="A single slim row with the time and a start/pause button."
          checked={prefs.floatingCompact}
          onChange={(v) => void update({ floatingCompact: v })}
        />
      </Section>

      <Section icon={MonitorCog} title="System tray" description="The tray icon shows the timer status and quick controls.">
        <ToggleRow
          label="Close to tray"
          description="Closing the dashboard keeps the app and timer running in the tray. When off, closing the dashboard quits the app."
          checked={prefs.closeToTray}
          onChange={(v) => void update({ closeToTray: v })}
        />
      </Section>

      <Section icon={Keyboard} title="Global shortcuts" description="Work from any application. Click a shortcut to record a new one.">
        {SHORTCUTS.map(({ action, label, description }) => {
          const issue = issues.find((i) => i.action === action)
          const inputId = `shortcut-${action}`
          return (
            <div key={action} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>
                <p className="text-xs text-muted-foreground">{description}</p>
                {issue && <p className="text-xs text-destructive">{issue.message}</p>}
              </div>
              <ShortcutInput
                id={inputId}
                value={prefs.shortcuts[action]}
                invalid={Boolean(issue)}
                onChange={(accelerator) => void update({ shortcuts: { ...prefs.shortcuts, [action]: accelerator } })}
              />
            </div>
          )
        })}
      </Section>

      <Section icon={Bell} title="Notifications">
        <ToggleRow
          label="Desktop notifications"
          description="Notify when a task reaches its planned time, even when the dashboard is hidden."
          checked={prefs.notificationsEnabled}
          onChange={(v) => void update({ notificationsEnabled: v })}
        />
        <div className="py-3">
          <SecondaryButton
            disabled={!prefs.notificationsEnabled}
            onClick={() => void notify("Notifications are on", "You will be notified when the timer completes.").catch((e) => toast.error(errorMessage(e)))}
          >
            Send test notification
          </SecondaryButton>
        </div>
      </Section>

      <StartupSection prefs={prefs} onChange={update} />

      <AppearanceSection />

      <BackupSection onImported={(result) => result && setIssues(result.shortcutIssues)} />

      <AboutSection />

      <AccountSection />
    </div>
  )
}

/* -------------------------------- sections -------------------------------- */

function DatabaseSection() {
  const queryClient = useQueryClient()
  const status = useDesktopStatus()
  const health = useQuery({
    queryKey: ["desktop", "db-health"],
    queryFn: fetchDatabaseHealth,
    refetchInterval: 15_000,
  })
  const [busy, setBusy] = useState<"test" | "reconnect" | "forget" | null>(null)
  const [changing, setChanging] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)

  const connected = health.data?.database ?? false

  const test = async () => {
    setBusy("test")
    const result = await queryClient.fetchQuery({ queryKey: ["desktop", "db-health"], queryFn: fetchDatabaseHealth, staleTime: 0 })
    setBusy(null)
    if (result.database) toast.success("The database is reachable.")
    else toast.error("The database is not reachable. Check that it is running, then reconnect.")
  }

  const reconnect = async () => {
    setBusy("reconnect")
    try {
      await restartBackend()
      window.location.reload()
    } catch (error) {
      setBusy(null)
      toast.error(errorMessage(error, "Could not restart the local backend."))
    }
  }

  const forget = async () => {
    setBusy("forget")
    try {
      await forgetDatabaseUrl()
      window.location.assign("/")
    } catch (error) {
      setBusy(null)
      toast.error(errorMessage(error))
    }
  }

  return (
    <Section icon={Database} title="Database" description="Your data lives in your own PostgreSQL database. The connection URL is kept in the system credential store.">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${health.isPending ? "bg-muted-foreground" : connected ? "bg-success" : "bg-destructive"}`} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            {health.isPending ? "Checking connection" : connected ? "Connected" : "Unavailable"}
          </span>
          {status.data?.version && <span className="text-xs text-muted-foreground">Backend {status.data.version}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => void test()} disabled={busy !== null}>
            {busy === "test" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Test connection
          </SecondaryButton>
          <SecondaryButton onClick={() => void reconnect()} disabled={busy !== null}>
            {busy === "reconnect" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            Reconnect
          </SecondaryButton>
          <SecondaryButton onClick={() => setChanging(true)} disabled={busy !== null}>
            Change database
          </SecondaryButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-xs text-muted-foreground">Disconnecting removes the saved URL from this computer. Your data stays in the database.</p>
        {confirmForget ? (
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmForget(false)} disabled={busy !== null}>Cancel</SecondaryButton>
            <DangerButton onClick={() => void forget()} disabled={busy !== null}>
              {busy === "forget" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Disconnect
            </DangerButton>
          </div>
        ) : (
          <DangerButton onClick={() => setConfirmForget(true)} disabled={busy !== null}>Disconnect database</DangerButton>
        )}
      </div>

      {changing && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label="Change database">
          <DatabaseSetup variant="change" onCancel={() => setChanging(false)} />
        </div>
      )}
    </Section>
  )
}

function FloatingVisibilityRow() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    isFloatingVisible().then(setVisible).catch(() => {})
    const off = listen<boolean>(DESKTOP_EVENTS.floatingVisibility, setVisible)
    return () => void off.then((fn) => fn())
  }, [])

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">Floating timer window</span>
        <span className="text-xs text-muted-foreground">Closing it never stops the timer.</span>
      </div>
      <SecondaryButton
        onClick={() =>
          void toggleFloating()
            .then(setVisible)
            .catch((e) => toast.error(errorMessage(e)))
        }
      >
        {visible ? "Hide" : "Show"}
      </SecondaryButton>
    </div>
  )
}

function StartupSection({
  prefs,
  onChange,
}: {
  prefs: DesktopPreferences
  onChange: (patch: Partial<DesktopPreferences>) => Promise<unknown>
}) {
  const autostart = useQuery({ queryKey: ["desktop", "autostart"], queryFn: getAutostart })
  const queryClient = useQueryClient()

  const setLaunch = async (enabled: boolean) => {
    try {
      queryClient.setQueryData(["desktop", "autostart"], await setAutostart(enabled))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Section icon={Rocket} title="Startup">
      <ToggleRow
        label="Launch when I sign in to my computer"
        checked={autostart.data ?? false}
        disabled={autostart.isPending}
        onChange={(v) => void setLaunch(v)}
      />
      <ToggleRow
        label="Start minimized to the tray"
        description="The timer and shortcuts are ready without opening the dashboard."
        checked={prefs.startMinimized}
        onChange={(v) => void onChange({ startMinimized: v })}
      />
    </Section>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
  ]
  return (
    <Section icon={Palette} title="Appearance">
      <div className="flex items-center justify-between gap-4 py-3">
        <span className="text-sm font-medium text-foreground" id="theme-label">Theme</span>
        <div role="radiogroup" aria-labelledby="theme-label" className="flex gap-1 rounded-lg bg-muted p-1">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${theme === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function BackupSection({ onImported }: { onImported: (result: Awaited<ReturnType<typeof importPreferences>>) => void }) {
  const queryClient = useQueryClient()
  return (
    <Section icon={Download} title="Settings file" description="Export these desktop settings to a file, or import them on another computer. Credentials are never exported.">
      <div className="flex flex-wrap gap-2 py-3">
        <SecondaryButton
          onClick={() =>
            void exportPreferences()
              .then((path) => path && toast.success(`Settings saved to ${path}`))
              .catch((e) => toast.error(errorMessage(e)))
          }
        >
          <Download size={14} aria-hidden="true" />
          Export settings
        </SecondaryButton>
        <SecondaryButton
          onClick={() =>
            void importPreferences()
              .then((result) => {
                if (!result) return
                queryClient.setQueryData(preferencesKey, result.preferences)
                onImported(result)
                toast.success("Settings imported.")
              })
              .catch((e) => toast.error(errorMessage(e)))
          }
        >
          <Upload size={14} aria-hidden="true" />
          Import settings
        </SecondaryButton>
      </div>
    </Section>
  )
}

function AboutSection() {
  const info = useQuery({ queryKey: ["desktop", "app-info"], queryFn: getAppInfo, staleTime: Infinity })
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [update, setUpdate] = useState<UpdateInfo | null | undefined>(undefined)

  const check = async () => {
    setChecking(true)
    try {
      const result = await checkForUpdate()
      setUpdate(result)
      if (!result) toast.success("You have the latest version.")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  const install = async () => {
    setInstalling(true)
    try {
      await installUpdate()
    } catch (error) {
      setInstalling(false)
      toast.error(errorMessage(error))
    }
  }

  return (
    <Section icon={RefreshCw} title="About and updates">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 py-3 text-sm">
        <dt className="text-muted-foreground">Version</dt>
        <dd className="font-mono text-foreground">{info.data?.version ?? "..."}</dd>
        {info.data?.logDir && (
          <>
            <dt className="text-muted-foreground">Logs</dt>
            <dd className="break-all font-mono text-xs text-foreground">{info.data.logDir}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-3 py-3">
        <SecondaryButton onClick={() => void check()} disabled={checking || installing}>
          {checking && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          Check for updates
        </SecondaryButton>
        {update && (
          <>
            <span className="text-sm text-foreground">Version {update.version} is available.</span>
            <PrimaryButton onClick={() => void install()} disabled={installing}>
              {installing && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {installing ? "Installing" : "Install and restart"}
            </PrimaryButton>
          </>
        )}
      </div>
      {update?.notes && <p className="whitespace-pre-line pb-3 text-xs text-muted-foreground">{update.notes}</p>}
    </Section>
  )
}

function AccountSection() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const logout = async () => {
    try {
      await dispatch(logoutUser(false)).unwrap()
      navigate("/login")
    } catch (error) {
      toast.error(errorMessage(error, "Could not log out."))
    }
  }
  return (
    <Section icon={Power} title="Session">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-xs text-muted-foreground">Exiting stops the timer surfaces and the local backend. Running sessions are kept and resume when you reopen the app.</p>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => void logout()}>
            <LogOut size={14} aria-hidden="true" />
            Log out
          </SecondaryButton>
          <DangerButton onClick={() => void quitApp()}>
            <Power size={14} aria-hidden="true" />
            Exit app
          </DangerButton>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------- primitives ------------------------------- */

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3 pb-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id={id} className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="text-pretty text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        {description && <p className="text-pretty text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-background shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

type ButtonProps = { onClick: () => void; disabled?: boolean; children: ReactNode }

function SecondaryButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function DangerButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
