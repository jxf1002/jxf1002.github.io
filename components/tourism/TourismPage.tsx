"use client"

import { useEffect, useState } from "react"
import Pagination from "../Pagination"
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
    <Page className="data-page tourism-page">
      <PageHeader title="5A级旅游景区" description="基于 2023 年数据制作" />
      <section className="data-panel">
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
        <Table containerClassName="table-wrap">
          <TableHeader>
            <TableRow>
              <TableHead>景区名称</TableHead>
              <TableHead>地区</TableHead>
              <TableHead className="desktop-only">级别</TableHead>
              <TableHead className="desktop-only">评定年份</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-table-body>
            {failed ? (
              <TableRow>
                <TableCell className="empty" colSpan={4}>
                  数据加载失败
                </TableCell>
              </TableRow>
            ) : result.items.length ? (
              result.items.map((row, index) => (
                <TableRow key={row.name + index}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.provinceName}</TableCell>
                  <TableCell className="desktop-only">
                    {row.gradesName}
                  </TableCell>
                  <TableCell className="desktop-only">{row.year}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="empty" colSpan={4}>
                  {rows.length ? "没有匹配的数据" : "正在加载..."}
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
      </section>
    </Page>
  )
}
