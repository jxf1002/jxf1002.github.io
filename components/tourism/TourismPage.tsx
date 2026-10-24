"use client"

import { useEffect, useState } from "react"
import Pagination from "../Pagination"
import { paginate } from "../../lib/list"

const ALL = "全部"

type TourismRow = {
  name: string
  provinceName: string
  gradesName: string
  year: string
}

export default function TourismPage() {
  const [rows, setRows] = useState<TourismRow[]>([])
  const [query, setQuery] = useState("")
  const [province, setProvince] = useState(ALL)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch("/data/tourism/tourism.json")
      .then((response) => response.json())
      .then(setRows)
      .catch(() => setFailed(true))
  }, [])

  const provinces = Array.from(
    new Set(rows.map((row) => row.provinceName)),
  ).sort()
  const filtered = rows.filter(
    (row) =>
      row.name.includes(query) &&
      (province === ALL || row.provinceName === province),
  )
  const result = paginate(filtered, page, 10)

  function reset(next: () => void) {
    setPage(1)
    next()
  }

  return (
    <main className="data-page tourism-page">
      <section className="data-panel">
        <header className="data-header">
          <h1>5A级旅游景区</h1>
          <p>（基于2023年数据制作）</p>
        </header>
        <div className="filters">
          <input
            className="control"
            data-query
            type="search"
            placeholder="请输入景点名称"
            value={query}
            onChange={(event) =>
              reset(() => setQuery(event.target.value.trim()))
            }
          />
          <select
            className="control"
            data-province
            value={province}
            onChange={(event) => reset(() => setProvince(event.target.value))}
          >
            <option value={ALL}>{ALL}</option>
            {provinces.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>景区名称</th>
                <th>地区</th>
                <th className="desktop-only">级别</th>
                <th className="desktop-only">评定年份</th>
              </tr>
            </thead>
            <tbody data-table-body>
              {failed ? (
                <tr>
                  <td className="empty" colSpan={4}>
                    数据加载失败
                  </td>
                </tr>
              ) : result.items.length ? (
                result.items.map((row, index) => (
                  <tr key={row.name + index}>
                    <td>{row.name}</td>
                    <td>{row.provinceName}</td>
                    <td className="desktop-only">{row.gradesName}</td>
                    <td className="desktop-only">{row.year}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty" colSpan={4}>
                    {rows.length ? "没有匹配的数据" : "正在加载..."}
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
          onChange={setPage}
        />
      </section>
    </main>
  )
}
