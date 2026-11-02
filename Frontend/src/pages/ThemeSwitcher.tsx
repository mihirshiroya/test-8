import { PullCord } from "pullcord"
import "pullcord/pullcord.css"

import { useTheme } from "../context/ThemeContext"
import { useEffect } from "react"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const isDark = theme === "dark"

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark"

    if (!document.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    document.startViewTransition(() => {
      setTheme(nextTheme)
    })
  }

  return (
    <PullCord
      onPull={toggleTheme}
      pulled={!isDark}
      ariaLabel={`Switch to ${isDark ? "light" : "dark"} theme`}
    />
  )
}

export default ThemeSwitcher