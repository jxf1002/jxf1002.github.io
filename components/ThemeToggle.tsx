"use client"

import { useEffect, useState } from "react"
import type { ThemeMode } from "../lib/theme"
import {
  ICONS,
  LABELS,
  applyTheme,
  currentMode,
  nextMode,
  setTheme,
} from "../lib/theme"

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto")

  useEffect(() => {
    setMode(currentMode())
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    function onChange() {
      if (currentMode() !== "auto") return
      applyTheme("auto")
      window.dispatchEvent(new Event("themechange"))
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const label = "主题：" + LABELS[mode] + "，点击切换"

  function toggle() {
    const next = nextMode()
    setTheme(next)
    setMode(next)
  }

  return (
    <button
      className="theme-toggle"
      data-theme-toggle=""
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {ICONS[mode]}
    </button>
  )
}
