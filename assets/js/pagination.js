;(function () {
  "use strict"

  window.renderPagination = function (state, pagination, render) {
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
})()
