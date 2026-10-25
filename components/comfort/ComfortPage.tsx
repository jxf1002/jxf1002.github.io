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
  RETRY_BASE,
  fetchWeather,
  fmt,
  loadMapJson,
  mergeWeather,
  nextRetryDelay,
  readCache,
  staleCities,
  stamp,
  weatherText,
  writeCache,
} from "../../lib/weather"
import type { EChartsType } from "echarts/core"

const PAGE_SIZE = 20

const isDark = () => document.documentElement.classList.contains("dark")

export default function ComfortPage() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const chart = useRef<EChartsType | null>(null)
  const echartsRef = useRef<typeof import("echarts/core") | null>(null)
  const storeRef = useRef<WeatherStore>({})
  const citiesRef = useRef<City[]>([])
  const mapZoom = useRef(1)
  const mapCenter = useRef<number[] | null>(null)
  const labelsOn = useRef(false)
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelay = useRef(RETRY_BASE)
  const fetchingRef = useRef(false)
  const mountedRef = useRef(false)

  const [cities, setCities] = useState<City[]>([])
  const [store, setStore] = useState<WeatherStore>({})
  const [status, setStatus] = useState("正在加载地图…")
  const [updated, setUpdated] = useState("")
  const [view, setView] = useState("map")
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState("")
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  function chartOption() {
    const dark = isDark()
    return {
      tooltip: {
        trigger: "item",
        // richText 不解析 HTML：城市名来自地图数据，避免拼字符串进 tooltip 的注入面
        renderMode: "richText",
        formatter: (params: { name: string }) => {
          const data = storeRef.current[params.name]
          if (!data || data.feels == null) return params.name + "\n暂无数据"
          const levelInfo = LEVELS[data.level]
          return [
            params.name + " " + weatherText(data.code),
            "气温 " + fmt(data.temp) + " · 体感 " + fmt(data.feels),
            "24小时 " + fmt(data.min) + " ~ " + fmt(data.max),
            levelInfo.name,
            ...(data.ts ? ["更新 " + stamp(data.ts)] : []),
          ].join("\n")
        },
      },
      visualMap: {
        // 图例在页头已有，这里只保留颜色映射
        type: "piecewise",
        show: false,
        pieces: [
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
      const series = (
        chart.current.getOption() as {
          series?: Array<{ zoom?: number; center?: number[] }>
        }
      ).series?.[0]
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

  function mergeStore(entries: WeatherStore, ts: number) {
    storeRef.current = mergeWeather(storeRef.current, entries, ts)
    setStore(storeRef.current)
  }

  function paint() {
    const ready = Object.values(storeRef.current).filter(
      (item) => item.feels != null,
    )
    const latest = ready.reduce((max, item) => Math.max(max, item.ts ?? 0), 0)
    setUpdated(
      "已加载 " +
        ready.length +
        " / " +
        citiesRef.current.length +
        " 个地级市 · 最近更新 " +
        (latest ? stamp(latest) : "—"),
    )
    renderMap()
  }

  function problems() {
    return staleCities(citiesRef.current, storeRef.current, Date.now())
  }

  function cancelRetry() {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = null
  }

  function scheduleRetry(delay: number) {
    cancelRetry()
    if (!mountedRef.current || !problems().length) return
    retryTimer.current = setTimeout(retryProblems, delay)
  }

  // 补全轮：只请求有问题的城市；失败或没进展就按 1→2→4→8… 分钟退避
  async function retryProblems() {
    retryTimer.current = null
    if (!mountedRef.current || fetchingRef.current) return
    const list = problems()
    if (!list.length) return
    const before = list.length
    fetchingRef.current = true
    setStatus("正在更新 " + list.length + " 个城市…")
    try {
      const ts = Date.now()
      const entries = await fetchWeather(list)
      mergeStore(entries, ts)
      writeCache(storeRef.current)
      setFailed(false)
      paint()
      const left = problems().length
      retryDelay.current = nextRetryDelay(retryDelay.current, left < before)
      if (left) {
        setStatus("还有 " + left + " 个城市待更新，稍后自动重试")
        scheduleRetry(retryDelay.current)
      } else {
        setStatus("")
      }
    } catch (e) {
      retryDelay.current = nextRetryDelay(retryDelay.current, false)
      setStatus("暂时无法更新，稍后自动重试")
      scheduleRetry(retryDelay.current)
    } finally {
      fetchingRef.current = false
    }
  }

  // 先渲染缓存；没有缓存或缓存超过 1 小时，才发一次请求拿全部城市
  async function load(force: boolean) {
    if (fetchingRef.current) return
    cancelRetry()
    retryDelay.current = RETRY_BASE
    const cache = readCache()
    setFailed(false)
    setStatus("正在加载地图…")
    if (cache) {
      // 先灌进 state：即使地图加载失败，列表也能显示缓存
      storeRef.current = cache.data
      setStore(cache.data)
    }
    try {
      let cityList = citiesRef.current
      if (!cityList.length) {
        // lib/comfort-chart 里静态按需引入，动态 import 只负责延后加载
        const { echarts } = await import("../../lib/comfort-chart")
        echartsRef.current = echarts
        const geo = await loadMapJson()
        // ChinaGeoJson 只声明了页面用到的字段，实际是标准 GeoJSON
        echarts.registerMap(
          "china-cities",
          geo as unknown as Parameters<typeof echarts.registerMap>[1],
        )
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

      if (cache) paint()

      const stale = problems()
      if (!force && cache && stale.length === 0) {
        setStatus("")
        return
      }

      setStatus(cache ? "正在更新天气…" : "正在加载天气…")
      fetchingRef.current = true
      const ts = Date.now()
      const entries = await fetchWeather(cityList)
      mergeStore(entries, ts)
      writeCache(storeRef.current)
      paint()
      const left = problems().length
      setStatus(left ? "还有 " + left + " 个城市待更新，稍后自动重试" : "")
      if (left) scheduleRetry(retryDelay.current)
    } catch (e) {
      // 请求失败时保留旧缓存，不覆盖任何已有数据
      setFailed(!cache || !citiesRef.current.length)
      setStatus(
        cache
          ? "加载失败，显示缓存数据（" + stamp(cache.ts) + "）"
          : "加载失败，请稍后自动重试",
      )
      if (cache) paint()
      if (problems().length) scheduleRetry(retryDelay.current)
    } finally {
      fetchingRef.current = false
    }
  }


  useEffect(() => {
    mountedRef.current = true
    load(false)
    return () => {
      mountedRef.current = false
      cancelRetry()
      if (labelTimer.current) clearTimeout(labelTimer.current)
      if (chart.current) {
        chart.current.dispose()
        chart.current = null
      }
    }
  }, [])

  // 从列表切回地图时容器刚从 display:none 恢复，必须等布局完成再 resize
  useEffect(() => {
    if (view !== "map") return
    const id = requestAnimationFrame(() => {
      if (!chart.current) return
      chart.current.resize()
      renderMap()
    })
    return () => cancelAnimationFrame(id)
  }, [view])

  // 图表尺寸与配色跟随窗口、主题变化
  useEffect(() => {
    function onResize() {
      if (chart.current) chart.current.resize()
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

  return (
    <Page className="data-page feels-page">
      <PageHeader
        title="全国体感温度"
        description="按地级市划分，颜色表示实时体感温度。"
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
            onClick={() => setView("map")}
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
        <p className="feels-updated">{updated}</p>
        <div hidden={view !== "map"}>
          <div className="feels-map-wrap">
            <div
              className="feels-map"
              ref={mapEl}
              role="img"
              aria-label="全国地级市体感温度地图"
            ></div>
            <p
              className={
                "feels-status" +
                (status.startsWith("正在") ? " is-loading" : "")
              }
            >
              {status}
            </p>
          </div>
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
          </div>
          <p className="feels-list-status">{status}</p>
          <Table containerClassName="table-wrap">
            <TableHeader>
              <TableRow>
                <TableHead>地级市</TableHead>
                <TableHead>天气</TableHead>
                <TableHead className="desktop-only">气温</TableHead>
                <TableHead>体感</TableHead>
                <TableHead className="desktop-only">24小时范围</TableHead>
                <TableHead>舒适度</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-table-body>
              {failed ? (
                <TableRow>
                  <TableCell className="empty" colSpan={7}>
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
                      <TableCell className="feels-time">
                        {data.ts ? stamp(data.ts) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell className="empty" colSpan={7}>
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
          天气数据来自{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          ，仅供参考。
        </p>
      </section>
    </Page>
  )
}
