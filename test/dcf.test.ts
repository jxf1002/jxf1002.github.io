// DCF 估值纯逻辑
import assert from "node:assert/strict"
import test from "node:test"
import { computeDcf } from "../lib/dcf.ts"

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
