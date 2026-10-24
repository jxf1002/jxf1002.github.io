"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Pagination from "../Pagination"
import type { CollegeRow, CollegeYear } from "../../lib/college"
import {
  AVAILABLE_YEARS,
  DEFAULT_YEAR,
  isCollegeYear,
  provinceLabel,
  provinceOptions,
  provinceRanks,
  provinceStats,
  rankByAverage,
} from "../../lib/college"
import type { SortDirection } from "../../lib/list"
import { paginate, sortRows } from "../../lib/list"

type SortKey = "" | "chinaxy" | "ranking" | "wurank"

type CollegeState = {
  year: CollegeYear
  query: string
  province: string
  page: number
  pageSize: number
  sortKey: SortKey
  direction: SortDirection
  statsSortKey: "" | "count"
  statsDirection: SortDirection
}

function readParams(): { year: CollegeYear; query: string; province: string } {
  const params = new URLSearchParams(window.location.search)
  const requested = params.get("year")
  return {
    year: isCollegeYear(requested) ? requested : DEFAULT_YEAR,
    query: params.get("q") || "",
    province: params.get("province") || "",
  }
}

export default function CollegePage() {
  const dialog = useRef<HTMLDialogElement | null>(null)
  const [state, setState] = useState<CollegeState>({
    year: DEFAULT_YEAR,
    query: "",
    province: "",
    page: 1,
    pageSize: 10,
    sortKey: "",
    direction: "asc",
    statsSortKey: "",
    statsDirection: "asc",
  })
  const [rows, setRows] = useState<CollegeRow[]>([])
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  // 查询参数在挂载后读取，避免静态 HTML 与首屏渲染不一致
  useEffect(() => {
    const params = readParams()
    setState((prev) => ({
      ...prev,
      year: params.year,
      query: params.query,
      province: params.province,
    }))
  }, [])

  useEffect(() => {
    document.title = "大学排行榜" + state.year + "-数据-贾师傅的小站"
  }, [state.year])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/data/college/colleges" + state.year + ".json")
      .then((response) => {
        if (!response.ok) throw new Error("数据加载失败")
        return response.json()
      })
      .then((data: CollegeRow[]) => {
        if (cancelled) return
        setRows(data)
        setFailed(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state.year])

  function patch(next: Partial<CollegeState>, { keepPage = true } = {}) {
    setState((prev) => ({
      ...prev,
      ...next,
      ...(keepPage ? {} : { page: 1 }),
    }))
  }

  function replaceParams(changes: Record<string, string>) {
    const url = new URL(window.location.href)
    Object.keys(changes).forEach((key) => {
      if (changes[key]) url.searchParams.set(key, changes[key])
      else url.searchParams.delete(key)
    })
    window.history.replaceState(null, "", url)
  }

  const provinces = useMemo(() => provinceOptions(rows), [rows])
  const province = provinces.includes(state.province) ? state.province : ""
  const ranks = useMemo(() => provinceRanks(rows), [rows])
  const averageRanks = useMemo(() => rankByAverage(rows), [rows])
  const stats = useMemo(
    () => provinceStats(rows, state.statsSortKey, state.statsDirection),
    [rows, state.statsSortKey, state.statsDirection],
  )

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.name.includes(state.query) &&
          (!province || row.province_abbr === province),
      ),
    [rows, state.query, province],
  )
  const sorted = useMemo(
    () => sortRows(filtered, state.sortKey, state.direction),
    [filtered, state.sortKey, state.direction],
  )
  const result = paginate(sorted, state.page, state.pageSize)

  function yearHref(year: CollegeYear) {
    const params = new URLSearchParams({ year })
    if (state.query) params.set("q", state.query)
    if (province) params.set("province", province)
    return "/college/?" + params.toString()
  }

  function changeQuery(value: string) {
    patch({ query: value }, { keepPage: false })
    replaceParams({ q: value })
  }

  function changeProvince(value: string) {
    patch({ province: value }, { keepPage: false })
    replaceParams({ province: value })
  }

  function sortBy(key: SortKey | "default") {
    if (key === "default") {
      patch({ sortKey: "", direction: "asc" }, { keepPage: false })
      return
    }
    setState((prev) => ({
      ...prev,
      direction:
        prev.sortKey === key && prev.direction === "asc" ? "desc" : "asc",
      sortKey: key,
    }))
  }

  return (
    <>
      <main className="data-page ranking-page">
        <section className="data-panel">
          <header className="data-header">
            <h1>大学排行榜</h1>
            <p>（基于{state.year}年数据制作，使用3个排行榜平均值排名）</p>
            <div className="year-links">
              {AVAILABLE_YEARS.slice()
                .reverse()
                .map((year) => (
                  <a
                    className="button"
                    key={year}
                    href={yearHref(year)}
                    aria-current={year === state.year ? "page" : undefined}
                  >
                    {year}年
                  </a>
                ))}
            </div>
          </header>
          <div className="filters">
            <input
              className="control"
              data-query
              type="search"
              placeholder="请输入大学名称"
              value={state.query}
              onChange={(event) => changeQuery(event.target.value.trim())}
            />
            <span className="province-filter">
              <select
                className="control"
                data-province
                aria-label="按省份筛选"
                value={province}
                disabled={!provinces.length}
                onChange={(event) => changeProvince(event.target.value)}
              >
                {provinces.length ? (
                  <>
                    <option value="">全部省份</option>
                    {provinces.map((abbr) => (
                      <option value={abbr} key={abbr}>
                        {provinceLabel(abbr)}
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">暂无省份数据</option>
                )}
              </select>
              <button
                className="province-clear"
                type="button"
                data-province-clear
                aria-label="清除省份筛选"
                title="清除省份筛选"
                hidden={!province}
                onClick={() => changeProvince("")}
              >
                ×
              </button>
            </span>
            <button
              className="button"
              type="button"
              data-province-stats
              disabled={!stats.length}
              onClick={() => dialog.current?.showModal()}
            >
              省级统计
            </button>
            <label className="page-size-control">
              每页显示
              <select
                className="control"
                data-page-size
                value={String(state.pageSize)}
                onChange={(event) =>
                  patch(
                    { pageSize: Number(event.target.value) },
                    { keepPage: false },
                  )
                }
              >
                {[10, 20, 50, 100].map((size) => (
                  <option value={String(size)} key={size}>
                    {size}
                  </option>
                ))}
              </select>
              条
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      className="sort-button"
                      type="button"
                      data-sort="default"
                      onClick={() => sortBy("default")}
                    >
                      排名 ↕
                    </button>
                  </th>
                  <th>省内排名</th>
                  <th>学校名称</th>
                  <th className="desktop-only">
                    <button
                      className="sort-button"
                      data-sort="chinaxy"
                      onClick={() => sortBy("chinaxy")}
                    >
                      校友会 ↕
                    </button>
                  </th>
                  <th className="desktop-only">
                    <button
                      className="sort-button"
                      data-sort="ranking"
                      onClick={() => sortBy("ranking")}
                    >
                      软科 ↕
                    </button>
                  </th>
                  <th className="desktop-only">
                    <button
                      className="sort-button"
                      data-sort="wurank"
                      onClick={() => sortBy("wurank")}
                    >
                      武书连 ↕
                    </button>
                  </th>
                  <th>排名平均值</th>
                </tr>
              </thead>
              <tbody data-table-body>
                {failed ? (
                  <tr>
                    <td className="empty" colSpan={7}>
                      数据加载失败
                    </td>
                  </tr>
                ) : result.items.length ? (
                  result.items.map((row) => (
                    <tr key={row.id}>
                      <td>{averageRanks[row.avg]}</td>
                      <td>
                        {row.province_abbr
                          ? row.province_abbr + " " + (ranks[row.id] || 1)
                          : "-"}
                      </td>
                      <td>{row.name}</td>
                      <td className="desktop-only">
                        {row.chinaxy == null ? "-" : row.chinaxy}
                      </td>
                      <td className="desktop-only">
                        {row.ranking == null ? "-" : row.ranking}
                      </td>
                      <td className="desktop-only">
                        {row.wurank == null ? "-" : row.wurank}
                      </td>
                      <td>{row.avg}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty" colSpan={7}>
                      {loading ? "正在加载..." : "没有匹配的数据"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            onChange={(page) => setState((prev) => ({ ...prev, page }))}
          />
        </section>
      </main>
      <dialog
        className="province-dialog"
        ref={dialog}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="province-dialog-header">
          <h2>省级统计</h2>
          <button
            className="dialog-close"
            type="button"
            data-province-dialog-close
            aria-label="关闭省级统计"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    className="sort-button"
                    type="button"
                    data-province-default-sort
                    onClick={() =>
                      setState((prev) => ({ ...prev, statsSortKey: "" }))
                    }
                  >
                    排名 ↕
                  </button>
                </th>
                <th>省份</th>
                <th>
                  <button
                    className="sort-button"
                    type="button"
                    data-province-sort
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        statsSortKey: "count",
                        statsDirection:
                          prev.statsDirection === "asc" ? "desc" : "asc",
                      }))
                    }
                  >
                    大学数量 ↕
                  </button>
                </th>
                <th>排名平均值</th>
              </tr>
            </thead>
            <tbody data-province-stats-body>
              {stats.length ? (
                stats.map((item) => (
                  <tr
                    className="province-stat-row"
                    data-province-stat={item.province}
                    tabIndex={0}
                    key={item.province}
                    onClick={() => {
                      changeProvince(item.province)
                      dialog.current?.close()
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return
                      event.preventDefault()
                      changeProvince(item.province)
                      dialog.current?.close()
                    }}
                  >
                    <td>{item.rank}</td>
                    <td>{provinceLabel(item.province)}</td>
                    <td>{item.count}</td>
                    <td>{item.average.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty" colSpan={4}>
                    {rows.length ? "暂无省份数据" : "正在加载..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  )
}
