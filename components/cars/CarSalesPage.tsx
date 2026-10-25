"use client"

import { useEffect, useState } from "react"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import type { CarSalesYear, MonthSales } from "../../lib/car-sales"
import {
  DEFAULT_YEAR,
  YEARS,
  formatYoy,
  isCarSalesYear,
  lastMonth,
  rankBrands,
} from "../../lib/car-sales"

export default function CarSalesPage({ months }: { months: MonthSales[] }) {
  const [year, setYear] = useState<CarSalesYear>(DEFAULT_YEAR)

  // 查询参数在挂载后读取，避免静态 HTML 与首屏渲染不一致
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("year")
    if (isCarSalesYear(requested)) setYear(requested)
  }, [])

  const through = lastMonth(months, year)
  const rows = through
    ? rankBrands(months, year, through, String(Number(year) - 1))
    : []

  return (
    <Page className="data-page cars-page">
      <PageHeader
        title="汽车品牌销量"
        description={`${
          through
            ? through === 12
              ? `${year} 年全年累计`
              : `${year} 年 1-${through} 月累计`
            : `${year} 年`
        }，数据来源：车主之家，不含进口车型`}
        actions={
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
        }
      />
      <section className="data-panel">
        <Table containerClassName="table-wrap">
          <TableHeader>
            <TableRow>
              <TableHead>排名</TableHead>
              <TableHead>品牌</TableHead>
              <TableHead className="desktop-only">国别</TableHead>
              <TableHead>销量</TableHead>
              <TableHead>同比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => (
                <TableRow key={row.name}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="desktop-only">{row.country}</TableCell>
                  <TableCell>{row.sales.toLocaleString("zh-CN")}</TableCell>
                  <TableCell
                    className={
                      row.yoy == null
                        ? "empty"
                        : row.yoy >= 0
                          ? "up"
                          : "down"
                    }
                  >
                    {formatYoy(row.yoy)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="empty" colSpan={5}>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </Page>
  )
}
