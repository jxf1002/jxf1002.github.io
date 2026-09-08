;(function () {
  var root = document.documentElement
  var stored = localStorage.getItem("theme")
  if (
    stored === "dark" ||
    (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    root.classList.add("dark")
  }

  window.toggleTheme = function () {
    var dark = root.classList.toggle("dark")
    localStorage.setItem("theme", dark ? "dark" : "light")
    updateThemeButton()
  }

  function updateThemeButton() {
    var button = document.querySelector("[data-theme-toggle]")
    if (button) {
      var dark = root.classList.contains("dark")
      button.textContent = dark ? "☀" : "☾"
      button.setAttribute(
        "aria-label",
        dark ? "切换到浅色模式" : "切换到深色模式",
      )
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateThemeButton()
    document.querySelectorAll("[data-year]").forEach(function (element) {
      element.textContent = new Date().getFullYear()
    })
  })
})()
