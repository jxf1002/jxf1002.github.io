// 纯逻辑单测：node --test test/*.test.ts
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { CollegeAvgRow, CollegeRow } from "../lib/college.ts"
import { provinceRanks, provinceStats, rankByAverage } from "../lib/college.ts"
import { computeDcf } from "../lib/dcf.ts"
import { createZip } from "../lib/photo/convert.ts"
import { outputName, uniqueName } from "../lib/photo/naming.ts"
import { buildReport, cycleFor, formatTime, metFor } from "../lib/sport.ts"

test("DCF：单期零增长，总值等于永续+首期折现", () => {
  const result = computeDcf({
    netProfit: "1",
    growthYears: "1",
    growthRate: "0",
    terminalRate: "0",
    discountRate: "10",
  })
  assert.ok(result)
  // 首期折现 1/1.1，永续 10/1.1，合计 10
  assert.ok(Math.abs(result.totalPV - 10) < 1e-9)
  assert.equal(result.terminalValid, true)
  assert.equal(result.tableData.length, 2)
  assert.equal(result.tableData[1].isTerminal, true)
})

test("DCF：非法输入返回 null", () => {
  assert.equal(
    computeDcf({
      netProfit: "0",
      growthYears: "5",
      growthRate: "15",
      terminalRate: "3",
      discountRate: "10",
    }),
    null,
  )
  assert.equal(
    computeDcf({
      netProfit: "10",
      growthYears: "",
      growthRate: "15",
      terminalRate: "3",
      discountRate: "10",
    }),
    null,
  )
  assert.equal(
    computeDcf({
      netProfit: "10",
      growthYears: "5",
      growthRate: "15",
      terminalRate: "3",
      discountRate: "0",
    }),
    null,
  )
})

test("DCF：折现率不高于永续增长率时标记发散", () => {
  const result = computeDcf({
    netProfit: "10",
    growthYears: "3",
    growthRate: "15",
    terminalRate: "3",
    discountRate: "3",
  })
  assert.ok(result)
  assert.equal(result.terminalValid, false)
  assert.equal(result.terminalPV, Infinity)
  assert.equal(result.totalPV, result.cumulativePV)
})

test("运动：四种运动的强度、卡路里、心率与报告文案", () => {
  // 跑步 10km/h × 10 分钟：MET 9.8，50kg 下 86 kcal
  const run = buildReport("run", 10, 600)
  assert.equal(run.time, "10.0 分钟")
  assert.deepEqual(run.metrics, [
    { label: "运动时长", value: "10.0 分钟" },
    { label: "平均速度", value: "10 km/h" },
    { label: "估算距离", value: "1.67 km" },
    { label: "卡路里消耗", value: "86 kcal" },
    { label: "平均心率", value: "143 bpm" },
    { label: "平均配速", value: "6:00 /km" },
  ])
  assert.equal(
    run.note,
    "节奏稳定，继续保持这份能量。卡路里按 50kg 体重模型估算。",
  )

  // 骑行看踏频，游泳看每 100m 配速，跳绳没有距离、只有次数
  assert.equal(
    buildReport("bike", 22, 600).metrics.at(-1)?.value,
    "75 rpm",
  )
  assert.equal(buildReport("swim", 2.2, 600).metrics[1].value, "2:44 /100m")
  assert.equal(buildReport("swim", 2.2, 600).metrics[2].value, "367 m")
  assert.equal(buildReport("rope", 100, 600).metrics[1].value, "1000 次")
  assert.equal(buildReport("rope", 100, 600).metrics.length, 5)

  // 强度曲线单调，动作周期随强度变快
  assert.ok(metFor("bike", 40) > metFor("bike", 20))
  assert.equal(cycleFor("rope", 60), "1.00s")
  assert.equal(cycleFor("run", 20), "0.60s")
  assert.equal(formatTime(0), "00:00")
  assert.equal(formatTime(65), "01:05")
  assert.equal(buildReport("run", 8, 20).time, "20 秒")
  assert.equal(
    buildReport("run", 8, 1500).note,
    "耐力拉满，今天的你很强。卡路里按 50kg 体重模型估算。",
  )
})

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

test("图片：输出名与重名去重", () => {
  assert.equal(outputName("photo.PNG", "webp"), "photo.webp")
  assert.equal(outputName("无后缀", "jpg"), "无后缀.jpg")
  const used = new Set<string>()
  assert.equal(uniqueName("a.jpg", used), "a.jpg")
  assert.equal(uniqueName("a.jpg", used), "a(2).jpg")
  assert.equal(uniqueName("a.jpg", used), "a(3).jpg")
})

test("图片：ZIP 结构能被 unzip 校验并还原内容", async () => {
  const encoder = new TextEncoder()
  const entries = [
    { name: "a.txt", data: encoder.encode("hello zip") },
    { name: "b.txt", data: encoder.encode("第二份内容") },
  ]
  const blob = await createZip(entries).arrayBuffer()
  const dir = mkdtempSync(join(tmpdir(), "zip-test-"))
  const file = join(dir, "out.zip")
  writeFileSync(file, Buffer.from(blob))

  const listed = execFileSync("unzip", ["-l", file], { encoding: "utf8" })
  assert.ok(listed.includes("a.txt"))
  assert.ok(listed.includes("b.txt"))
  execFileSync("unzip", ["-t", file])
  const text = execFileSync("unzip", ["-p", file, "b.txt"], {
    encoding: "utf8",
  })
  assert.equal(text, "第二份内容")
})
