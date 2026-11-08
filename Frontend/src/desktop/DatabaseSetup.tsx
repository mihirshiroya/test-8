import { useId, useState, type FormEvent } from "react"
import { CheckCircle2, Database, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react"
import logo from "../assets/logo.png"
import WelcomeSplit from "../components/WelcomeSplit"
import { restartBackend, saveDatabaseUrl, setupDatabase, testDatabase } from "./desktop-api"
import { errorMessage } from "./tauri"
import type { DbCheckResult } from "./types"

type Variant = "first-run" | "unavailable" | "change"
type InputMode = "url" | "fields"
type Busy = "test" | "save" | "reconnect" | null

interface Fields {
  host: string
  port: string
  database: string
  user: string
  password: string
  sslmode: string
}

const DEFAULT_FIELDS: Fields = { host: "localhost", port: "5432", database: "", user: "postgres", password: "", sslmode: "prefer" }

const HINTS: Record<string, string> = {
  auth_failed: "Double-check the username and password. Special characters in the password must be URL-encoded when typed into a URL; the Fields tab does this for you.",
  database_not_found: "Create the database first, for example with: CREATE DATABASE productivity;",
  unreachable: "Is PostgreSQL running? Local installs usually listen on localhost:5432.",
  host_not_found: "Check for typos in the host name, or use localhost for a database on this computer.",
  timeout: "A firewall or VPN may be blocking the port, or the server is not reachable from this network.",
  ssl: "Hosted databases usually need sslmode=require. Local servers often need sslmode=disable.",
  permission_denied: "The app creates its own tables, so the user needs CREATE privileges on the schema.",
}

function buildUrl(f: Fields): string {
  const auth = `${encodeURIComponent(f.user.trim())}${f.password ? `:${encodeURIComponent(f.password)}` : ""}`
  const port = f.port.trim() || "5432"
  return `postgresql://${auth}@${f.host.trim()}:${port}/${encodeURIComponent(f.database.trim())}?sslmode=${f.sslmode}`
}

const COPY: Record<Variant, { title: string; description: string }> = {
  "first-run": {
    title: "Connect your database",
    description: "Your tasks, notes and timer history are stored in your own PostgreSQL database. Connect it once and the app remembers it.",
  },
  unavailable: {
    title: "Database unavailable",
    description: "The saved database could not be reached. Reconnect once it is back online, or connect a different database.",
  },
  change: {
    title: "Change database",
    description: "Connect a different PostgreSQL database. The app restarts its local backend with the new connection.",
  },
}

export function DatabaseSetup({
  variant,
  startupError,
  onCancel,
}: {
  variant: Variant
  startupError?: DbCheckResult
  onCancel?: () => void
}) {
  const id = useId()
  const [mode, setMode] = useState<InputMode>("url")
  const [url, setUrl] = useState("")
  const [fields, setFields] = useState<Fields>(DEFAULT_FIELDS)
  const [showSecret, setShowSecret] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [result, setResult] = useState<DbCheckResult | null>(startupError ?? null)

  const connectionUrl = mode === "url" ? url.trim() : buildUrl(fields)
  const canSubmit = mode === "url" ? connectionUrl.length > 0 : fields.host.trim() !== "" && fields.database.trim() !== ""
  const copy = COPY[variant]

  const setField = (key: keyof Fields) => (value: string) => setFields((prev) => ({ ...prev, [key]: value }))

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind)
    try {
      await fn()
    } catch (error) {
      setResult({ ok: false, code: "app_error", message: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const onTest = () => run("test", async () => setResult(await testDatabase(connectionUrl)))

  const onSave = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || busy) return
    void run("save", async () => {
      setResult(null)
      const outcome = await setupDatabase(connectionUrl)
      setResult(outcome)
      if (!outcome.ok) return
      await saveDatabaseUrl(connectionUrl)
      // The backend restarted with the new database on the same origin; a
      // fresh load drops cached data from any previous database.
      window.location.assign("/login")
    })
  }

  const onReconnect = () =>
    run("reconnect", async () => {
      await restartBackend()
      window.location.reload()
    })

  const hint = result && !result.ok && result.code ? HINTS[result.code] : undefined

  return (
    <main>
      <WelcomeSplit
        desktopSetup
        eyebrow={variant === "first-run" ? "Make yourself at home" : "Your workspace, reconnected"}
        title={<>Your rhythm.<br />Your space.<br />Your database.</>}
        description="A calmer place for everything you want to do. Connect PostgreSQL and make this workspace truly yours."
        benefits={[
          "Your tasks, notes and focus time in one place",
          "Connect a local or hosted PostgreSQL database",
          "Credentials kept in your system’s secure store",
        ]}
      >
      <form onSubmit={onSave} className="welcome-card welcome-setup-form flex flex-col gap-5" aria-labelledby={`${id}-title`}>
        <header className="flex flex-col">
          <div className="welcome-card-brand">
            <img src={logo} alt="" />
            <span>Consistent</span>
          </div>
          <span className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Database size={14} aria-hidden="true" /> YOUR WORKSPACE STARTS HERE</span>
          <div className="flex flex-col gap-1.5">
            <h1 id={`${id}-title`} className="text-balance text-2xl font-semibold text-foreground">{copy.title}</h1>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
          </div>
        </header>

        {variant === "unavailable" && (
          <button
            type="button"
            onClick={onReconnect}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "reconnect" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            Reconnect to saved database
          </button>
        )}

        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Connection details" className="flex gap-1 rounded-lg bg-muted p-1">
            {(["url", "fields"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "url" ? "Connection URL" : "Host & credentials"}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-url`} className="text-sm font-medium text-foreground">PostgreSQL connection URL</label>
              <div className="relative">
                <input
                  id={`${id}-url`}
                  type={showSecret ? "text" : "password"}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="postgresql://user:password@localhost:5432/productivity"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={showSecret ? "Hide connection URL" : "Show connection URL"}
                >
                  {showSecret ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Supports PostgreSQL 12+, including hosted providers such as Neon, Supabase or RDS.</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-3">
              <TextField className="col-span-4" label="Host" value={fields.host} onChange={setField("host")} />
              <TextField className="col-span-2" label="Port" value={fields.port} onChange={setField("port")} inputMode="numeric" />
              <TextField className="col-span-6" label="Database" value={fields.database} onChange={setField("database")} placeholder="productivity" />
              <TextField className="col-span-3" label="Username" value={fields.user} onChange={setField("user")} />
              <TextField className="col-span-3" label="Password" value={fields.password} onChange={setField("password")} type="password" />
              <div className="col-span-6 flex flex-col gap-1.5">
                <label htmlFor={`${id}-ssl`} className="text-sm font-medium text-foreground">SSL mode</label>
                <select
                  id={`${id}-ssl`}
                  value={fields.sslmode}
                  onChange={(e) => setField("sslmode")(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="prefer">prefer (default)</option>
                  <option value="require">require (hosted databases)</option>
                  <option value="disable">disable (local only)</option>
                  <option value="verify-full">verify-full</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div
            role="status"
            className={`flex gap-3 rounded-lg border p-3 text-sm ${result.ok ? "border-success/30 bg-success-soft text-foreground" : "border-destructive/30 bg-destructive/10 text-foreground"}`}
          >
            {result.ok ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-medium">{result.message}</p>
              {hint && <p className="text-muted-foreground">{hint}</p>}
            </div>
          </div>
        )}

        <div className="welcome-setup-actions gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onTest}
            disabled={!canSubmit || busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy === "test" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Test connection
          </button>
          <button
            type="submit"
            disabled={!canSubmit || busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {busy === "save" ? "Setting up database" : "Save and continue"}
          </button>
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="shrink-0" aria-hidden="true" />
          Credentials are stored in your system&apos;s secure credential store, never in plain files.
        </p>
      </form>
      </WelcomeSplit>
    </main>
  )
}

function TextField({
  label,
  value,
  onChange,
  className,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  type?: string
  placeholder?: string
  inputMode?: "numeric"
}) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  )
}
