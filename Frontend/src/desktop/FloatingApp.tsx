import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FloatingTimer } from "./FloatingTimer"
import { configureTimerClient } from "./timer-store"
import { useSharedTheme } from "./use-shared-theme"

export const FLOATING_ROUTE = "/floating-timer"

// The main window owns token refresh; refresh tokens rotate, so a second
// window refreshing would invalidate the main window's session.
configureTimerClient({ allowRefresh: false })

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

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
