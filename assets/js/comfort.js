document.addEventListener("DOMContentLoaded", function () {
  var LEVELS = [
    { name: "寒冷", color: "#313695" },
    { name: "凉爽", color: "#74ADD1" },
    { name: "舒适", color: "#1A9850" },
    { name: "偏热", color: "#FDAE61" },
    { name: "炎热", color: "#D73027" },
  ]
  var WMO = {
    0: "晴",
    1: "多云",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    56: "冻毛毛雨",
    57: "冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "阵雨",
    82: "暴雨",
    85: "阵雪",
    86: "阵雪",
    95: "雷阵雨",
    96: "雷阵雨伴冰雹",
    99: "雷阵雨伴冰雹",
  }
  var MAP_URLS = [
    "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/china-cities.json",
    "https://unpkg.com/echarts@4.9.0/map/json/china-cities.json",
  ]

  var mapEl = document.querySelector("[data-map]")
  var statusEl = document.querySelector("[data-status]")
  var updatedEl = document.querySelector("[data-updated]")
  var body = document.querySelector("[data-table-body]")
  var queryEl = document.querySelector("[data-query]")
  var levelEl = document.querySelector("[data-level]")
  var refreshEl = document.querySelector("[data-refresh]")
  var paginationEl = document.querySelector("[data-pagination]")

  var store = {} // name -> {name, temp, feels, code, min, max, level}
  var rows = []
  var chart = null
  var listState = { filtered: [], page: 1, pageSize: 20 }
  var CACHE_KEY = "comfort-weather-v1"
  var CACHE_TTL = 3600e3 // 天气每小时刷新一次
  var MAX_ZOOM = 6
  var LABEL_ZOOM = 5.5 // 接近最大倍数时才显示地级市名称
  var mapZoom = 1.25
  var mapCenter = null
  var labelsOn = false
  var retryTimer = null

  function levelOf(feels) {
    if (feels == null || isNaN(feels)) return -1
    if (feels < 0) return 0
    if (feels < 15) return 1
    if (feels < 27) return 2
    if (feels < 32) return 3
    return 4
  }

  function fmt(v) {
    return v == null || isNaN(v) ? "—" : Math.round(v) + "°C"
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY))
      if (c && c.ts && Date.now() - c.ts < CACHE_TTL && c.data) return c
    } catch (e) {}
    return null
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: store }))
    } catch (e) {}
  }

  function stamp(ts) {
    var d = new Date(ts)
    function p(n) { return ("0" + n).slice(-2) }
    return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes())
  }

  function paint(ts) {
    var ok = Object.keys(store).filter(function (k) { return store[k].feels != null }).length
    if (updatedEl) updatedEl.textContent = "已更新 " + ok + " / " + rows.length + " 个地级市 · " + stamp(ts) + "（北京时间，每小时更新）"
    setStatus("")
    renderMap()
    renderTable()
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text
  }

  function isDark() {
    return document.documentElement.classList.contains("dark")
  }

  function isNarrow() {
    return mapEl ? mapEl.clientWidth < 560 : false
  }

  function loadMapJson() {
    return MAP_URLS.reduce(function (p, url) {
      return p.catch(function () {
        return fetch(url).then(function (r) {
          if (!r.ok) throw new Error("map load failed")
          return r.json()
        })
      })
    }, Promise.reject(new Error("no url")))
  }

  function chunk(arr, n) {
    var out = []
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  }

  function fetchWeather(cities) {
    var groups = chunk(cities, 40)
    return Promise.all(
      groups.map(function (g) {
        var lat = g.map(function (c) { return c.lat.toFixed(2) }).join(",")
        var lon = g.map(function (c) { return c.lon.toFixed(2) }).join(",")
        var url =
          "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
          "&longitude=" + lon +
          "&current=temperature_2m,apparent_temperature,weather_code" +
          "&hourly=temperature_2m&timezone=Asia%2FShanghai&forecast_days=2"
        return fetch(url)
          .then(function (r) {
            if (!r.ok) throw new Error("weather failed")
            return r.json()
          })
          .then(function (data) {
            return { cities: g, data: Array.isArray(data) ? data : [data] }
          })
          .catch(function () {
            return { cities: g, data: [] }
          })
      }),
    ).then(function (results) {
      results.forEach(function (res) {
        res.cities.forEach(function (city, i) {
          var w = res.data[i] || {}
          var cur = w.current || {}
          var times = (w.hourly && w.hourly.time) || []
          var temps = (w.hourly && w.hourly.temperature_2m) || []
          var idx = 0
          if (cur.time) {
            var h = String(cur.time).slice(0, 13)
            var found = times.findIndex(function (t) { return String(t).slice(0, 13) === h })
            if (found >= 0) idx = found
          }
          var slice = temps.slice(idx, idx + 24).filter(function (v) { return v != null })
          var min = slice.length ? Math.min.apply(null, slice) : null
          var max = slice.length ? Math.max.apply(null, slice) : null
          var feels = cur.apparent_temperature
          if (feels != null && !isNaN(feels)) feels = Math.round(feels)
          store[city.name] = {
            name: city.name,
            temp: cur.temperature_2m,
            feels: feels,
            code: cur.weather_code,
            min: min,
            max: max,
            level: levelOf(feels),
          }
        })
      })
    })
  }

  function chartOption() {
    var dark = isDark()
    var narrow = isNarrow()
    return {
      tooltip: {
        trigger: "item",
        formatter: function (p) {
          var s = store[p.name]
          if (!s || s.feels == null) return escapeHtml(p.name) + "<br/>暂无数据"
          var lv = LEVELS[s.level]
          return (
            escapeHtml(p.name) + " " + escapeHtml(WMO[s.code] || "—") + "<br/>" +
            "气温 " + fmt(s.temp) + " · 体感 " + fmt(s.feels) + "<br/>" +
            "24小时 " + fmt(s.min) + " ~ " + fmt(s.max) + "<br/>" +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + lv.color + ';margin-right:6px"></span>' +
            escapeHtml(lv.name)
          )
        },
      },
      visualMap: {
        type: "piecewise",
        orient: "horizontal",
        bottom: 0,
        left: "center",
        itemWidth: narrow ? 10 : 20,
        itemHeight: narrow ? 8 : 14,
        itemGap: narrow ? 6 : 10,
        textStyle: { color: dark ? "#f8fafc" : "#19322b", fontSize: narrow ? 10 : 12 },
        pieces: narrow
          ? [
              { lt: 0, label: "寒冷", color: "#313695" },
              { gte: 0, lt: 15, label: "凉爽", color: "#74ADD1" },
              { gte: 15, lt: 27, label: "舒适", color: "#1A9850" },
              { gte: 27, lt: 32, label: "偏热", color: "#FDAE61" },
              { gte: 32, label: "炎热", color: "#D73027" },
            ]
          : [
              { lt: 0, label: "寒冷 <0", color: "#313695" },
              { gte: 0, lt: 15, label: "凉爽 0–15", color: "#74ADD1" },
              { gte: 15, lt: 27, label: "舒适 15–27", color: "#1A9850" },
              { gte: 27, lt: 32, label: "偏热 27–32", color: "#FDAE61" },
              { gte: 32, label: "炎热 >32", color: "#D73027" },
            ],
      },
      series: [
        {
          type: "map",
          map: "china-cities",
          roam: true,
          zoom: mapZoom,
          center: mapCenter,
          scaleLimit: { min: 0.5, max: MAX_ZOOM },
          label: { show: labelsOn, fontSize: 10, color: dark ? "#ffffff" : "#333333", textBorderColor: dark ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.9)", textBorderWidth: 2 },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold", color: dark ? "#ffffff" : "#1a1a1a", textBorderColor: dark ? "rgba(0,0,0,.75)" : "rgba(255,255,255,.95)", textBorderWidth: 3 } },
          itemStyle: { borderColor: dark ? "#10221f" : "#ffffff", borderWidth: 0.6 },
          data: rows.map(function (r) { return { name: r.name, value: (store[r.name] || {}).feels } }),
        },
      ],
      textStyle: { color: dark ? "#f8fafc" : "#19322b" },
    }
  }

  function renderMap() {
    if (!window.echarts || !mapEl) return
    if (!chart) {
      chart = window.echarts.init(mapEl)
      chart.on("georoam", syncLabels)
      chart.on("geoRoam", syncLabels)
    } else {
      snapshotView()
    }
    chart.setOption(chartOption(), true)
  }

  function snapshotView() {
    if (!chart) return
    try {
      var s = chart.getOption().series[0]
      if (s) {
        if (typeof s.zoom === "number") mapZoom = s.zoom
        if (s.center) mapCenter = s.center
      }
    } catch (e) {}
  }

  var labelTimer = null
  function syncLabels() {
    snapshotView()
    if (labelTimer) clearTimeout(labelTimer)
    labelTimer = setTimeout(applyLabels, 200)
  }

  function applyLabels() {
    labelTimer = null
    var on = mapZoom >= LABEL_ZOOM
    if (on !== labelsOn) {
      labelsOn = on
      if (chart) chart.setOption({ series: [{ label: { show: on } }] })
      updateZoomHint()
    }
  }

  function updateZoomHint() {
    var hint = document.querySelector("[data-zoom-hint]")
    if (hint) hint.hidden = labelsOn
  }

  function renderTable() {
    var q = queryEl.value.trim()
    var lv = levelEl.value
    listState.filtered = rows.filter(function (r) {
      var s = store[r.name] || {}
      return (
        (!q || r.name.indexOf(q) >= 0) &&
        (lv === "" || String(s.level) === lv)
      )
    })
    var start = (listState.page - 1) * listState.pageSize
    var visible = listState.filtered.slice(start, start + listState.pageSize)
    body.innerHTML = visible.length
      ? visible.map(function (r) {
          var s = store[r.name] || {}
          var l = s.level >= 0 ? LEVELS[s.level] : null
          return (
            "<tr><td>" + escapeHtml(r.name) + "</td>" +
            "<td>" + escapeHtml(WMO[s.code] || "—") + "</td>" +
            '<td class="desktop-only">' + fmt(s.temp) + "</td>" +
            "<td>" + fmt(s.feels) + "</td>" +
            '<td class="desktop-only">' + fmt(s.min) + " ~ " + fmt(s.max) + "</td>" +
            "<td>" + (l ? '<span class="feels-dot" style="background:' + l.color + '"></span>' + escapeHtml(l.name) : "—") + "</td></tr>"
          )
        }).join("")
      : '<tr><td class="empty" colspan="6">没有匹配的城市</td></tr>'
    if (paginationEl && window.renderPagination) {
      window.renderPagination(listState, paginationEl, renderTable)
    }
  }

  function missingCities() {
    return rows.filter(function (r) {
      var s = store[r.name]
      return !s || s.feels == null
    })
  }

  function replenish() {
    retryTimer = null
    var missing = missingCities()
    if (!missing.length) return
    setStatus("正在补全 " + missing.length + " 个地级市数据…")
    fetchWeather(missing).then(function () {
      writeCache()
      paint(Date.now())
      if (missingCities().length) retryTimer = setTimeout(replenish, 30000)
    })
  }

  function load(force) {
    setStatus(force ? "正在刷新天气…" : "正在加载地图…")
    var citiesPromise = rows.length
      ? Promise.resolve(rows)
      : loadMapJson().then(function (geo) {
          window.echarts.registerMap("china-cities", geo)
          rows = geo.features.map(function (f) {
            return { name: f.properties.name, lon: f.properties.cp[0], lat: f.properties.cp[1] }
          }).sort(function (a, b) {
            return a.name.localeCompare(b.name, "zh-Hans-CN")
          })
          return rows
        })
    citiesPromise
      .then(function (cities) {
        if (!force) {
          var c = readCache()
          if (c) {
            store = c.data
            paint(c.ts)
            if (missingCities().length) replenish()
            return null
          }
        }
        return fetchWeather(cities).then(function () {
          writeCache()
          paint(Date.now())
          replenish()
        })
      })
      .catch(function () {
        setStatus("加载失败，请检查网络后点击“刷新天气”重试")
        body.innerHTML = '<tr><td class="empty" colspan="6">数据加载失败</td></tr>'
      })
  }

  queryEl.addEventListener("input", function () {
    listState.page = 1
    renderTable()
  })
  levelEl.addEventListener("change", function () {
    listState.page = 1
    renderTable()
  })
  refreshEl.addEventListener("click", function () {
    if (retryTimer) clearTimeout(retryTimer)
    load(true)
  })
  var lastNarrow = null
  window.addEventListener("resize", function () {
    if (!chart) return
    chart.resize()
    var narrow = isNarrow()
    if (narrow !== lastNarrow) {
      lastNarrow = narrow
      renderMap()
    }
  })
  window.addEventListener("themechange", renderMap)

  var mapWrap = document.querySelector("[data-map-wrap]")
  var listWrap = document.querySelector("[data-list-wrap]")
  var viewBtns = Array.prototype.slice.call(document.querySelectorAll("[data-view]"))
  var mode = "map"

  function setView(m) {
    mode = m
    if (mapWrap) mapWrap.hidden = m !== "map"
    if (listWrap) listWrap.hidden = m !== "list"
    viewBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === m))
    })
    if (m === "map" && chart) chart.resize()
  }

  viewBtns.forEach(function (b) {
    b.addEventListener("click", function () { setView(b.getAttribute("data-view")) })
  })
  setView(mode)
  updateZoomHint()

  // 地图手势独占：阻止浏览器页面滚动/缩放/双击放大接管触摸事件
  if (mapEl) {
    mapEl.addEventListener("touchmove", function (e) { e.preventDefault() }, { passive: false })
    mapEl.addEventListener("dblclick", function (e) { e.preventDefault() })
  }
  ;["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault() })
  })

  if (!window.echarts) {
    setStatus("地图组件加载失败，请检查网络后刷新页面")
    return
  }
  load(false)
})
