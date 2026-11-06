import { useEffect, useState } from "react"

/** Follows the theme chosen in the main window (shared localStorage). */
export function useSharedTheme() {
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
