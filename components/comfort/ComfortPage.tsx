"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Pagination from "../Pagination"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import { Button } from "../ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { paginate } from "../../lib/list"
import type { City, WeatherStore } from "../../lib/weather"
import {
  LABEL_ZOOM,
  LEVELS,
  MAX_ZOOM,
  fetchWeather,
  fmt,
  loadMapJson,
  readCache,
  stamp,
  weatherText,
  writeCache,
} from "../../lib/weather"
import type { EChartsInstance } from "echarts"

const PAGE_SIZE = 20

const isDark = () => document.documentElement.classList.contains("dark")

export default function ComfortPage() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const chart = useRef<EChartsInstance | null>(null)
  const echartsRef = useRef<typeof import("echarts") | null>(null)
  const storeRef = useRef<WeatherStore>({})
  const citiesRef = useRef<City[]>([])
  const mapZoom = useRef(1.25)
  const mapCenter = useRef<number[] | null>(null)
  const labelsOn = useRef(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cities, setCities] = useState<City[]>([])
  const [store, setStore] = useState<WeatherStore>({})
  const [status, setStatus] = useState("正在加载地图…")
  const [updated, setUpdated] = useState("正在加载天气…")
  const [view, setView] = useState("map")
  const [labels, setLabels] = useState(false)
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState("")
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  function isNarrow(): boolean {
    return mapEl.current ? mapEl.current.clientWidth < 560 : false
  }

  function chartOption() {
    const dark = isDark()
    const narrow = isNarrow()
    return {
      tooltip: {
        trigger: "item",
        formatter: (params: { name: string }) => {
          const data = storeRef.current[params.name]
          if (!data || data.feels == null) return params.name + "<br/>暂无数据"
          const levelInfo = LEVELS[data.level]
          return (
            params.name +
            " " +
            weatherText(data.code) +
            "<br/>" +
            "气温 " +
            fmt(data.temp) +
            " · 体感 " +
            fmt(data.feels) +
            "<br/>" +
            "24小时 " +
            fmt(data.min) +
            " ~ " +
            fmt(data.max) +
            "<br/>" +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
            levelInfo.color +
            ';margin-right:6px"></span>' +
            levelInfo.name
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
        textStyle: {
          color: dark ? "#f8fafc" : "#19322b",
          fontSize: narrow ? 10 : 12,
        },
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
          zoom: mapZoom.current,
          center: mapCenter.current,
          scaleLimit: { min: 0.5, max: MAX_ZOOM },
          label: {
            show: labelsOn.current,
            fontSize: 10,
            color: dark ? "#ffffff" : "#333333",
            textBorderColor: dark ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.9)",
            textBorderWidth: 2,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: "bold",
              color: dark ? "#ffffff" : "#1a1a1a",
              textBorderColor: dark
                ? "rgba(0,0,0,.75)"
                : "rgba(255,255,255,.95)",
              textBorderWidth: 3,
            },
          },
          itemStyle: {
            borderColor: dark ? "#10221f" : "#ffffff",
            borderWidth: 0.6,
          },
          data: citiesRef.current.map((city) => ({
            name: city.name,
            value: (storeRef.current[city.name] || {}).feels,
          })),
        },
      ],
      textStyle: { color: dark ? "#f8fafc" : "#19322b" },
    }
  }

  function snapshotView() {
    if (!chart.current) return
    try {
      const series = chart.current.getOption().series[0]
      if (series) {
        if (typeof series.zoom === "number") mapZoom.current = series.zoom
        if (series.center) mapCenter.current = series.center
      }
    } catch (e) {
      // 图表未就绪时忽略
    }
  }

  function applyLabels() {
    labelTimer.current = null
    const on = mapZoom.current >= LABEL_ZOOM
    if (on !== labelsOn.current) {
      labelsOn.current = on
      setLabels(on)
      if (chart.current) {
        chart.current.setOption({ series: [{ label: { show: on } }] })
      }
    }
  }

  function syncLabels() {
    snapshotView()
    if (labelTimer.current) clearTimeout(labelTimer.current)
    labelTimer.current = setTimeout(applyLabels, 200)
  }

  function renderMap() {
    const echarts = echartsRef.current
    if (!echarts || !mapEl.current) return
    if (!chart.current) {
      chart.current = echarts.init(mapEl.current)
      chart.current.on("georoam", syncLabels)
      chart.current.on("geoRoam", syncLabels)
    } else {
      snapshotView()
    }
    chart.current.setOption(chartOption(), true)
  }

  function mergeStore(entries: WeatherStore) {
    storeRef.current = { ...storeRef.current, ...entries }
    setStore(storeRef.current)
  }

  function missingCities() {
    return citiesRef.current.filter((city) => {
      const data = storeRef.current[city.name]
      return !data || data.feels == null
    })
  }

  function paint(ts: number, cityList?: City[]) {
    const total = cityList || citiesRef.current
    const ready = Object.keys(storeRef.current).filter(
      (name) => storeRef.current[name].feels != null,
    ).length
    setUpdated(
      "已更新 " +
        ready +
        " / " +
        total.length +
        " 个地级市 · " +
        stamp(ts) +
        "（北京时间，每小时更新）",
    )
    setStatus("")
    renderMap()
  }

  async function replenish() {
    retryTimer.current = null
    const missing = missingCities()
    if (!missing.length) return
    setStatus("正在补全 " + missing.length + " 个地级市数据…")
    const entries = await fetchWeather(missing)
    mergeStore(entries)
    writeCache(storeRef.current)
    paint(Date.now())
    if (missingCities().length) {
      retryTimer.current = setTimeout(replenish, 30000)
    }
  }

  async function load(force: boolean) {
    setStatus(force ? "正在刷新天气…" : "正在加载地图…")
    setFailed(false)
    try {
      let cityList = citiesRef.current
      if (!cityList.length) {
        // echarts 4 在模块求值时就访问 document，只能在浏览器里动态加载
        const mod = await import("echarts")
        // CJS 包，按打包器互操作可能落在 default 上
        const echarts = "init" in mod ? mod : (mod as { default: typeof mod }).default
        echartsRef.current = echarts
        const geo = await loadMapJson()
        echarts.registerMap("china-cities", geo)
        cityList = geo.features
          .map((feature) => ({
            name: feature.properties.name,
            lon: feature.properties.cp[0],
            lat: feature.properties.cp[1],
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
        citiesRef.current = cityList
        setCities(cityList)
      }

      if (!force) {
        const cache = readCache()
        if (cache) {
          storeRef.current = cache.data
          setStore(cache.data)
          paint(cache.ts, cityList)
          if (missingCities().length) replenish()
          return
        }
      }

      const entries = await fetchWeather(cityList)
      mergeStore(entries)
      writeCache(storeRef.current)
      paint(Date.now(), cityList)
      replenish()
    } catch (e) {
      setStatus("加载失败，请检查网络后点击“刷新天气”重试")
      setFailed(true)
    }
  }

  useEffect(() => {
    load(false)
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (labelTimer.current) clearTimeout(labelTimer.current)
      if (chart.current) {
        chart.current.dispose()
        chart.current = null
      }
    }
  }, [])

  // 图表尺寸与配色跟随窗口、主题变化
  useEffect(() => {
    let lastNarrow: boolean | null = null
    function onResize() {
      if (!chart.current) return
      chart.current.resize()
      const narrow = isNarrow()
      if (narrow !== lastNarrow) {
        lastNarrow = narrow
        renderMap()
      }
    }
    function onThemeChange() {
      renderMap()
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("themechange", onThemeChange)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("themechange", onThemeChange)
    }
  }, [])

  // 地图手势独占：阻止浏览器页面滚动/缩放/双击放大接管触摸事件
  useEffect(() => {
    const element = mapEl.current
    const prevent = (event: Event) => event.preventDefault()
    if (element) {
      element.addEventListener("touchmove", prevent, { passive: false })
      element.addEventListener("dblclick", prevent)
    }
    const gestureTypes = ["gesturestart", "gesturechange", "gestureend"]
    gestureTypes.forEach((type) => document.addEventListener(type, prevent))
    return () => {
      if (element) {
        element.removeEventListener("touchmove", prevent)
        element.removeEventListener("dblclick", prevent)
      }
      gestureTypes.forEach((type) =>
        document.removeEventListener(type, prevent),
      )
    }
  }, [])

  const filtered = useMemo(() => {
    return cities.filter((city) => {
      const data = store[city.name] || {}
      return (
        (!query || city.name.indexOf(query) >= 0) &&
        (level === "" || String(data.level) === level)
      )
    })
  }, [cities, store, query, level])

  const result = paginate(filtered, page, PAGE_SIZE)

  async function refresh() {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    await load(true)
  }

  return (
    <Page className="data-page feels-page">
      <PageHeader
        title="全国体感温度"
        description={`按地级市划分 · 更新时间 ${updated}`}
      >
        <div className="feels-legend" aria-label="体感温度图例">
          <span>
            <i style={{ background: "#313695" }}></i>寒冷 &lt;0°C
          </span>
          <span>
            <i style={{ background: "#74ADD1" }}></i>凉爽 0–15°C
          </span>
          <span>
            <i style={{ background: "#1A9850" }}></i>舒适 15–27°C
          </span>
          <span>
            <i style={{ background: "#FDAE61" }}></i>偏热 27–32°C
          </span>
          <span>
            <i style={{ background: "#D73027" }}></i>炎热 &gt;32°C
          </span>
        </div>
      </PageHeader>
      <section className="data-panel">
        <div className="view-switch" role="group" aria-label="视图切换">
          <Button
            className="button"
            type="button"
            aria-pressed={view === "map"}
            onClick={() => {
              setView("map")
              if (chart.current) chart.current.resize()
            }}
          >
            地图
          </Button>
          <Button
            className="button"
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            列表
          </Button>
        </div>
        <div hidden={view !== "map"}>
          <div className="feels-map-wrap">
            <div
              className="feels-map"
              ref={mapEl}
              role="img"
              aria-label="全国地级市体感温度地图"
            ></div>
            <p className="feels-status">{status}</p>
          </div>
          <p className="zoom-hint" hidden={labels}>
            缩放到最大可显示地级市名称
          </p>
        </div>
        <div hidden={view !== "list"}>
          <div className="filters">
            <input
              className="control"
              data-query
              type="search"
              placeholder="搜索地级市，如：杭州"
              value={query}
              onChange={(event) => {
                setPage(1)
                setQuery(event.target.value.trim())
              }}
            />
            <select
              className="control"
              data-level
              aria-label="按舒适度筛选"
              value={level}
              onChange={(event) => {
                setPage(1)
                setLevel(event.target.value)
              }}
            >
              <option value="">全部舒适度</option>
              {LEVELS.map((item, index) => (
                <option value={String(index)} key={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button className="button" type="button" onClick={refresh}>
              刷新天气
            </Button>
          </div>
          <Table containerClassName="table-wrap">
            <TableHeader>
              <TableRow>
                <TableHead>地级市</TableHead>
                <TableHead>天气</TableHead>
                <TableHead className="desktop-only">气温</TableHead>
                <TableHead>体感</TableHead>
                <TableHead className="desktop-only">24小时范围</TableHead>
                <TableHead>舒适度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-table-body>
              {failed ? (
                <TableRow>
                  <TableCell className="empty" colSpan={6}>
                    数据加载失败
                  </TableCell>
                </TableRow>
              ) : result.items.length ? (
                result.items.map((city) => {
                  const data = store[city.name] || {}
                  const levelInfo =
                    data.level >= 0 ? LEVELS[data.level] : null
                  return (
                    <TableRow key={city.name}>
                      <TableCell>{city.name}</TableCell>
                      <TableCell>{weatherText(data.code)}</TableCell>
                      <TableCell className="desktop-only">
                        {fmt(data.temp)}
                      </TableCell>
                      <TableCell>{fmt(data.feels)}</TableCell>
                      <TableCell className="desktop-only">
                        {fmt(data.min)} ~ {fmt(data.max)}
                      </TableCell>
                      <TableCell>
                        {levelInfo ? (
                          <>
                            <span
                              className="feels-dot"
                              style={{ background: levelInfo.color }}
                            ></span>
                            {levelInfo.name}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell className="empty" colSpan={6}>
                    {cities.length ? "没有匹配的城市" : "正在加载..."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            onChange={setPage}
          />
        </div>
        <p className="feels-note">
          体感温度按整数取整后着色：寒冷 &lt;0°C · 凉爽 0–15°C · 舒适 15–27°C ·
          偏热 27–32°C · 炎热 &gt;32°C。天气数据来自 Open-Meteo（无需
          Key，纯浏览器端请求），每小时更新一次；若存在暂无数据的地级市，每 30
          秒自动补全，直到全部获取。坐标取自地图中心点。
        </p>
      </section>
    </Page>
  )
}
