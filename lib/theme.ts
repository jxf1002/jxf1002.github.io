// 主题逻辑。localStorage 键名、dark class、themechange 事件都与旧 common.js 一致，
// 因为 dcf/comfort 的图表和麻将、mir2 都依赖这套约定。
export const MODES = ["auto", "light", "dark"] as const

export type ThemeMode = (typeof MODES)[number]

export const ICONS: Record<ThemeMode, string> = {
  auto: "◐",
  light: "☀",
  dark: "☾",
}
export const LABELS: Record<ThemeMode, string> = {
  auto: "跟随系统",
  light: "白天",
  dark: "黑夜",
}

export function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

// auto 不落盘（没有 theme 键即跟随系统）
export function currentMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "auto"
  const stored = localStorage.getItem("theme")
  return stored === "light" || stored === "dark" ? stored : "auto"
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle(
    "dark",
    mode === "dark" || (mode === "auto" && prefersDark()),
  )
}

export function nextMode(): ThemeMode {
  return MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length]
}

export function setTheme(mode: ThemeMode): void {
  localStorage.removeItem("theme")
  if (mode !== "auto") localStorage.setItem("theme", mode)
  applyTheme(mode)
  window.dispatchEvent(new Event("themechange"))
}
