import type { ReactNode } from "react"
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import logo from "../assets/logo.png"
import { IS_DESKTOP } from "../lib/api-origin"
import { DatabaseSetup } from "./DatabaseSetup"
import { restartBackend, useDesktopStatus } from "./desktop-api"

/**
 * In the desktop app, nothing renders until the local backend reports its
 * mode: first-run setup, database unavailable, or ready. Web builds pass
 * straight through.
 */
export function DesktopGate({ children }: { children: ReactNode }) {
  if (!IS_DESKTOP) return <>{children}</>
  return <DesktopGateInner>{children}</DesktopGateInner>
}

function DesktopGateInner({ children }: { children: ReactNode }) {
  const status = useDesktopStatus()

  if (status.isPending) {
    return <Splash message="Starting your workspace" />
  }

  if (status.isError) {
    return (
      <Splash
        message="The local backend is not responding."
        error
        action={
          <button
            type="button"
            onClick={() => void restartBackend().finally(() => window.location.reload())}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Restart backend
          </button>
        }
      />
    )
  }

  if (status.data.mode === "setup") return <DatabaseSetup variant="first-run" />
  if (status.data.mode === "error") return <DatabaseSetup variant="unavailable" startupError={status.data.error} />
  return <>{children}</>
}

function Splash({ message, error, action }: { message: string; error?: boolean; action?: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <img src={logo} alt="" className="h-14 w-14 rounded-2xl" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        {error ? (
          <TriangleAlert size={16} className="text-destructive" aria-hidden="true" />
        ) : (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        )}
        <span>{message}</span>
      </div>
      {action}
    </main>
  )
}
