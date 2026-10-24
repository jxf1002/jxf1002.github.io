"use client"

import { useEffect, useState } from "react"
import type { CarSalesYear, MonthSales } from "../../lib/car-sales"
import {
  DEFAULT_YEAR,
  YEARS,
  formatYoy,
  isCarSalesYear,
  lastMonth,
  rankBrands,
} from "../../lib/car-sales"

export default function CarSalesPage() {
  const [year, setYear] = useState<CarSalesYear>(DEFAULT_YEAR)
  const [months, setMonths] = useState<MonthSales[]>([])
  const [failed, setFailed] = useState(false)

  // 查询参数在挂载后读取，避免静态 HTML 与首屏渲染不一致
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("year")
    if (isCarSalesYear(requested)) setYear(requested)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/data/car-sales/index.json")
      .then((response) => {
        if (!response.ok) throw new Error("数据加载失败")
        return response.json()
      })
      .then((index: { months: string[] }) =>
        Promise.all(
          index.months.map((month) =>
            fetch(`/data/car-sales/${month}.json`).then((response) => {
              if (!response.ok) throw new Error("数据加载失败")
              return response.json() as Promise<MonthSales>
            }),
          ),
        ),
      )
      .then((data) => {
        if (cancelled) return
        setMonths(data)
        setFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setMonths([])
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const through = lastMonth(months, year)
  const rows = through
    ? rankBrands(months, year, through, String(Number(year) - 1))
    : []

  return (
    <main className="data-page cars-page">
      <section className="data-panel">
        <header className="data-header">
          <h1>汽车品牌销量</h1>
          <p>
            {through
              ? through === 12
                ? `${year} 年全年累计`
                : `${year} 年 1-${through} 月累计`
              : `${year} 年`}
            ，数据来源：车主之家，不含进口车型
          </p>
          <div className="year-links">
            {YEARS.map((item) => (
              <a
                className="button"
                key={item}
                href={`?year=${item}`}
                aria-current={item === year ? "page" : undefined}
              >
                {item}年
              </a>
            ))}
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>品牌</th>
                <th className="desktop-only">国别</th>
                <th>销量</th>
                <th>同比</th>
              </tr>
            </thead>
            <tbody>
              {failed ? (
                <tr>
                  <td className="empty" colSpan={5}>
                    数据加载失败
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row, index) => (
                  <tr key={row.name}>
                    <td>{index + 1}</td>
                    <td>{row.name}</td>
                    <td className="desktop-only">{row.country}</td>
                    <td>{row.sales.toLocaleString("zh-CN")}</td>
                    <td
                      className={
                        row.yoy == null
                          ? "empty"
                          : row.yoy >= 0
                            ? "up"
                            : "down"
                      }
                    >
                      {formatYoy(row.yoy)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty" colSpan={5}>
                    正在加载...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
