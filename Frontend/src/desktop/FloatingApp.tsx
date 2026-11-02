import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FloatingTimer } from "./FloatingTimer"
import { configureTimerClient } from "./timer-store"

export const FLOATING_ROUTE = "/floating-timer"

// The main window owns token refresh; refresh tokens rotate, so a second
// window refreshing would invalidate the main window's session.
configureTimerClient({ allowRefresh: false })

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

/** Follows the theme chosen in the main window (shared localStorage). */
function useSharedTheme() {
  const [theme, setTheme] = useState(() => (localStorage.getItem("theme") === "dark" ? "dark" : "light"))
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "theme") setTheme(event.newValue === "dark" ? "dark" : "light")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
  }, [theme])
}

export default function FloatingApp() {
  useSharedTheme()
  useEffect(() => {
    document.title = "Focus timer"
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <FloatingTimer />
    </QueryClientProvider>
  )
}
