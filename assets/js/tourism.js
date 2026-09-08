document.addEventListener("DOMContentLoaded", function () {
  var state = {
    rows: [],
    filtered: [],
    page: 1,
    pageSize: 10,
    query: "",
    province: "全部",
  }
  var body = document.querySelector("[data-table-body]")
  var query = document.querySelector("[data-query]")
  var province = document.querySelector("[data-province]")
  var pagination = document.querySelector("[data-pagination]")

  fetch("/assets/data/tourism.json")
    .then(function (response) {
      return response.json()
    })
    .then(function (rows) {
      state.rows = rows
      Array.from(
        new Set(
          rows.map(function (row) {
            return row.provinceName
          }),
        ),
      )
        .sort()
        .forEach(function (name) {
          province.insertAdjacentHTML(
            "beforeend",
            '<option value="' + name + '">' + name + "</option>",
          )
        })
      render()
    })
    .catch(function () {
      body.innerHTML =
        '<tr><td class="empty" colspan="4">数据加载失败</td></tr>'
    })

  query.addEventListener("input", function () {
    state.query = query.value.trim()
    state.page = 1
    render()
  })
  province.addEventListener("change", function () {
    state.province = province.value
    state.page = 1
    render()
  })

  function render() {
    state.filtered = state.rows.filter(function (row) {
      return (
        row.name.includes(state.query) &&
        (state.province === "全部" || row.provinceName === state.province)
      )
    })
    var start = (state.page - 1) * state.pageSize
    var visible = state.filtered.slice(start, start + state.pageSize)
    body.innerHTML = visible.length
      ? visible
          .map(function (row) {
            return (
              "<tr><td>" +
              row.name +
              "</td><td>" +
              row.provinceName +
              '</td><td class="desktop-only">' +
              row.gradesName +
              '</td><td class="desktop-only">' +
              row.year +
              "</td></tr>"
            )
          })
          .join("")
      : '<tr><td class="empty" colspan="4">没有匹配的数据</td></tr>'
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
