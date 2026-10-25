// 汽车销量纯逻辑：按月累加、同比、区间截断
import assert from "node:assert/strict"
import test from "node:test"
import type { MonthSales } from "../lib/car-sales.ts"
import { formatYoy, lastMonth, rankBrands } from "../lib/car-sales.ts"

function salesMonth(
  month: string,
  rows: Array<[name: string, sales: number]>,
): MonthSales {
  return {
    month,
    total: rows.reduce((n, [, sales]) => n + sales, 0),
    source: "test",
    fetchedAt: "2026-10-24",
    rows: rows.map(([name, sales], index) => ({
      rank: index + 1,
      id: index + 1,
      name,
      country: "中国",
      sales,
      share: null,
    })),
  }
}

test("汽车销量：按月累加并按销量降序", () => {
  const months = [
    salesMonth("2026-01", [
      ["甲", 100],
      ["乙", 50],
    ]),
    salesMonth("2026-02", [
      ["甲", 100],
      ["丙", 10],
    ]),
    salesMonth("2026-09", [["乙", 100]]),
    salesMonth("2026-10", [["乙", 9999]]),
  ]
  const rows = rankBrands(months, "2026", 9)
  assert.deepEqual(
    rows.map((row) => [row.name, row.sales]),
    [
      ["甲", 200],
      ["乙", 150],
      ["丙", 10],
    ],
  )
})

test("汽车销量：同比对比上年同区间，缺数据为 null", () => {
  const months = [
    salesMonth("2025-01", [
      ["甲", 200],
      ["乙", 100],
    ]),
    salesMonth("2025-10", [["甲", 1000]]),
    salesMonth("2026-01", [
      ["甲", 200],
      ["乙", 150],
      ["新", 30],
    ]),
  ]
  const rows = rankBrands(months, "2026", 9, "2025")
  assert.equal(rows.find((row) => row.name === "甲")?.yoy, 0)
  assert.equal(rows.find((row) => row.name === "乙")?.yoy, 50)
  assert.equal(rows.find((row) => row.name === "新")?.yoy, null)
})

test("汽车销量：无上年数据时同比全为 null，lastMonth 取最大月份", () => {
  const months = [
    salesMonth("2025-01", [["甲", 10]]),
    salesMonth("2025-12", [["甲", 10]]),
  ]
  assert.equal(lastMonth(months, "2025"), 12)
  assert.equal(lastMonth(months, "2024"), 0)
  assert.deepEqual(
    rankBrands(months, "2025", 12, "2024").map((row) => row.yoy),
    [null],
  )
})

test("汽车销量：同比文案", () => {
  assert.equal(formatYoy(null), "-")
  assert.equal(formatYoy(0), "+0.0%")
  assert.equal(formatYoy(12.345), "+12.3%")
  assert.equal(formatYoy(-5), "-5.0%")
})
