document.addEventListener("DOMContentLoaded", function () {
  var availableYears = ["2023", "2024", "2025", "2026"]
  var params = new URLSearchParams(window.location.search)
  var requestedYear = params.get("year") || document.body.dataset.rankingYear
  var year = availableYears.includes(requestedYear) ? requestedYear : "2026"
  var state = {
    rows: [],
    filtered: [],
    page: 1,
    pageSize: 10,
    query: params.get("q") || "",
    sortKey: "",
    direction: "asc",
  }
  var body = document.querySelector("[data-table-body]")
  var query = document.querySelector("[data-query]")
  var pagination = document.querySelector("[data-pagination]")
  var source = "/assets/data/colleges" + year + ".json"

  query.value = state.query

  document.title = "大学排行榜" + year + "-数据-贾师傅的小站"
  document.querySelector("[data-ranking-description]").textContent =
    "（基于" + year + "年数据制作，使用3个排行榜平均值排名）"
  document.querySelectorAll("[data-year-links] a").forEach(function (link) {
    if (new URL(link.href).searchParams.get("year") === year)
      link.setAttribute("aria-current", "page")
    link.addEventListener("click", function () {
      var target = new URL(link.href)
      var search = query.value.trim()
      if (search) target.searchParams.set("q", search)
      else target.searchParams.delete("q")
      link.href = target.href
    })
  })

  fetch(source)
    .then(function (response) {
      if (!response.ok) throw new Error("数据加载失败")
      return response.json()
    })
    .then(function (rows) {
      state.rows = rows
      render()
    })
    .catch(function () {
      body.innerHTML =
        '<tr><td class="empty" colspan="6">数据加载失败</td></tr>'
    })
  query.addEventListener("input", function () {
    state.query = query.value.trim()
    state.page = 1
    var currentUrl = new URL(window.location.href)
    if (state.query) currentUrl.searchParams.set("q", state.query)
    else currentUrl.searchParams.delete("q")
    window.history.replaceState(null, "", currentUrl)
    render()
  })
  document.querySelectorAll("[data-sort]").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.dataset.sort
      state.direction =
        state.sortKey === key && state.direction === "asc" ? "desc" : "asc"
      state.sortKey = key
      render()
    })
  })

  function render() {
    state.filtered = state.rows.filter(function (row) {
      return row.name.includes(state.query)
    })
    if (state.sortKey)
      state.filtered.sort(function (a, b) {
        var aValue = a[state.sortKey]
        var bValue = b[state.sortKey]
        if (aValue == null) return 1
        if (bValue == null) return -1
        return (aValue - bValue) * (state.direction === "asc" ? 1 : -1)
      })
    var start = (state.page - 1) * state.pageSize
    var visible = state.filtered.slice(start, start + state.pageSize)
    body.innerHTML = visible.length
      ? visible
          .map(function (row) {
            return (
              "<tr><td>" +
              row.id +
              "</td><td>" +
              row.name +
              '</td><td class="desktop-only">' +
              (row.chinaxy == null ? "-" : row.chinaxy) +
              '</td><td class="desktop-only">' +
              (row.ranking == null ? "-" : row.ranking) +
              '</td><td class="desktop-only">' +
              (row.wurank == null ? "-" : row.wurank) +
              "</td><td>" +
              row.avg +
              "</td></tr>"
            )
          })
          .join("")
      : '<tr><td class="empty" colspan="6">没有匹配的数据</td></tr>'
    renderPagination()
  }

  function renderPagination() {
    var totalPages = Math.max(
      1,
      Math.ceil(state.filtered.length / state.pageSize),
    )
    if (state.page > totalPages) state.page = totalPages
    pagination.innerHTML =
      "<button data-prev " +
      (state.page === 1 ? "disabled" : "") +
      ">上一页</button><span>第 " +
      state.page +
      " / " +
      totalPages +
      " 页，共 " +
      state.filtered.length +
      " 条</span><button data-next " +
      (state.page === totalPages ? "disabled" : "") +
      ">下一页</button>"
    pagination
      .querySelector("[data-prev]")
      .addEventListener("click", function () {
        state.page--
        render()
      })
    pagination
      .querySelector("[data-next]")
      .addEventListener("click", function () {
        state.page++
        render()
      })
  }
})
