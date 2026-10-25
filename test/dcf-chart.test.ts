// DCF 图表配置（纯函数，不依赖 echarts 运行时）
import assert from "node:assert/strict"
import test from "node:test"
import { computeDcf } from "../lib/dcf.ts"
import { optionFor } from "../lib/dcf-chart-option.ts"
import type { DcfChartColors } from "../lib/dcf-chart-option.ts"

const COLORS: DcfChartColors = {
  primary: "#111",
  primaryFill: "#222",
  accent: "#333",
  accentFill: "#444",
  text: "#555",
  grid: "#666",
}

test("DCF 图表：柱状=现金流，折线=折现值，标签与计算结果一致", () => {
  const result = computeDcf({
    netProfit: "10",
    growthYears: "3",
    growthRate: "10",
    terminalRate: "2",
    discountRate: "8",
  })
  assert.ok(result)
  const option = optionFor(result, COLORS)
  const series = option.series as {
    name: string
    type: string
    data: number[]
  }[]
  assert.equal(series.length, 2)
  assert.equal(series[0].name, "现金流")
  assert.equal(series[0].type, "bar")
  assert.equal(series[1].name, "折现值")
  assert.equal(series[1].type, "line")

  // 永续期不进趋势图：量级差太大，会把明示期压成一条线
  const forecastLabels = result.chartLabels.slice(0, -1)
  assert.deepEqual(series[0].data, result.chartCF.slice(0, -1))
  assert.deepEqual(series[1].data, result.chartPV.slice(0, -1))

  const xAxis = option.xAxis as { data: string[] }
  assert.deepEqual(xAxis.data, forecastLabels)
  assert.ok(!xAxis.data.includes("♾️ 永续期"))
})
