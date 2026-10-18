;(function () {
  window.escapeHtml = function (str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]
    })
  }

  var root = document.documentElement
  var media = window.matchMedia("(prefers-color-scheme: dark)")
  var MODES = ["auto", "light", "dark"]
  var ICONS = { auto: "◐", light: "☀", dark: "☾" }
  var LABELS = { auto: "跟随系统", light: "白天", dark: "黑夜" }

  function mode() {
    var stored = localStorage.getItem("theme")
    return stored === "light" || stored === "dark" ? stored : "auto"
  }

  function apply() {
    var current = mode()
    root.classList.toggle(
      "dark",
      current === "dark" || (current === "auto" && media.matches),
    )
  }

  apply()

  // auto 不落盘（没有 theme 键即跟随系统）
  window.toggleTheme = function () {
    var next = MODES[(MODES.indexOf(mode()) + 1) % MODES.length]
    localStorage.removeItem("theme")
    if (next !== "auto") {
      localStorage.setItem("theme", next)
    }
    apply()
    updateThemeButton()
    window.dispatchEvent(new Event("themechange"))
  }

  function updateThemeButton() {
    var button = document.querySelector("[data-theme-toggle]")
    if (button) {
      var label = "主题：" + LABELS[mode()] + "，点击切换"
      button.textContent = ICONS[mode()]
      button.setAttribute("aria-label", label)
      button.setAttribute("title", label)
    }
  }

  media.addEventListener("change", function () {
    if (mode() !== "auto") return
    apply()
    window.dispatchEvent(new Event("themechange"))
  })

  document.addEventListener("DOMContentLoaded", function () {
    updateThemeButton()
    document.querySelectorAll("[data-year]").forEach(function (element) {
      element.textContent = new Date().getFullYear()
    })
  })
})()
