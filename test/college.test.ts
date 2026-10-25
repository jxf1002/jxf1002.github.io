// 大学排行榜纯逻辑：并列名次、省内排名、省级统计
import assert from "node:assert/strict"
import test from "node:test"
import type { CollegeAvgRow, CollegeRow } from "../lib/college.ts"
import { provinceRanks, provinceStats, rankByAverage } from "../lib/college.ts"

test("大学榜：并列名次取最小 id，省内排名按顺序递增", () => {
  const rows: CollegeRow[] = [
    { id: 1, name: "A", avg: 1.5, province_abbr: "京" },
    { id: 2, name: "B", avg: 1.5, province_abbr: "京" },
    { id: 3, name: "C", avg: 2, province_abbr: "苏" },
  ]
  const ranks = rankByAverage(rows)
  assert.equal(ranks[1.5], 1)
  assert.equal(ranks[2], 3)
  assert.deepEqual(provinceRanks(rows), { 1: 1, 2: 2, 3: 1 })
})

test("大学榜：省份统计的名次与数量排序", () => {
  const rows: CollegeAvgRow[] = [
    { id: 1, avg: 1, province_abbr: "京" },
    { id: 2, avg: 3, province_abbr: "京" },
    { id: 3, avg: 2, province_abbr: "苏" },
  ]
  const byAverage = provinceStats(rows, "", "asc")
  assert.deepEqual(
    byAverage.map((item) => [item.province, item.rank, item.count]),
    [
      ["京", 1, 2],
      ["苏", 2, 1],
    ],
  )
  const byCountDesc = provinceStats(rows, "count", "desc")
  assert.deepEqual(
    byCountDesc.map((item) => item.province),
    ["京", "苏"],
  )
  const byCountAsc = provinceStats(rows, "count", "asc")
  assert.deepEqual(
    byCountAsc.map((item) => item.province),
    ["苏", "京"],
  )
})
