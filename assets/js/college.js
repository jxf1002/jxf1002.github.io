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
    province: params.get("province") || "",
    sortKey: "",
    direction: "asc",
    provinceStatsSortKey: "",
    provinceStatsDirection: "asc",
  }
  var body = document.querySelector("[data-table-body]")
  var query = document.querySelector("[data-query]")
  var province = document.querySelector("[data-province]")
  var provinceClear = document.querySelector("[data-province-clear]")
  var provinceStatsButton = document.querySelector("[data-province-stats]")
  var provinceDialog = document.querySelector("[data-province-dialog]")
  var provinceDialogClose = document.querySelector(
    "[data-province-dialog-close]",
  )
  var provinceSortButton = document.querySelector("[data-province-sort]")
  var provinceDefaultSortButton = document.querySelector(
    "[data-province-default-sort]",
  )
  var provinceStatsBody = document.querySelector("[data-province-stats-body]")
  var pagination = document.querySelector("[data-pagination]")
  var pageSizeSelect = document.querySelector("[data-page-size]")
  var source = "/assets/data/colleges" + year + ".json"
  var provinceNames = {
    京: "北京市",
    津: "天津市",
    沪: "上海市",
    渝: "重庆市",
    冀: "河北省",
    晋: "山西省",
    辽: "辽宁省",
    吉: "吉林省",
    黑: "黑龙江省",
    苏: "江苏省",
    浙: "浙江省",
    皖: "安徽省",
    闽: "福建省",
    赣: "江西省",
    鲁: "山东省",
    豫: "河南省",
    鄂: "湖北省",
    湘: "湖南省",
    粤: "广东省",
    桂: "广西壮族自治区",
    琼: "海南省",
    川: "四川省",
    贵: "贵州省",
    云: "云南省",
    藏: "西藏自治区",
    陕: "陕西省",
    甘: "甘肃省",
    青: "青海省",
    宁: "宁夏回族自治区",
    新: "新疆维吾尔自治区",
    蒙: "内蒙古自治区",
    港: "香港特别行政区",
    澳: "澳门特别行政区",
    台: "台湾省",
  }

  function provinceLabel(abbr) {
    return (provinceNames[abbr] || abbr) + "（" + abbr + "）"
  }

  query.value = state.query
  province.value = state.province
  pageSizeSelect.value = String(state.pageSize)

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
      if (state.province) target.searchParams.set("province", state.province)
      else target.searchParams.delete("province")
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
      var provinces = Array.from(
        new Set(
          rows
            .map(function (row) {
              return row.province_abbr
            })
            .filter(Boolean),
        ),
      ).sort(function (a, b) {
        return a.localeCompare(b, "zh-CN")
      })
      province.innerHTML = provinces.length
        ? '<option value="">全部省份</option>' +
          provinces
            .map(function (item) {
              return (
                '<option value="' +
                item +
                '">' +
                provinceLabel(item) +
                "</option>"
              )
            })
            .join("")
        : '<option value="">暂无省份数据</option>'
      province.disabled = !provinces.length
      if (!provinces.includes(state.province)) state.province = ""
      province.value = state.province
      updateProvinceClear()
      renderProvinceStats()
      render()
    })
    .catch(function () {
      body.innerHTML =
        '<tr><td class="empty" colspan="7">数据加载失败</td></tr>'
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
  province.addEventListener("change", function () {
    state.province = province.value
    state.page = 1
    var currentUrl = new URL(window.location.href)
    if (state.province) currentUrl.searchParams.set("province", state.province)
    else currentUrl.searchParams.delete("province")
    window.history.replaceState(null, "", currentUrl)
    updateProvinceClear()
    render()
  })
  provinceClear.addEventListener("click", function () {
    province.value = ""
    province.dispatchEvent(new Event("change"))
  })
  provinceStatsButton.addEventListener("click", function () {
    provinceDialog.showModal()
  })
  provinceDialogClose.addEventListener("click", function () {
    provinceDialog.close()
  })
  provinceSortButton.addEventListener("click", function () {
    state.provinceStatsSortKey = "count"
    state.provinceStatsDirection =
      state.provinceStatsDirection === "asc" ? "desc" : "asc"
    renderProvinceStats()
  })
  provinceDefaultSortButton.addEventListener("click", function () {
    state.provinceStatsSortKey = ""
    renderProvinceStats()
  })
  provinceDialog.addEventListener("click", function (event) {
    if (event.target === provinceDialog) provinceDialog.close()
  })
  pageSizeSelect.addEventListener("change", function () {
    state.pageSize = Number(pageSizeSelect.value)
    state.page = 1
    render()
  })
  document.querySelectorAll("[data-sort]").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.dataset.sort
      if (key === "default") {
        state.sortKey = ""
        state.direction = "asc"
        state.page = 1
        render()
        return
      }
      state.direction =
        state.sortKey === key && state.direction === "asc" ? "desc" : "asc"
      state.sortKey = key
      render()
    })
  })

  function render() {
    state.filtered = state.rows.filter(function (row) {
      return (
        row.name.includes(state.query) &&
        (!state.province || row.province_abbr === state.province)
      )
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
            var rank = state.rows.reduce(function (bestRank, candidate) {
              return candidate.avg === row.avg
                ? Math.min(bestRank, candidate.id)
                : bestRank
            }, row.id)
            var provinceRank =
              1 +
              state.rows.filter(function (candidate) {
                return (
                  row.province_abbr &&
                  candidate.province_abbr === row.province_abbr &&
                  candidate.id < row.id
                )
              }).length
            return (
              "<tr><td>" +
              rank +
              "</td><td>" +
              (row.province_abbr
                ? row.province_abbr + " " + provinceRank
                : "-") +
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
      : '<tr><td class="empty" colspan="7">没有匹配的数据</td></tr>'
    renderPagination()
  }

  function updateProvinceClear() {
    provinceClear.hidden = !state.province
  }

  function renderProvinceStats() {
    var groups = {}
    state.rows.forEach(function (row) {
      if (!row.province_abbr) return
      if (!groups[row.province_abbr]) groups[row.province_abbr] = []
      groups[row.province_abbr].push(row)
    })
    var stats = Object.keys(groups).map(function (provinceAbbr) {
      var rows = groups[provinceAbbr]
      var total = rows.reduce(function (sum, row) {
        return sum + row.avg
      }, 0)
      return {
        province: provinceAbbr,
        count: rows.length,
        average: total / rows.length,
      }
    })
    stats
      .slice()
      .sort(function (a, b) {
        return (
          a.average - b.average || a.province.localeCompare(b.province, "zh-CN")
        )
      })
      .forEach(function (item, index) {
        item.rank = index + 1
      })
    stats.sort(function (a, b) {
      if (state.provinceStatsSortKey !== "count") {
        return (
          a.average - b.average || a.province.localeCompare(b.province, "zh-CN")
        )
      }
      var countDifference =
        (a.count - b.count) * (state.provinceStatsDirection === "asc" ? 1 : -1)
      return (
        countDifference ||
        a.average - b.average ||
        a.province.localeCompare(b.province, "zh-CN")
      )
    })
    if (!stats.length) {
      provinceStatsBody.innerHTML =
        '<tr><td class="empty" colspan="4">暂无省份数据</td></tr>'
      provinceStatsButton.disabled = true
      return
    }
    provinceStatsButton.disabled = false
    provinceStatsBody.innerHTML = stats
      .map(function (item, index) {
        return (
          '<tr class="province-stat-row" data-province-stat="' +
          item.province +
          '" tabindex="0">' +
          "<td>" +
          item.rank +
          "</td><td>" +
          provinceLabel(item.province) +
          "</td><td>" +
          item.count +
          "</td><td>" +
          item.average.toFixed(2) +
          "</td></tr>"
        )
      })
      .join("")
    provinceStatsBody
      .querySelectorAll("[data-province-stat]")
      .forEach(function (row) {
        function selectProvince() {
          state.province = row.dataset.provinceStat
          province.value = state.province
          state.page = 1
          var currentUrl = new URL(window.location.href)
          currentUrl.searchParams.set("province", state.province)
          window.history.replaceState(null, "", currentUrl)
          provinceDialog.close()
          render()
        }
        row.addEventListener("click", selectProvince)
        row.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            selectProvince()
          }
        })
      })
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
