document.addEventListener("DOMContentLoaded", function () {
  var year = document.body.dataset.rankingYear
  var state = {
    rows: [],
    filtered: [],
    page: 1,
    pageSize: 10,
    query: "",
    sortKey: "",
    direction: "asc",
  }
  var body = document.querySelector("[data-table-body]")
  var query = document.querySelector("[data-query]")
  var pagination = document.querySelector("[data-pagination]")
  var source =
    year === "2023"
      ? "/assets/data/colleges2023.json"
      : "/assets/data/colleges2024.json"

  fetch(source)
    .then(function (response) {
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
        return (
          (a[state.sortKey] - b[state.sortKey]) *
          (state.direction === "asc" ? 1 : -1)
        )
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
              row.chinaxy +
              '</td><td class="desktop-only">' +
              row.ranking +
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
